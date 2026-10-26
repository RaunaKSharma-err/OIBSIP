# API Specification: Pizza Delivery & Inventory Management

Base URL (dev): `http://localhost:5000/api` · Version 1.0 · JSON only. This is the contract for the Bolt.ai frontend.
**Do not change paths/shapes silently**: update this file and list the frontend files affected.

## 1. Conventions

**Success:** `{ "success": true, "data": <payload> }`
**Paginated success:** `{ "success": true, "data": [ ... ], "pagination": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 } }`
**Error:** `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "location": "body", "path": "email", "message": "..." } ] } }` (`details` optional; no stack traces in production.)

**Money:** integers in **paisa** (NPR; 100 paisa = Rs 1). `29000` = Rs 290.00. Never floats. Format in the UI (`amount / 100`). Payments are made in Nepalese rupees through eSewa.
**Inventory quantities:** integers in base units: `g`, `ml`, `unit`.
**IDs:** 24-hex strings. **Dates:** ISO-8601 UTC.
**Pagination query:** `page` (default 1), `limit` (default 12, max 100).
**Unknown body fields are rejected** (400): the client can never send totals, prices, roles, or statuses.

### Authentication (decided architecture)
- **Access token**: short-lived JWT (default 15 min) returned in the JSON body of login/refresh. Send `Authorization: Bearer <token>`. Keep it **in memory** (not localStorage).
- **Refresh token**: opaque random value in an **HttpOnly cookie** `refresh_token` (path `/api/auth`, SameSite/Secure per env). Rotated on every refresh; replaying an old one revokes the session family.
- Frontend must call fetch/axios with **`credentials: 'include'`** for `/api/auth/*`. On app load and on any `401 TOKEN_INVALID`, call `POST /auth/refresh` once, then retry; if it fails → logged-out.
- Refresh/logout reject browser requests whose `Origin` is not in the CORS allowlist (CSRF defence).

### Enums
| Name | Values |
|---|---|
| `orderStatus` | `pending_payment`, `received`, `kitchen`, `delivery`, `delivered`, `cancelled` |
| `paymentStatus` | `pending`, `paid`, `failed` |
| `role` | `customer`, `admin` |
| pizza `category` | `veg`, `non-veg`, `vegan`, `specialty` |
| option `type` | `base`, `sauce`, `cheese`, `topping` |
| inventory `category` | `dough`, `sauce`, `cheese`, `vegetable`, `meat`, `packaging`, `other` |
| inventory `unit` | `g`, `ml`, `unit` |
| `stockStatus` | `ok`, `low` (stock ≤ threshold), `out` (stock = 0) |

### Order status lifecycle (enforced on the server)
```
pending_payment --(verified payment only)--> received --> kitchen --> delivery --> delivered
pending_payment --> cancelled        received --> cancelled        kitchen --> cancelled
```
Anything else → `409 INVALID_STATUS_TRANSITION`. `pending_payment → received` can only be done by payment verification, never by an API caller. `orderStatus` (fulfilment) and `paymentStatus` (money) are independent fields.

### Common error codes
`VALIDATION_ERROR 400` · `INVALID_JSON 400` · `INVALID_ID 400` · `UNAUTHORIZED 401` · `TOKEN_INVALID 401` · `FORBIDDEN 403` · `EMAIL_NOT_VERIFIED 403` · `NOT_FOUND/…_NOT_FOUND 404` · `CONFLICT-type 409` · `PAYLOAD_TOO_LARGE 413` · `INVALID_CUSTOMIZATION 422` · `RATE_LIMITED 429` · `INTERNAL_ERROR 500` · `PAYMENT_NOT_CONFIGURED 503`.

---
## 2. Auth

### POST `/auth/register` · public (rate limited)
Body: `{ "name": "Asha Rai", "email": "asha@example.com", "password": "Password1" }` (password 8–72 chars, ≥1 letter and ≥1 number).
`201` → `{ "user": User, "message": "..." }`. Sends a verification email. No tokens are issued until login.
Errors: `409 EMAIL_ALREADY_REGISTERED`, `400 VALIDATION_ERROR` (including any extra field such as `role`).

`User` = `{ id, name, email, role, emailVerified, createdAt }`

### POST `/auth/verify-email` · public
Body `{ "token": "<from email link ?token=>" }` → `200 { message }`. Errors: `400 INVALID_OR_EXPIRED_TOKEN` (expired, used, or unknown). Tokens are single-use, valid 24 h. Email link: `{FRONTEND_URL}/verify-email?token=...`.

### POST `/auth/resend-verification` · public
Body `{ "email" }` → always `200 { message }` (does not reveal whether the account exists).

