# PizzaHub — Project Documentation

A full-stack pizza delivery web application with a customer storefront and an admin management dashboard. Built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui. Features a futuristic dark obsidian theme with tomato-red accents.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment Configuration](#environment-configuration)
4. [Routing & Route Guards](#routing--route-guards)
5. [State Management](#state-management)
6. [API Layer & Endpoints](#api-layer--endpoints)
7. [Service Layer](#service-layer)
8. [Type System](#type-system)
9. [Feature Pages](#feature-pages)
10. [Design System](#design-system)
11. [Mock Mode](#mock-mode)
12. [Payment Integration (Razorpay)](#payment-integration-razorpay)
13. [Form Validation](#form-validation)
14. [Build & Scripts](#build--scripts)

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Bundler | Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Routing | React Router DOM 7 |
| Server State | TanStack React Query 5 |
| Client State | Zustand 5 (with persist middleware) |
| Forms | React Hook Form + Zod |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Toasts | Sonner |
| Payments | Razorpay Checkout SDK |
| Fonts | Space Grotesk (display) + Inter (body) |

---

## Project Structure

```
src/
├── app/                          # Application shell
│   ├── providers.tsx             # QueryClient + Tooltip + Toaster providers
│   ├── router.tsx                # All route definitions
│   ├── route-guards.tsx          # ProtectedRoute, AdminRoute, PublicOnlyRoute
│   └── error-pages.tsx           # 404 + Unauthorized pages
│
├── components/
│   ├── feedback/
│   │   ├── states.tsx            # LoadingState, ErrorState, EmptyState, PageSkeleton
│   │   └── page-placeholder.tsx  # Placeholder for unimplemented pages
│   ├── layout/
│   │   ├── customer-layout.tsx   # Navbar + footer + cart drawer
│   │   └── admin-layout.tsx      # Sidebar + topbar (admin)
│   └── ui/                       # shadcn/ui primitives (60+ components)
│       ├── button.tsx, card.tsx, input.tsx, badge.tsx, ...
│       ├── dialog.tsx, sheet.tsx, select.tsx, table.tsx, ...
│       └── toast.tsx, sonner.tsx, tooltip.tsx, ...
│
├── features/                     # Feature modules (pages)
│   ├── auth/
│   │   ├── auth-pages.tsx        # Login, Register, VerifyEmail, ForgotPassword, ResetPassword, AdminLogin
│   │   └── profile-page.tsx      # User profile view + edit
│   ├── cart/
│   │   └── cart-page.tsx         # Cart with quantity controls, free-delivery progress
│   ├── checkout/
│   │   └── checkout-page.tsx     # Delivery info form + payment method + order placement
│   ├── customization/
│   │   └── pizza-details-page.tsx # Pizza configurator (size, base, sauce, cheese, toppings)
│   ├── dashboard/
│   │   └── admin-pages.tsx       # AdminDashboard, AdminOrders, AdminOrderDetails, AdminInventory, AdminSettings
│   ├── menu/
│   │   ├── home-page.tsx         # Landing page with hero, featured pizzas, how-it-works
│   │   └── menu-page.tsx         # Menu with search, filters, sorting, pagination
│   └── orders/
│       └── order-pages.tsx       # OrderHistory list + OrderDetails with tracking timeline
│
├── hooks/
│   └── use-toast.ts              # Legacy toast hook (shadcn)
│
├── lib/
│   ├── api-client.ts             # Fetch wrapper with auth, timeout, error handling
│   ├── auth-store.ts             # Zustand auth store (persisted)
│   ├── cart-store.ts             # Zustand cart store (persisted)
│   ├── config.ts                 # Environment config reader
│   ├── format.ts                 # Currency, date, stock-condition formatters
│   ├── query-client.ts           # React Query client config
│   ├── utils.ts                  # cn() class merge utility
│   └── validators.ts             # Zod schemas for all forms
│
├── services/                     # API service layer
│   ├── auth.service.ts
│   ├── pizza.service.ts
│   ├── order.service.ts
│   ├── payment.service.ts
│   ├── admin.service.ts
│   ├── inventory.service.ts
│   └── mock-data.ts              # Mock pizzas + customization options
│
├── types/                        # TypeScript type definitions
│   ├── auth.ts
│   ├── pizza.ts
│   ├── order.ts
│   ├── payment.ts
│   ├── inventory.ts
│   ├── dashboard.ts
│   └── index.ts                  # Re-exports all types
│
├── App.tsx                       # Root component (mounts AppRouter)
├── App.css                       # Empty (Tailwind handles styles)
├── index.css                     # Global styles, CSS variables, design tokens
└── main.tsx                      # Entry point (mounts <App />)
```

---

## Environment Configuration

Config is read from Vite env variables in `src/lib/config.ts`:

```typescript
export const config = {
  apiBaseUrl: env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  useMock: env.VITE_USE_MOCK === 'true',
  razorpayKeyId: env.VITE_RAZORPAY_KEY_ID || '',
  isDev: env.DEV ?? false,
};
```

### `.env` Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |
| `VITE_USE_MOCK` | Set to `"true"` to use mock data instead of real API | `false` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key ID for checkout | `""` |

---

## Routing & Route Guards

All routes are defined in `src/app/router.tsx` using `createBrowserRouter`.

### Customer Routes (wrapped in `CustomerLayout`)

| Path | Page | Access |
|---|---|---|
| `/` | HomePage | Public |
| `/menu` | MenuPage | Public |
| `/pizza/:id` | PizzaDetailsPage | Public |
| `/cart` | CartPage | Public |
| `/login` | LoginPage | Public only (redirects if logged in) |
| `/register` | RegisterPage | Public only |
| `/verify-email` | VerifyEmailPage | Public only |
| `/forgot-password` | ForgotPasswordPage | Public only |
| `/reset-password` | ResetPasswordPage | Public only |
| `/checkout` | CheckoutPage | **Authenticated** |
| `/orders` | OrderHistoryPage | **Authenticated** |
| `/orders/:id` | OrderDetailsPage | **Authenticated** |
| `/profile` | ProfilePage | **Authenticated** |

### Admin Routes (wrapped in `AdminLayout`)

| Path | Page | Access |
|---|---|---|
| `/admin/login` | AdminLoginPage | Public |
| `/admin/dashboard` | AdminDashboardPage | **Admin only** |
| `/admin/orders` | AdminOrdersPage | **Admin only** |
| `/admin/orders/:id` | AdminOrderDetailsPage | **Admin only** |
| `/admin/inventory` | AdminInventoryPage | **Admin only** |
| `/admin/settings` | AdminSettingsPage | **Admin only** |

### Error Routes

| Path | Page |
|---|---|
| `/unauthorized` | UnauthorizedPage |
| `*` (catch-all) | NotFoundPage |

### Route Guards (`src/app/route-guards.tsx`)

- **`ProtectedRoute`** — Redirects to `/login` if not authenticated. Used for checkout, orders, profile.
- **`AdminRoute`** — Redirects to `/admin/login` if not authenticated, to `/unauthorized` if authenticated but not admin. Used for all `/admin/*` routes.
- **`PublicOnlyRoute`** — Redirects authenticated users to `/` (customer) or `/admin/dashboard` (admin). Used for login, register, etc.

---

## State Management

### Auth Store (`src/lib/auth-store.ts`)

Zustand store with `persist` middleware (localStorage key: `auth-session`).

| Field | Type | Description |
|---|---|---|
| `user` | `User \| null` | Current user object |
| `token` | `string \| null` | JWT auth token |
| `isAuthenticated` | `boolean` | Derived from token presence |
| `isAdmin` | `boolean` | Derived from `user.role === 'admin'` |

| Action | Description |
|---|---|
| `setSession(user, token)` | Sets user + token, writes token to localStorage |
| `updateUser(partial)` | Merges partial user updates |
| `logout()` | Clears user + token, removes from localStorage |

### Cart Store (`src/lib/cart-store.ts`)

Zustand store with `persist` middleware (localStorage key: `pizza-cart`).

| Field | Type | Description |
|---|---|---|
| `items` | `CartItem[]` | Array of cart items with full customization config |

| Action | Description |
|---|---|
| `addItem(item)` | Adds item; merges if identical config already exists (same pizza + size + base + sauce + cheese + toppings) |
| `updateQuantity(itemId, qty)` | Updates quantity; removes item if qty drops to 0 |
| `removeItem(itemId)` | Removes item from cart |
| `clearCart()` | Empties the cart |
| `getTotalItems()` | Returns total quantity across all items |
| `getSubtotal()` | Returns sum of all `item.totalPrice` |

---

## API Layer & Endpoints

### API Client (`src/lib/api-client.ts`)

A fetch-based HTTP client with:

- Automatic JSON serialization/deserialization
- Bearer token injection from localStorage
- Request timeout (15s default, configurable)
- Structured error handling via `ApiError` class (status, code, details)
- Auto-clears token on 401 responses
- Query param serialization
- AbortSignal support

```typescript
apiClient.get<T>(path, options)
apiClient.post<T>(path, body, options)
apiClient.put<T>(path, body, options)
apiClient.patch<T>(path, body, options)
apiClient.delete<T>(path, options)
```

### Expected Backend Endpoints

All endpoints are relative to `config.apiBaseUrl` (default: `http://localhost:5000/api`).

#### Authentication

| Method | Endpoint | Request Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password, rememberMe? }` | `{ user, token }` |
| POST | `/auth/register` | `{ name, email, password }` | `{ user, token, message }` |
| POST | `/auth/verify-email` | `{ token }` | `{ message }` |
| POST | `/auth/forgot-password` | `{ email }` | `{ message }` |
| POST | `/auth/reset-password` | `{ token, password }` | `{ message }` |
| GET | `/auth/me` | — | `User` |
| POST | `/auth/logout` | — | `void` |

#### Pizzas

| Method | Endpoint | Query Params | Response |
|---|---|---|---|
| GET | `/pizzas` | `search?, category?, isAvailable?, sortBy?, page?, limit?` | `PaginatedResponse<Pizza>` |
| GET | `/pizzas/:id` | — | `Pizza` |
| GET | `/pizzas/featured` | — | `Pizza[]` |
| GET | `/pizzas/customizations` | — | `CustomizationOptions` |

#### Orders (Customer)

| Method | Endpoint | Request Body / Params | Response |
|---|---|---|---|
| GET | `/orders` | — | `Order[]` |
| GET | `/orders/:id` | — | `Order` |
| POST | `/orders` | `CreateOrderRequest` | `Order` |

#### Orders (Admin)

| Method | Endpoint | Query Params | Response |
|---|---|---|---|
| GET | `/orders/admin/all` | `status?, search?, page?, limit?` | `{ data: Order[], total, page, totalPages }` |
| PATCH | `/orders/:id/status` | `{ status: OrderStatus }` | `Order` |

#### Payments (Razorpay)

| Method | Endpoint | Request Body | Response |
|---|---|---|---|
| POST | `/payments/create` | `{ orderId, amount }` | `{ razorpayOrderId, amount, currency, keyId }` |
| POST | `/payments/verify` | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId }` | `{ verified, orderId, paymentStatus }` |

#### Admin Dashboard

| Method | Endpoint | Response |
|---|---|---|
| GET | `/admin/dashboard` | `DashboardData` |

#### Inventory

| Method | Endpoint | Query / Body | Response |
|---|---|---|---|
| GET | `/inventory` | `search?, category?, stockCondition?, page?, limit?` | `PaginatedResponse<InventoryItem>` |
| GET | `/inventory/:id` | — | `InventoryItem` |
| POST | `/inventory/adjust` | `{ itemId, adjustment, reason? }` | `{ item, previousQuantity, newQuantity }` |

---

## Service Layer

Each service wraps the API client and transparently falls back to mock data when `config.useMock === true`.

### `auth.service.ts`
- `login(data)` → POST `/auth/login`
- `register(data)` → POST `/auth/register`
- `verifyEmail(data)` → POST `/auth/verify-email`
- `forgotPassword(data)` → POST `/auth/forgot-password`
- `resetPassword(data)` → POST `/auth/reset-password`
- `getProfile()` → GET `/auth/me`
- `logout()` → POST `/auth/logout`
- **Mock behavior**: Emails starting with `admin` get admin role; others get customer role.

### `pizza.service.ts`
- `getPizzas(params)` → GET `/pizzas` with search, category, sort, pagination
- `getPizza(id)` → GET `/pizzas/:id`
- `getFeaturedPizzas()` → GET `/pizzas/featured`
- `getCustomizationOptions()` → GET `/pizzas/customizations`
- **Mock behavior**: Filters/sorts 10 mock pizzas; featured = popular ones.

### `order.service.ts`
- `getOrders()` → GET `/orders`
- `getOrder(id)` → GET `/orders/:id`
- `createOrder(data)` → POST `/orders`
- `updateOrderStatus({ orderId, status })` → PATCH `/orders/:id/status`
- `getAllOrdersAdmin(params)` → GET `/orders/admin/all` with status filter, search, pagination
- `getOrderTrackingSteps(order)` → Returns tracking timeline: Received → Kitchen → Delivery → Delivered

### `payment.service.ts`
- `createPayment(data)` → POST `/payments/create`
- `verifyPayment(data)` → POST `/payments/verify`
- `openCheckout(options)` → Loads Razorpay SDK, opens checkout modal, resolves with `{ razorpayPaymentId, razorpaySignature }`
- **Mock behavior**: Returns fake order ID and always verifies as `paid`.

### `admin.service.ts`
- `getDashboardData()` → GET `/admin/dashboard`
- **Mock behavior**: Returns 348 total orders, ₹1,84,750 revenue, 5 recent orders, 4 low-stock items.

### `inventory.service.ts`
- `getInventory(params)` → GET `/inventory` with search, category, stock condition, pagination
- `getItem(id)` → GET `/inventory/:id`
- `adjustStock(data)` → POST `/inventory/adjust`
- **Mock behavior**: 10 mock inventory items across categories (Base, Cheese, Sauce, Vegetable, Meat, Herb, Oil, Packaging).

---

## Type System

### Auth Types (`src/types/auth.ts`)

```
User          → { id, name, email, role: 'customer'|'admin', phone?, isEmailVerified, createdAt }
LoginRequest  → { email, password, rememberMe? }
RegisterRequest → { name, email, password }
```

### Pizza Types (`src/types/pizza.ts`)

```
PizzaCategory → 'classic' | 'veg' | 'non-veg' | 'gourmet' | 'custom'
Pizza         → { id, name, description, image, category, basePrice, isAvailable, isPopular, rating?, prepTimeMinutes?, sizes[], defaultToppingIds[], ingredients? }
CustomizationOptions → { bases[], sauces[], cheeses[], toppings[], sizes[] }
MenuQueryParams → { search?, category?, isAvailable?, sortBy?, page?, limit? }
PaginatedResponse<T> → { data: T[], total, page, limit, totalPages }
```

### Order Types (`src/types/order.ts`)

```
OrderStatus    → 'received' | 'kitchen' | 'delivery' | 'delivered' | 'cancelled'
PaymentStatus  → 'pending' | 'paid' | 'failed' | 'refunded'
PaymentMethod  → 'razorpay' | 'cod'
CartItem       → { id, pizzaId, pizzaName, pizzaImage, basePrice, sizeName?, sizePriceMultiplier, baseName?, basePriceAddon, sauceName?, saucePriceAddon, cheeseName?, cheesePriceAddon, toppings[], quantity, unitPrice, totalPrice, isCustom }
Order          → { id, orderNumber, userId, items[], subtotal, deliveryCharge, discount, total, paymentStatus, paymentMethod, orderStatus, deliveryInfo, razorpayOrderId?, razorpayPaymentId?, createdAt, updatedAt, estimatedDeliveryTime? }
CreateOrderRequest → { items[], deliveryInfo, paymentMethod, couponCode? }
OrderTrackingStep → { status, label, description, isCompleted, isCurrent, timestamp? }
```

### Payment Types (`src/types/payment.ts`)

```
CreatePaymentRequest  → { orderId, amount }
CreatePaymentResponse → { razorpayOrderId, amount, currency, keyId }
VerifyPaymentRequest  → { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId }
VerifyPaymentResponse → { verified, orderId, paymentStatus }
```

### Inventory Types (`src/types/inventory.ts`)

```
StockCondition → 'healthy' | 'low' | 'out'
InventoryItem  → { id, name, category, unit, quantity, lowStockThreshold, lastUpdated, updatedBy? }
InventoryAdjustmentRequest → { itemId, adjustment, reason? }
```

### Dashboard Types (`src/types/dashboard.ts`)

```
DashboardStats → { totalOrders, pendingOrders, preparingOrders, outForDelivery, lowStockCount, revenue }
DashboardData  → { stats, orderStatusDistribution[], recentOrders[], lowStockItems[] }
```

---

## Feature Pages

### Customer Pages

#### HomePage (`/`)
- Cinematic hero section with pizza imagery and CTA buttons
- Featured pizzas carousel (fetches `getFeaturedPizzas()`)
- "How it works" 3-step section (Browse → Customize → Order)
- Custom pizza CTA with chef imagery

#### MenuPage (`/menu`)
- Search bar with live filtering
- Category filter chips (All, Classic, Veg, Non-Veg, Gourmet)
- Sort dropdown (Popular, Price Low→High, Price High→Low, Name)
- Animated product grid with hover elevation
- Pagination controls
- Uses React Query with `placeholderData` for smooth pagination transitions

#### PizzaDetailsPage (`/pizza/:id`)
- Full pizza configurator:
  - Size selection (with price multiplier)
  - Base selection
  - Sauce selection
  - Cheese selection
  - Topping selection (multi-select with price add-ons)
- Real-time price calculation
- Quantity selector
- "Add to Cart" button with toast confirmation
- Fetches pizza details + customization options in parallel

#### CartPage (`/cart`)
- List of cart items with full customization details
- Quantity increment/decrement controls
- Remove item button
- Free-delivery progress indicator (₹500 threshold)
- Subtotal, delivery charge, total breakdown
- "Proceed to Checkout" button (requires auth)

#### CheckoutPage (`/checkout`) — *Protected*
- Delivery information form (name, phone, address, city, instructions)
- Payment method selection (Razorpay or Cash on Delivery)
- Order summary with item count, subtotal, delivery, total
- On submit: creates order → (if Razorpay) creates payment → opens Razorpay checkout → verifies payment → shows success screen
- Handles payment failure with retry option
- Three-step internal state: `details` → `processing` → `success` / `error`

#### OrderHistoryPage (`/orders`) — *Protected*
- List of all user orders sorted by date
- Each card shows: order number, date, item summary, total, status badges
- Auto-fetches on mount; refetches when window regains focus

#### OrderDetailsPage (`/orders/:id`) — *Protected*
- Full order details with visual tracking timeline (4 steps)
- Auto-refreshes every 15 seconds while order is active (received/kitchen/delivery)
- Item list with images and pricing breakdown
- Delivery information card
- Status badge + payment badge

#### ProfilePage (`/profile`) — *Protected*
- Avatar with user initial
- Account info (name, email, role badge, verification status)
- Edit form (name, phone — email is read-only)
- Account metadata (member since date)
- "View My Orders" link
- "Log Out" button

### Auth Pages

#### LoginPage (`/login`)
- Email + password form with "Remember Me" checkbox
- Zod validation
- Redirects to `/` (customer) or `/admin/dashboard` (admin) on success
- Link to register and forgot-password

#### RegisterPage (`/register`)
- Name + email + password + confirm-password form
- Zod validation with password match check
- Redirects to verify-email page on success

#### VerifyEmailPage (`/verify-email`)
- Token input form
- Shows success confirmation after verification

#### ForgotPasswordPage (`/forgot-password`)
- Email input; sends reset link

#### ResetPasswordPage (`/reset-password`)
- Token + new password + confirm password

#### AdminLoginPage (`/admin/login`)
- Separate login for admins
- Same auth backend; redirects to `/admin/dashboard` on success

### Admin Pages

#### AdminDashboardPage (`/admin/dashboard`)
- 4 stat cards: Total Revenue, Total Orders, Pending Orders, Out for Delivery
- Order Status Distribution pie chart (Recharts)
- Low Stock Alerts panel with item list and link to inventory
- Recent Orders table (5 most recent)

#### AdminOrdersPage (`/admin/orders`)
- Search by order number or customer name
- Filter by order status (dropdown)
- Paginated orders table with columns: Order #, Customer, Items, Total, Payment, Status, Date, View link

#### AdminOrderDetailsPage (`/admin/orders/:id`)
- Full order items with pricing breakdown
- Status update buttons (received → kitchen → delivery → delivered / cancelled)
- Customer info card (name, phone, address, instructions)
- Payment method + status display

#### AdminInventoryPage (`/admin/inventory`)
- Search by item name
- Filter by category and stock condition (healthy/low/out)
- Inventory table: Item, Category, Quantity, Stock Level badge, Last Updated, Adjust button
- Adjust Stock dialog: increment/decrement with reason field, shows new quantity preview

#### AdminSettingsPage (`/admin/settings`)
- Tabbed interface: General, Delivery, Notifications
- General: Restaurant name, currency (read-only)
- Delivery: Delivery charge, free-delivery threshold, minimum order value
- Notifications: Toggle list (currently static/disabled)

---

## Design System

### Theme: "Futuristic Neo-Premium — Dark Obsidian"

Defined in `src/index.css` as HSL CSS variables and consumed via Tailwind classes.

### Color Palette

| Token | HSL | Usage |
|---|---|---|
| `--background` | `220 14% 5%` | Page background (near-black) |
| `--foreground` | `38 22% 94%` | Body text (warm white) |
| `--card` | `222 12% 9%` | Card surfaces |
| `--popover` | `222 14% 8%` | Dropdowns, popovers |
| `--primary` | `2 100% 61%` | Tomato red — buttons, links, accents |
| `--secondary` | `222 10% 14%` | Muted surfaces |
| `--muted` | `222 10% 14%` | Muted backgrounds |
| `--muted-foreground` | `220 8% 55%` | Secondary text |
| `--accent` | `222 10% 17%` | Hover surfaces |
| `--success` | `156 64% 54%` | Success states (green) |
| `--warning` | `36 100% 62%` | Warning states (amber) |
| `--destructive` | `355 100% 67%` | Error states (red) |
| `--border` | `220 12% 16%` | Borders, dividers |
| `--ring` | `2 100% 61%` | Focus ring |

### Typography

- **Display font**: Space Grotesk (400, 500, 600, 700) — headings, titles, brand
- **Body font**: Inter (400, 500, 600, 700) — body text, UI elements
- Line height: 150% body, 120% headings
- Max 3 font weights per element

### Custom CSS Utilities

| Class | Description |
|---|---|
| `.glass-surface` | Translucent backdrop-blur surface |
| `.card-glow` | Subtle box-shadow for elevated cards |
| `.card-glow-hover` | Hover state with red-tinted glow shadow |
| `.ambient-gradient` | Radial gradient background (red + green tints) |
| `.gradient-text` | Foreground→primary gradient text |
| `.shimmer` | Shimmer animation for skeleton loading |
| `.scrollbar-hide` | Hide scrollbar on horizontal scroll containers |

### Animations (Tailwind keyframes)

| Animation | Duration | Usage |
|---|---|---|
| `fade-in` | 0.4s | Page transitions, state changes |
| `fade-in-up` | 0.5s | Initial page load, hero content |
| `scale-in` | 0.3s | Modals, dialogs |
| `slide-in-right` | 0.4s | Cart drawer, side panels |
| `glow-pulse` | 3s infinite | Primary CTA buttons |
| `shimmer` | 1.5s infinite | Skeleton loading states |

### Responsive Breakpoints

Standard Tailwind breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).

### Spacing

8px base spacing system via Tailwind's default spacing scale.

---

## Mock Mode

When `VITE_USE_MOCK=true` is set in `.env`, all services return mock data instead of making real API calls. This allows the frontend to run standalone without a backend.

### Mock Data Available

- **10 pizzas** across 5 categories with images, prices, sizes, and toppings
- **Customization options**: 4 bases, 4 sauces, 4 cheeses, 8+ toppings, 3 sizes
- **2 sample orders** with different statuses (delivery, received)
- **10 inventory items** with varying stock levels
- **Dashboard data**: 348 orders, ₹1,84,750 revenue, 5 recent orders, 4 low-stock items

### Mock Auth Behavior

- Email starting with `admin` (e.g., `admin@test.com`) → admin role
- Any other email → customer role
- Any password is accepted (min 6 chars per Zod validation)
- Token format: `mock-token-{userId}`

---

## Payment Integration (Razorpay)

### Flow

1. User completes checkout form and clicks "Place Order"
2. If payment method is **Razorpay**:
   - `orderService.createOrder()` creates the order (status: received, payment: pending)
   - `paymentService.createPayment()` calls backend to create a Razorpay order
   - `paymentService.openCheckout()` loads the Razorpay checkout.js SDK and opens the payment modal
   - On successful payment, `paymentService.verifyPayment()` sends the payment signature to backend for verification
   - Backend marks payment as `paid`; frontend shows success screen
   - On payment failure or modal dismissal, error screen is shown with retry option
3. If payment method is **COD**:
   - Order is created with `paymentMethod: 'cod'`, `paymentStatus: 'pending'`
   - Success screen is shown directly

### Razorpay SDK Loading

The SDK is loaded dynamically by injecting `https://checkout.razorpay.com/v1/checkout.js` into the DOM on first use. It's cached for subsequent calls.

### Theme Color

Razorpay checkout modal uses `#C62828` (dark red) as the theme color.

---

## Form Validation

All forms use React Hook Form with Zod schemas defined in `src/lib/validators.ts`:

| Schema | Fields | Rules |
|---|---|---|
| `loginSchema` | email, password, rememberMe | Valid email, password ≥ 6 chars |
| `registerSchema` | name, email, password, confirmPassword | Name ≥ 2 chars, valid email, password ≥ 6 chars, passwords match |
| `forgotPasswordSchema` | email | Valid email |
| `resetPasswordSchema` | token, password, confirmPassword | Token required, password ≥ 6 chars, passwords match |
| `deliveryInfoSchema` | name, phone, address, city, instructions | Name ≥ 2, phone 10-15 chars with regex, address ≥ 10 chars, city ≥ 2 chars, instructions ≤ 200 chars |
| `inventoryAdjustmentSchema` | adjustment, reason | Integer ≠ 0, reason ≤ 200 chars |

---

## Build & Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start dev server (HMR) |
| `build` | `tsc -b && vite build` | Type-check + production build |
| `lint` | `eslint .` | Run ESLint |
| `preview` | `vite preview` | Preview production build locally |
| `typecheck` | `tsc --noEmit -p tsconfig.app.json` | Type-check only (no output) |

### Key Configuration Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite config (React plugin, path aliases) |
| `tailwind.config.js` | Tailwind theme (fonts, colors, animations, breakpoints) |
| `tsconfig.json` | Root TS config (references app + node configs) |
| `tsconfig.app.json` | App TS config (JSX, path aliases `@/*`) |
| `postcss.config.js` | PostCSS (Tailwind + Autoprefixer) |
| `eslint.config.js` | ESLint flat config (TS + React hooks + refresh) |
| `components.json` | shadcn/ui component config |

### Path Aliases

- `@/*` → `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`)

---

## What's Done (Feature Checklist)

### Customer Storefront

- [x] Landing page with hero, featured pizzas, how-it-works
- [x] Menu page with search, category filter, sort, pagination
- [x] Pizza details page with full customization configurator
- [x] Cart with quantity controls, free-delivery progress, item merging
- [x] Checkout with delivery form, payment method selection, order creation
- [x] Razorpay payment integration (create → checkout → verify)
- [x] Cash on Delivery support
- [x] Order history list
- [x] Order details with live tracking timeline (auto-refresh)
- [x] User profile with edit functionality
- [x] Auth: Login, Register, Email Verification, Forgot/Reset Password
- [x] Protected routes (checkout, orders, profile)

### Admin Dashboard

- [x] Admin login (separate page)
- [x] Admin route guard (role-based access)
- [x] Dashboard with stats, pie chart, low-stock alerts, recent orders
- [x] Orders management with search, filter, pagination
- [x] Order details with status update buttons
- [x] Inventory management with search, filter, stock adjustment dialog
- [x] Settings page with tabs (General, Delivery, Notifications)

### Design & UX

- [x] Futuristic dark obsidian theme with tomato-red accents
- [x] Space Grotesk + Inter typography
- [x] Glass surfaces, ambient gradients, card glow effects
- [x] Shimmer skeleton loading states
- [x] Fade-in, scale-in, slide-in animations
- [x] Responsive across mobile, tablet, desktop
- [x] Reduced-motion support
- [x] Custom scrollbar styling
- [x] Premium toast notifications (Sonner)

### Infrastructure

- [x] Centralized API client with auth, timeout, error handling
- [x] Zustand stores with localStorage persistence (auth + cart)
- [x] React Query for server state with placeholder data
- [x] Zod form validation across all forms
- [x] Mock mode for standalone frontend development
- [x] TypeScript strict typing throughout
- [x] 60+ shadcn/ui components installed
- [x] Error pages (404, Unauthorized)

### Not Yet Implemented

- [ ] Real backend API (currently mock or expected at `localhost:5000/api`)
- [ ] Coupon code application at checkout (field exists, logic not wired)
- [ ] Admin settings save (currently simulates with setTimeout)
- [ ] Notification preferences (static/disabled)
- [ ] Order cancellation by customer
- [ ] Real-time order updates (currently polling every 15s)
- [ ] Email sending (verification, reset links)
- [ ] Image upload for custom pizzas
- [ ] User address book (single address per order)
