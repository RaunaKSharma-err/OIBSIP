# Pizza Delivery & Inventory Backend

Express + TypeScript + MongoDB (Mongoose) REST API for the Oasis Infobyte Level-3 Pizza Delivery project: customer auth with email verification, pizza customisation, server-side pricing, Razorpay **test-mode** payments, ingredient-level inventory, admin order management, dashboard, and automated low-stock emails. Contract for the frontend: [`../API_SPEC.md`](../API_SPEC.md).

> **Verification status (read this):** The code was written in an environment **without network access**, so `npm install`, the test suite, the production build, a live MongoDB, Razorpay and SMTP were **never executed**. Only a syntax-level TypeScript pass was possible. Run the checklist in [Verifying this build](#verifying-this-build) first and fix any type errors that surface.

## Features
Registration + email verification, login with short-lived JWT + rotating HttpOnly refresh cookie, forgot/reset password, role-based access (customer/admin), catalog + options with search/filter/sort/pagination, server-side pricing with immutable order snapshots, idempotent order creation, stock reservation, Razorpay order creation / signature verification / idempotent webhooks, order status state machine, admin inventory with audit ledger, dashboard aggregations, low-stock alerts with duplicate prevention, Helmet/CORS/rate limiting/validation, structured redacting logs, health/readiness, graceful shutdown.

## Architecture
```
src/
  config/      env validation (zod, fails fast), db connection
  routes/      URL → middleware → controller wiring
  controllers/ thin HTTP adapters
  services/    business logic (auth, pricing, orders, payments, inventory, alerts, dashboard)
  models/      Mongoose schemas (User, AuthToken, RefreshToken, Pizza, PizzaOption, InventoryItem,
               InventoryTransaction, Order, Payment, WebhookEvent)
  middleware/  auth, roles, validate (zod), rate limit, errors, CSRF origin check
  validators/  zod schemas      jobs/  cron scheduler      scripts/seed.ts   utils/  helpers
tests/         vitest + supertest + mongodb-memory-server
```
### Key design decisions
**Money** is integer paise; **inventory** is integer base units (g/ml/unit), so no floating-point drift.

**Order & payment lifecycle**
1. `POST /orders` re-prices from the DB and, in one step, **reserves stock** (conditional `$inc` with `stock >= needed`) and saves a `pending_payment` order that holds the stock for `RESERVATION_MINUTES`.
2. Paid (verified) → `received`, reservation becomes `committed` (no second deduction). Unpaid past the deadline, or cancelled → order `cancelled`, stock **released** (a cron job runs every 2 min; `create-order` also expires lazily).
3. Reserving at checkout (rather than deducting after payment) is what guarantees a captured payment can't hit an out-of-stock item. If money arrives for an already-expired order the server tries to re-reserve; if stock is gone the order is flagged `needsRefund` (manual refund in Razorpay).
4. Every ledger row (`InventoryTransaction`) for order movements is unique per `(order, item, type, cycle)`, which makes reserve/release idempotent.

**Payments**: verify = HMAC check **plus** fetching the payment from Razorpay (status/amount/currency). Webhook uses the raw body; the event id is stored; processing is idempotent regardless, so verify+webhook+retries in any order produce one paid transition.

**Transactions vs. standalone MongoDB**: multi-document writes use a MongoDB transaction when available (replica set/Atlas). On a standalone server (`MONGO_TRANSACTIONS=auto` detects this) it falls back to ordered conditional updates with compensating undo. **Limitation:** in that fallback a process crash *between* two writes can leave stock reserved without an order or released without credit; use a replica set in production. Local replica set:
```bash
mongod --replSet rs0 --dbpath ./data --bind_ip 127.0.0.1   # then once: mongosh --eval 'rs.initiate()'
# MONGODB_URI=mongodb://127.0.0.1:27017/pizza_delivery?replicaSet=rs0
```
**Auth**: see API_SPEC §1. Access JWT contains a `tokenVersion`; password reset bumps it and revokes refresh tokens. Verification/reset tokens are random, stored only as SHA-256 hashes, single-use, expiring.

**Low-stock alerts**: item state `lowStockNotified`. Crossing to `stock ≤ threshold` claims the flag atomically then emails `ADMIN_EMAIL`; later checks stay silent; rising above the threshold re-arms it. Evaluated after every stock change and by cron (`LOW_STOCK_CHECK_SCHEDULE`). If email isn't actually delivered (no SMTP, or SMTP error) the claim is reverted and logged, never reported as sent.

**Scheduler**: runs inside the API process when `ENABLE_SCHEDULER=true`. Run it on exactly one instance (set `false` elsewhere); even if several run, atomic claims/conditional updates prevent duplicate emails or releases.

**Simplified inventory model:** each `PizzaOption` and `Pizza` has a `consumes`/`recipe` list (inventory item + quantity), summed per order. Quantities in the seed are illustrative.

## Prerequisites
Node.js ≥ 20, MongoDB 6+ (local or Atlas), optionally SMTP credentials and Razorpay test keys.

## Setup
```bash
cd backend
npm install
cp .env.example .env      # fill in values (see below)
npm run seed              # catalog + inventory (+ admin if ADMIN_SEED_* set)
npm run dev               # http://localhost:5000
```
Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
Commands: `npm run dev | build | start | typecheck | test | seed`.

### Seed
Idempotent. Upserts pizzas/options/inventory by slug/name; **never resets stock** on re-run. Admin is created only if `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` (≥12 chars) are set (existing users are promoted, password untouched). No customers/orders are created. Never commit the password; remove it from `.env` afterwards if you like.

### Razorpay test mode
1. Sign up at razorpay.com → Dashboard → toggle **Test Mode** → Settings → API Keys → Generate. Put `rzp_test_…` id/secret in `.env`.
2. Webhook: Settings → Webhooks → add `https://<public-url>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `order.paid`. Locally expose with a tunnel (e.g. ngrok).
3. Pay with Razorpay's test cards/UPI from their docs; no real money moves. Never use live keys in this project.

### Email (SMTP)
Fill `SMTP_*` and `EMAIL_FROM` (Gmail: enable 2FA, create an App Password, host `smtp.gmail.com`, port 465). **Without SMTP the server runs in preview mode**: nothing is sent, logs say so, and (development only) the email body, including verification/reset links, is printed to the console so you can test the flow.

## Testing
`npm test` (Vitest + Supertest). Uses `mongodb-memory-server` (downloads a MongoDB binary on first run, needs internet once) so it never touches your real database. Razorpay and email are mocked. Covers auth, verification, reset, RBAC, catalog, pricing, ownership, idempotency, transitions, payments (invalid signature, mismatch, duplicates, webhooks, failure, late payment), inventory validation, concurrency (no oversell), release idempotency, alert de-duplication, dashboard, health/error format.

## Verifying this build
```bash
npm install && npm run typecheck && npm test && npm run build
```
Then manually: seed → start → register (read the link from the console) → verify → login → create order → create-order → pay with Razorpay test card → confirm order is `received` and stock fell.

## Deployment
Set `NODE_ENV=production`; the app refuses to start without Razorpay, SMTP, `ADMIN_EMAIL`, secure cookies. Use `MONGODB_URI` for an Atlas replica set, `TRUST_PROXY=1` behind a proxy, HTTPS, `COOKIE_SECURE=true`; if the SPA and API are on different sites use `COOKIE_SAMESITE=none`. `FRONTEND_URL`/`CORS_ORIGINS` = exact frontend origin(s). Build with `npm run build`, run `npm start`. Run seed once. Run exactly one scheduler instance.

## Security notes
bcrypt (12 rounds), Helmet, CORS allowlist, per-route rate limits, strict zod schemas (unknown keys rejected), 50 kB body limit, role never accepted from clients, ownership enforced in queries, hashed tokens, refresh rotation with reuse detection, Origin check on cookie endpoints, signature verification with timing-safe comparison, log redaction of secrets/tokens, no stack traces in production.

## Known limitations
- Not executed/tested in the authoring environment (see top).
- No admin CRUD for pizzas/options (seed or edit in MongoDB).
- Refunds are manual; cancelling a paid order only flags `needsRefund` and does not restock automatically.
- Standalone-MongoDB fallback is not crash-atomic (see above).
- Two simultaneous `create-order` calls for the same order could create two Razorpay orders (only one can be paid for the order; both are verified safely).
- Concurrent refresh from two tabs can trigger reuse detection and log the user out.
- Revenue ignores tax; delivery is a flat fee (+ optional free-delivery threshold); no coupons/discount logic (`discount` is always 0).
- No real courier/delivery tracking; status is changed manually by an admin.

## Troubleshooting
- *Env error at startup*: read the listed variables; compare with `.env.example`.
- *`INSUFFICIENT_STOCK` everywhere*: run the seed or restock via `/admin/inventory/:id/adjustments`.
- *CORS blocked*: add the exact origin to `CORS_ORIGINS`; the frontend must send `credentials: 'include'`.
- *Refresh cookie not sent cross-site*: `COOKIE_SAMESITE=none` + HTTPS + `COOKIE_SECURE=true`.
- *Webhook 400*: wrong `RAZORPAY_WEBHOOK_SECRET`, or a proxy modifies the body.
- *Transactions warning in logs*: expected on standalone MongoDB.