### POST `/auth/login` · public (rate limited)
Body `{ "email", "password" }` → `200 { "user": User, "accessToken": "<jwt>", "expiresIn": "15m" }` + `Set-Cookie: refresh_token`.
Errors: `401 INVALID_CREDENTIALS` (same for unknown email and wrong password), `403 ACCOUNT_DISABLED`.
Unverified users can log in (`user.emailVerified=false`) but cannot place orders.

### POST `/auth/refresh` · cookie
No body. `200` same shape as login (new access token, rotated cookie). `401 REFRESH_TOKEN_INVALID` (cookie cleared).

### POST `/auth/logout` · cookie
`200 { message }`; revokes the refresh-token family and clears the cookie.

### GET `/auth/me` · Bearer
`200 { "user": User }`.

### POST `/auth/forgot-password` · public
Body `{ "email" }` → always `200 { message }`. Email link: `{FRONTEND_URL}/reset-password?token=...` (valid 30 min, single use).

### POST `/auth/reset-password` · public
Body `{ "token", "password" }` → `200 { message }`. All existing sessions (access + refresh) are invalidated. Errors: `400 INVALID_OR_EXPIRED_TOKEN`.

---
## 3. Catalog (public)

`PizzaOption` = `{ id, type, name, price, available }` (price = additional paisa)
`Pizza` = `{ id, name, slug, description, imageUrl, category, basePrice, available, options: { bases: PizzaOption[], sauces: PizzaOption[], cheeses: PizzaOption[], toppings: PizzaOption[] } }`

### GET `/pizzas`
Query: `search`, `category`, `available` (`true|false`), `sort` (`name` default, `price_asc`, `price_desc`, `newest`), `page`, `limit`. → paginated `Pizza[]`.

### GET `/pizzas/:id` → `200 Pizza` (data is the pizza object). `400 VALIDATION_ERROR` bad id, `404 PIZZA_NOT_FOUND`.

### GET `/pizza-options`
Query: `type`, `available`. → `200 PizzaOption[]` (data is an array, not paginated).

Only options listed in a pizza's `options.*` may be chosen with that pizza.

---
## 4. Orders (Bearer)

`Order` = 
```json
{
  "id": "…", "orderNumber": "PZ20261023-A1B2C3",
  "customer": { "id","name","email" },            // admin responses only
  "items": [{
    "pizzaId": "…", "pizzaName": "Margherita", "quantity": 2, "pizzaBasePrice": 19900,
    "base":   { "optionId": "…", "name": "Thin crust", "price": 0 },
    "sauce":  { "optionId","name","price" } | null,
    "cheese": { "optionId","name","price" } | null,
    "toppings": [ { "optionId","name","price" } ],
    "unitPrice": 29000, "lineTotal": 58000
  }],
  "subtotal": 58000, "deliveryFee": 4000, "discount": 0, "total": 62000, "currency": "NPR",
  "delivery": { "fullName","phone","addressLine1","addressLine2?","landmark?","city","state","postalCode","instructions?" },
  "paymentStatus": "pending", "orderStatus": "pending_payment",
  "statusHistory": [ { "status","at","by":"customer|admin|system","note" } ],
  "cancellation": { "reason","at","by" } | null,
  "needsRefund": false,
  "reservedUntil": "ISO date" | null,           // stock hold deadline while pending_payment
  "paidAt": null, "createdAt": "…", "updatedAt": "…"
}
```
Order items are **snapshots**; later menu changes never alter them.

### POST `/orders` · Bearer, **verified email**
Header (recommended): `Idempotency-Key: <8–100 chars [A-Za-z0-9_-:.]>` (generate one per checkout attempt; retries return the same order).
Body:
```json
{
  "items": [{ "pizzaId": "…", "baseId": "…", "sauceId": "…", "cheeseId": "…", "toppingIds": ["…"], "quantity": 2 }],
  "delivery": { "fullName": "Asha Rai", "phone": "9812345678", "addressLine1": "12 Main Road", "city": "Birgunj", "state": "Madhesh", "postalCode": "44300" }
}
```
`baseId` required; `sauceId`, `cheeseId`, `toppingIds` (≤8) optional. 1–20 items, quantity 1–10. `phone` = 10-digit Nepali mobile (`9[78]XXXXXXXX`), `postalCode` = 5 digits.
`201 { "order": Order, "idempotentReplay": false }` (replay → `200`, `idempotentReplay: true`).
Behaviour: server re-prices everything from the DB, **reserves ingredient stock** for `RESERVATION_MINUTES` (default 15), creates the order as `pending_payment`.
Errors: `400 VALIDATION_ERROR` (e.g. client sent `total`), `403 EMAIL_NOT_VERIFIED`, `404 PIZZA_NOT_FOUND`, `422 INVALID_CUSTOMIZATION | PIZZA_UNAVAILABLE | OPTION_UNAVAILABLE`, `409 INSUFFICIENT_STOCK`.

