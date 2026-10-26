# Pizza Delivery & Inventory Backend

Express + TypeScript + MongoDB (Mongoose) REST API for the Oasis Infobyte Level-3 Pizza Delivery project: customer auth with email verification, pizza customisation, server-side pricing, eSewa ePay V2 payments (test environment by default), ingredient-level inventory, admin order management, dashboard, and automated low-stock emails. Contract for the frontend: [`../API_SPEC.md`](../API_SPEC.md).

> **Verification status (read this):** The backend, including the eSewa migration, was written in an environment **without network access**, so `npm install`, the test suite, the production build, a live MongoDB, the eSewa sandbox and SMTP were **never executed**. Only a syntax-level TypeScript pass was possible. Run the checklist in [Verifying this build](#verifying-this-build) first and fix any type errors that surface.

## Features
Registration + email verification, login with short-lived JWT + rotating HttpOnly refresh cookie, forgot/reset password, role-based access (customer/admin), catalog + options with search/filter/sort/pagination, server-side pricing with immutable order snapshots, idempotent order creation, stock reservation, eSewa form signing / signed-response verification / status-API confirmation / reconciliation, order status state machine, admin inventory with audit ledger, dashboard aggregations, low-stock alerts with duplicate prevention, Helmet/CORS/rate limiting/validation, structured redacting logs, health/readiness, graceful shutdown.

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
**Money** is integer paisa (NPR; 100 paisa = Rs 1); **inventory** is integer base units (g/ml/unit), so no floating-point drift.

**Order & payment lifecycle**
1. `POST /orders` re-prices from the DB and, in one step, **reserves stock** (conditional `$inc` with `stock >= needed`) and saves a `pending_payment` order that holds the stock for `RESERVATION_MINUTES`.
2. Paid (verified) → `received`, reservation becomes `committed` (no second deduction). Unpaid past the deadline, or cancelled → order `cancelled`, stock **released** (a cron job runs every 2 min; `create-order` also expires lazily).
3. Reserving at checkout (rather than deducting after payment) is what guarantees a completed payment can't hit an out-of-stock item. If money arrives for an already-expired order the server tries to re-reserve; if stock is gone the order is flagged `needsRefund` (manual refund in the eSewa merchant portal).
4. Every ledger row (`InventoryTransaction`) for order movements is unique per `(order, item, type, cycle)`, which makes reserve/release idempotent.

**Payments (eSewa ePay V2, redirect/form flow)**
1. `POST /payments/esewa/initiate`: the backend builds the form from the trusted order total, creates a payment *attempt* with a fresh `transaction_uuid` (`<orderNumber>-<8 hex>`), and signs `total_amount,transaction_uuid,product_code` with HMAC-SHA256 → Base64.
2. The browser POSTs the form to eSewa and returns to `.../success/<orderId>?data=<base64>` or `.../failure/<orderId>`.
3. `POST /payments/esewa/verify`: decode `data`, verify its signature over its own `signed_field_names` (required fields enforced; verified raw values are the only ones used afterwards), match uuid/product/amount to the stored attempt and the user, then **call eSewa's status API**. Only `COMPLETE` + matching uuid/product/amount ⇒ paid. PENDING/AMBIGUOUS/NOT_FOUND/timeouts ⇒ never paid (retry later); CANCELED ⇒ failed attempt, order stays retryable.
4. `GET /payments/esewa/status` serves the failure page and polling; a scheduled job reconciles attempts whose browser never returned.
5. All transitions are conditional updates, so refresh/concurrent calls produce one payment completion and one stock commit. A second paid attempt for the same order is flagged for manual refund.
Not implemented: webhooks/IPN (eSewa's V2 docs do not specify a format) and automated refunds.

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
Node.js ≥ 20, MongoDB 6+ (local or Atlas), optionally SMTP credentials. The eSewa sandbox needs no signup (public test merchant `EPAYTEST`).

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

### eSewa test mode
Config (`.env`): `ESEWA_ENVIRONMENT=test`, `ESEWA_PRODUCT_CODE=EPAYTEST`, `ESEWA_SECRET_KEY=8gBm/:&EnhH.1/q` (eSewa's public sandbox key), `ESEWA_SUCCESS_URL` / `ESEWA_FAILURE_URL` = your frontend routes (backend appends `/<orderId>`). Default sandbox endpoints: form `https://rc-epay.esewa.com.np/api/epay/main/v2/form`, status `https://rc.esewa.com.np/api/epay/transaction/status/` (override with `ESEWA_PAYMENT_URL` / `ESEWA_STATUS_URL`).
> **Check on first run:** eSewa's docs page lists the status endpoint as `uat.esewa.com.np` with older field names (`pid`, `scd`, `totalAmount`), while current integrations use `rc.esewa.com.np` with `product_code`, `transaction_uuid`, `total_amount`, `ref_id`. The client accepts both response shapes; if the default status URL fails, set `ESEWA_STATUS_URL`. Also, the sample signatures printed in the docs do **not** reproduce with the published test secret in my check, so verify signing against the real sandbox (a wrong signature shows as an error page on eSewa's form).
**Manual test:** run backend + frontend → register/verify → place an order → *Pay with eSewa* → on eSewa log in with ID `9806800001` (…`2`/`3`/`4`/`5`), password `Nepal@123`, token/OTP `123456` (MPIN `1122` for the app) → you should land on the success page, which shows the server-confirmed result; check `GET /api/orders/:id` is `paid`/`received`. Also try cancelling on eSewa (→ failure page, order still retryable) and refreshing the success page (no double stock deduction).
**Going live:** switch `ESEWA_ENVIRONMENT=production`, use the merchant code and secret eSewa issues you (the app refuses `EPAYTEST` or the public secret in that mode), and public `https` success/failure URLs. `localhost` URLs will not work from a deployed server.

### Email (SMTP)
Fill `SMTP_*` and `EMAIL_FROM` (Gmail: enable 2FA, create an App Password, host `smtp.gmail.com`, port 465). **Without SMTP the server runs in preview mode**: nothing is sent, logs say so, and (development only) the email body, including verification/reset links, is printed to the console so you can test the flow.

## Testing
`npm test` (Vitest + Supertest). Uses `mongodb-memory-server` (downloads a MongoDB binary on first run, needs internet once) so it never touches your real database. The eSewa status API and email are mocked. Covers auth, verification, reset, RBAC, catalog, pricing, ownership, idempotency, transitions, payments (request/response signatures, tampering, uuid/amount/product mismatches, pending/canceled/timeout, duplicates, concurrency, reconciliation, late payment), inventory validation, concurrency (no oversell), release idempotency, alert de-duplication, dashboard, health/error format.

## Verifying this build
```bash
npm install && npm run typecheck && npm test && npm run build
```
Then manually: seed → start → register (read the link from the console) → verify → login → create order → initiate → pay on the eSewa sandbox → confirm order is `received` and stock fell.

## Deployment
Set `NODE_ENV=production`; the app refuses to start without an eSewa secret, SMTP, `ADMIN_EMAIL`, secure cookies. Use `MONGODB_URI` for an Atlas replica set, `TRUST_PROXY=1` behind a proxy, HTTPS, `COOKIE_SECURE=true`; if the SPA and API are on different sites use `COOKIE_SAMESITE=none`. `FRONTEND_URL`/`CORS_ORIGINS` = exact frontend origin(s). Build with `npm run build`, run `npm start`. Run seed once. Run exactly one scheduler instance.

## Security notes
bcrypt (12 rounds), Helmet, CORS allowlist, per-route rate limits, strict zod schemas (unknown keys rejected), 50 kB body limit, role never accepted from clients, ownership enforced in queries, hashed tokens, refresh rotation with reuse detection, Origin check on cookie endpoints, signature verification with timing-safe comparison, log redaction of secrets/tokens, no stack traces in production.

## Known limitations
- Not executed/tested in the authoring environment (see top).
- No admin CRUD for pizzas/options (seed or edit in MongoDB).
- Refunds are manual; cancelling a paid order only flags `needsRefund` and does not restock automatically.
- Standalone-MongoDB fallback is not crash-atomic (see above).
- Two attempts for one order verified at the exact same instant could both pass the duplicate check (the order is still completed once; check `needsRefund`/the payments list for double payments).
- eSewa's response signature examples in the public docs could not be reproduced, and no real sandbox payment was performed; see "eSewa test mode".
- Concurrent refresh from two tabs can trigger reuse detection and log the user out.
- Revenue ignores tax; delivery is a flat fee (+ optional free-delivery threshold); no coupons/discount logic (`discount` is always 0).
- No real courier/delivery tracking; status is changed manually by an admin.

## Troubleshooting
- *Env error at startup*: read the listed variables; compare with `.env.example`.
- *`INSUFFICIENT_STOCK` everywhere*: run the seed or restock via `/admin/inventory/:id/adjustments`.
- *CORS blocked*: add the exact origin to `CORS_ORIGINS`; the frontend must send `credentials: 'include'`.
- *Refresh cookie not sent cross-site*: `COOKIE_SAMESITE=none` + HTTPS + `COOKIE_SECURE=true`.
- *eSewa form shows a signature/parameter error*: check `ESEWA_PRODUCT_CODE`/`ESEWA_SECRET_KEY`, and that nothing edits the form fields.
- *Payment stuck at `verification_required`*: eSewa's status API was unreachable; retry, or set `ESEWA_STATUS_URL` and check the logs.
- *Transactions warning in logs*: expected on standalone MongoDB.
