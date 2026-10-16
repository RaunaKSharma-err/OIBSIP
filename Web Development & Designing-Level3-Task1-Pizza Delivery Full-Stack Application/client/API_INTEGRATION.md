# API Integration Notes

This document describes the API contract expected by the PizzaHub frontend.
The backend is developed separately using Node.js, Express.js, and MongoDB.

> **Status:** All endpoints below are **proposed contracts**. None have been
> implemented or tested yet. The frontend uses mock data (`VITE_USE_MOCK=true`)
> until the backend is ready.

---

## Base URL

```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Authentication

- **Strategy:** Bearer token (JWT)
- The frontend stores the token in `localStorage` and sends it as
  `Authorization: Bearer <token>` on every request.
- If the backend uses HttpOnly cookies instead, update `apiClient` to use
  `credentials: 'include'` and remove the manual token handling.

### Standard Error Format

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": {
    "field": "field-specific error"
  }
}
```

---

## Auth Endpoints

### POST /auth/register
**Body:** `{ name, email, password }`
**Response:** `{ user, token, message }`

### POST /auth/login
**Body:** `{ email, password, rememberMe? }`
**Response:** `{ user, token }`
- User `role` field is `"customer"` or `"admin"`.

### GET /auth/me
**Auth:** Bearer token
**Response:** `User`

### POST /auth/verify-email
**Body:** `{ token }`
**Response:** `{ message }`

### POST /auth/forgot-password
**Body:** `{ email }`
**Response:** `{ message }`

### POST /auth/reset-password
**Body:** `{ token, password }`
**Response:** `{ message }`

### POST /auth/logout
**Auth:** Bearer token
**Response:** `{ message }`

---

## Pizza Endpoints

### GET /pizzas
**Query:** `search, category, isAvailable, sortBy, page, limit`
**Response:** `PaginatedResponse<Pizza>`

### GET /pizzas/:id
**Response:** `Pizza`

### GET /pizzas/featured
**Response:** `Pizza[]`

### GET /pizzas/customizations
**Response:** `CustomizationOptions` (bases, sauces, cheeses, toppings, sizes)

---

## Order Endpoints

### POST /orders
**Auth:** Bearer token (customer)
**Body:** `CreateOrderRequest`
**Response:** `Order`

### GET /orders
**Auth:** Bearer token (customer)
**Response:** `Order[]` (current user's orders)

### GET /orders/:id
**Auth:** Bearer token (customer)
**Response:** `Order`

### GET /orders/admin/all
**Auth:** Bearer token (admin role)
**Query:** `status, search, page, limit`
**Response:** `{ data: Order[], total, page, totalPages }`

### PATCH /orders/:id/status
**Auth:** Bearer token (admin role)
**Body:** `{ status }`
**Response:** `Order`

---

## Order Status Values

```
received → kitchen → delivery → delivered
```
Cancelled orders: `cancelled`

## Payment Status Values

```
pending | paid | failed | refunded
```

---

## Payment Endpoints

### POST /payments/create
**Auth:** Bearer token
**Body:** `{ orderId, amount }`
**Response:** `{ razorpayOrderId, amount, currency, keyId }`

### POST /payments/verify
**Auth:** Bearer token
**Body:** `{ razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId }`
**Response:** `{ verified, orderId, paymentStatus }`

> The Razorpay **secret key** must never be in frontend env vars.
> Only the public key ID (`VITE_RAZORPAY_KEY_ID`) is used client-side.

---

## Inventory Endpoints (Admin only)

### GET /inventory
**Auth:** Bearer token (admin)
**Query:** `search, category, stockCondition, page, limit`
**Response:** `PaginatedResponse<InventoryItem>`

### GET /inventory/:id
**Auth:** Bearer token (admin)
**Response:** `InventoryItem`

### POST /inventory/adjust
**Auth:** Bearer token (admin)
**Body:** `{ itemId, adjustment, reason? }`
**Response:** `{ item, previousQuantity, newQuantity }`

---

## Admin Dashboard

### GET /admin/dashboard
**Auth:** Bearer token (admin)
**Response:** `DashboardData`

---

## Pagination Format

```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

## CORS Notes

If using bearer tokens (not cookies), standard CORS is sufficient.
If switching to HttpOnly cookies, the backend must set:
- `Access-Control-Allow-Origin` to the frontend origin (not `*`)
- `Access-Control-Allow-Credentials: true`