### GET `/orders/my` · Bearer
Query: `status`, `page`, `limit`. → paginated `Order[]` (own orders, newest first).

### GET `/orders/:id` · Bearer → `200 { "order": Order }`. Other users' orders return `404 ORDER_NOT_FOUND`. Poll this endpoint for tracking (latest persisted status).

### POST `/orders/:id/cancel` · Bearer
Body `{ "reason"?: string }`. Only `pending_payment` orders; releases reserved stock. `409 ORDER_NOT_CANCELLABLE` otherwise. Call this if the user abandons checkout.

---
## 5. Payments: eSewa ePay V2 (test mode by default) · Bearer, verified email

Currency is **NPR**. Docs: https://developer.esewa.com.np/pages/Epay-V2. The customer is redirected to eSewa with a **form POST** built by the backend; the secret key never leaves the server.

Checkout flow:
1. `POST /orders` → `order.id` (stock is reserved, `pending_payment`)
2. `POST /payments/esewa/initiate { orderId }` → receive `paymentUrl` + `fields`; POST them as a hidden HTML form (see `frontend/esewa/api.ts: submitEsewaForm`)
3. eSewa redirects the browser to `{ESEWA_SUCCESS_URL}/{orderId}?data=<base64>` on success, or `{ESEWA_FAILURE_URL}/{orderId}` on failure/cancel/pending
4. Success page: `POST /payments/esewa/verify { data }`. Failure page (and polling): `GET /payments/esewa/status?orderId=`
5. Only the **server's** answer decides what the UI shows. Reaching a success URL proves nothing.

### POST `/payments/esewa/initiate`
Body `{ "orderId": "…" }` (unknown fields rejected; there is no way to send an amount) → `200`
```json
{ "provider": "esewa", "environment": "test",
  "paymentUrl": "https://rc-epay.esewa.com.np/api/epay/main/v2/form", "method": "POST",
  "fields": { "amount": "580", "tax_amount": "0", "total_amount": "620", "transaction_uuid": "PZ20261023-A1B2C3-1a2b3c4d",
              "product_code": "EPAYTEST", "product_service_charge": "0", "product_delivery_charge": "40",
              "success_url": "http://localhost:5173/payment/esewa/success/<orderId>",
              "failure_url": "http://localhost:5173/payment/esewa/failure/<orderId>",
              "signed_field_names": "total_amount,transaction_uuid,product_code", "signature": "<base64 hmac>" },
  "orderId": "…", "orderNumber": "PZ…", "transactionUuid": "…", "amount": 62000, "currency": "NPR" }
```
Amounts inside `fields` are decimal rupee **strings** as eSewa expects; `amount` outside is paisa. Every call creates a new attempt with a fresh `transaction_uuid` (never a new order, never a stock change). Errors: `404 ORDER_NOT_FOUND` (also for others' orders), `409 ORDER_ALREADY_PAID | ORDER_NOT_PAYABLE | ORDER_EXPIRED`, `403 EMAIL_NOT_VERIFIED`, `503 PAYMENT_NOT_CONFIGURED`.

### POST `/payments/esewa/verify`
Body `{ "data": "<the Base64 value of the ?data= query parameter, unmodified>" }`. The server (1) decodes it, (2) verifies the HMAC-SHA256 signature over the fields listed in its `signed_field_names` (which must include `transaction_uuid`, `total_amount`, `product_code`, `status`), (3) matches `transaction_uuid` to a payment of **this user**, and `product_code` and `total_amount` to the stored attempt, (4) **calls eSewa's transaction status API** and only marks paid when it returns `COMPLETE` with the same uuid/product/amount.

Result body (all payment endpoints): `{ "paymentStatus", "gatewayStatus", "order": Order | null }`
| `paymentStatus` | HTTP | Meaning / what the UI should do |
|---|---|---|
| `paid` | 200 | Confirmed. `order.paymentStatus=paid`, `orderStatus=received`. |
| `failed` | 200 | eSewa reports CANCELED (or refunded). Order stays `pending_payment` and reserved; offer retry via `initiate`. |
| `pending` | 202 | PENDING/AMBIGUOUS at eSewa. Poll `/status`; do not let the user pay again yet. |
| `not_found` | 202 | eSewa has no such transaction (yet). Same handling as `pending`. |
| `verification_required` | 202 | eSewa's status API was unreachable/timed out. Safe to retry; never treated as paid. |

Errors: `400 INVALID_PAYMENT_RESPONSE | INVALID_SIGNATURE | PRODUCT_CODE_MISMATCH | PAYMENT_AMOUNT_MISMATCH | PAYMENT_MISMATCH`, `404 PAYMENT_NOT_FOUND`, `409 PAYMENT_ALREADY_RECORDED`, `503 VERIFICATION_INCOMPLETE`. Repeating the call (refresh, double tab) is idempotent.

### GET `/payments/esewa/status?orderId=…`
Same result body. Returns `paid` immediately for paid orders; otherwise asks eSewa about the latest unpaid attempt. Use it on the failure/cancel page and for polling.

**No webhook:** eSewa's ePay V2 documentation mentions Instant Payment Notification but does not specify its format, so none is implemented. Browser-less completion is covered by a scheduled reconciliation job (every 2 minutes it re-checks attempts older than 1 minute and younger than 24 h).
If the customer pays twice for one order, the extra payment is stored with `duplicatePayment=true` and the order gets `needsRefund=true` (refund manually in the eSewa merchant portal). A payment that arrives after the stock hold expired re-reserves stock if available, otherwise sets `needsRefund=true`.

---
## 6. Admin (Bearer, role `admin`) → `401` if anonymous, `403` for customers

### GET `/admin/dashboard?days=30` (1–365)
```json
{ "orders": { "total": 0, "awaitingProcessing": 0, "inKitchen": 0, "inDelivery": 0, "delivered": 0, "cancelledPaid": 0, "pendingPayment": 0 },
  "revenue": { "currency": "NPR", "unit": "paisa", "periodDays": 30, "periodAmount": 0, "periodOrders": 0, "todayAmount": 0, "todayOrders": 0 },
  "inventory": { "lowStockCount": 0, "outOfStockCount": 0, "lowStockItems": [ { "id","name","stock","unit","lowStockThreshold","stockStatus" } ] },
  "generatedAt": "…" }
```
`orders.total` counts **paid** orders. **Revenue** = Σ `total` of orders with `paymentStatus=paid` and `orderStatus≠cancelled`, by `paidAt`. Unpaid, failed and cancelled orders never count.

### GET `/admin/orders`
Query: `status`, `paymentStatus`, `search` (order-number substring), `page`, `limit`. → paginated `Order[]` incl. `customer`.

### GET `/admin/orders/:id` → `{ "order": Order & { payments: [{ id, provider, transactionUuid, transactionCode, amount, currency, status, gatewayStatus, verificationStatus, duplicatePayment, failureReason, paidAt }] } }`

### PATCH `/admin/orders/:id/status`
Body `{ "status": "kitchen", "note"?: "…" }` → `200 { "order": Order }`.
Errors: `409 INVALID_STATUS_TRANSITION`, `409 ORDER_NOT_PAID` (fulfilment of unpaid orders), `409 ORDER_STATUS_CONFLICT` (concurrent change, reload). Cancelling a **paid** order sets `needsRefund: true` (refund is issued manually in the eSewa merchant portal).

### Inventory
`InventoryItem` = `{ id, name, category, unit, stock, lowStockThreshold, active, stockStatus, lowStockNotified, updatedAt }`
- `GET /admin/inventory`: query `search`, `category`, `status` (`ok|low|out`), `active`, `page`, `limit` → paginated
- `POST /admin/inventory`: `{ name, category, unit, stock?, lowStockThreshold? }` → `201 { item }`
- `GET /admin/inventory/:id` → `{ item }`
- `PATCH /admin/inventory/:id`: `{ name?, category?, lowStockThreshold?, active? }` → `{ item }` (**stock cannot be patched**)
- `POST /admin/inventory/:id/adjustments`: `{ "change": 500 | -100, "reason": "Delivery received" }` (non-zero integer, reason 3–200 chars) → `{ item }`. `409 INSUFFICIENT_STOCK` if it would go negative.
- `GET /admin/inventory/:id/transactions` → paginated `[{ id, item, type, quantityChange, reason, order, actor:{kind,user}, createdAt }]`, `type` ∈ `initial|restock|adjustment|order_reserve|order_release`.

---
## 7. Health (public)
- `GET /health` → `200 { status: "ok", uptimeSeconds, timestamp }`
- `GET /health/ready` → `200` when MongoDB is reachable, else `503` with `checks.database: "down"`.

## 8. Frontend integration notes
- Set `VITE_API_URL=http://localhost:5000/api`; **never** put the eSewa secret key or JWT secrets in the frontend. The frontend only receives the already-signed form fields.
- Backend `FRONTEND_URL`/`CORS_ORIGINS` must contain the exact frontend origin (credentials are enabled).
- Add frontend routes `/payment/esewa/success/:orderId` and `/payment/esewa/failure/:orderId`; drop-in components are in `frontend/esewa/`.
- Remove the Razorpay Checkout script and button.

### Changes from the Razorpay version (frontend files to update)
`/payments/create-order`, `/payments/verify` (Razorpay shape) and `/payments/webhook` are **removed**. Currency is now `NPR`/paisa; phone validation is Nepali (`9[78]\d{8}`) and postal code is 5 digits. Checkout/payment components, the order-confirmation page and any `INR`/`₹` formatting must change accordingly.
