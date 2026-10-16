# PizzaHub — Pizza Delivery & Inventory Management

A full-stack pizza delivery and inventory management system built as part of the
Oasis Infobyte Web Development and Designing Internship.

## Project Overview

PizzaHub is a premium online pizza ordering platform where customers can browse
pizzas, customize their orders, complete checkout, and track delivery. It also
includes a separate admin dashboard for managing orders and inventory.

The **frontend** (this repository) is built with React, TypeScript, and Vite.
The **backend** is developed separately using Node.js, Express.js, and MongoDB.

## Features

### Customer Application
- Browse featured and popular pizzas on the homepage
- Full menu with search, category filter, availability filter, and sorting
- Pizza details with customization (base, sauce, cheese, toppings, size)
- Interactive cart with quantity adjustment and persistence across refreshes
- Multi-section checkout with delivery information and payment
- Order history and real-time order tracking (Received → Kitchen → Delivery)
- Customer authentication (register, login, email verification, password reset)
- Profile management

### Admin Application
- Protected admin dashboard with operational metrics
- Order management with search, filters, and status updates
- Inventory management with stock-level indicators and manual adjustments
- Low-stock alerts and dashboard summary cards

## Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for routing
- **Tailwind CSS** for styling
- **shadcn/ui** for component primitives
- **Lucide React** for icons
- **TanStack Query** for server-state management
- **Zustand** for cart and auth client state
- **React Hook Form + Zod** for form validation
- **Recharts** for dashboard charts
- **Razorpay** (test mode) for payments

## Folder Structure

```
src/
├── app/              # Router, providers, route guards, error pages
├── components/
│   ├── ui/           # shadcn/ui component primitives
│   ├── layout/       # Customer and admin layouts
│   └── feedback/     # Loading, error, empty states
├── features/         # Feature-based page components
│   ├── auth/
│   ├── cart/
│   ├── checkout/
│   ├── customization/
│   ├── dashboard/
│   ├── menu/
│   └── orders/
├── hooks/            # Custom React hooks
├── lib/              # Config, API client, stores, validators, utilities
├── services/         # API service layer with mock adapters
├── types/            # TypeScript type definitions
├── App.tsx
└── main.tsx
```

## Prerequisites

- Node.js 18+ and npm

## Installation

```bash
npm install
```

## Environment Configuration

Copy the example env file and adjust values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |
| `VITE_USE_MOCK` | Use mock data instead of real API | `true` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key (test mode) | — |

> Set `VITE_USE_MOCK=false` once the backend is ready. Never enable mock mode
> in production.

## Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Type-check and build for production
npm run typecheck  # Run TypeScript checks only
npm run lint       # Run ESLint
npm run preview    # Preview the production build
```

## API Integration

See `API_INTEGRATION.md` for the full API contract, including endpoint paths,
request/response formats, authentication requirements, and status values.

Key points:
- All API calls go through a centralized `apiClient` (in `src/lib/api-client.ts`)
- Service modules in `src/services/` wrap API calls with typed methods
- Mock data is isolated in `src/services/mock-data.ts` and only used when
  `VITE_USE_MOCK=true`
- Production mode never falls back to mock data on API failure

## Features Requiring the Backend

The following features depend on the separately developed backend:
- User authentication (login, register, verification, password reset)
- Pizza catalog data (menu, details, customization options)
- Cart validation at checkout (prices, availability)
- Order creation and tracking
- Razorpay payment creation and verification
- Admin dashboard metrics
- Order status management
- Inventory data and stock adjustments

## Deployment

1. Set `VITE_USE_MOCK=false` and configure `VITE_API_BASE_URL` to the
   production backend URL.
2. Run `npm run build` to produce the production bundle in `dist/`.
3. Deploy `dist/` to any static hosting provider (Vercel, Netlify, etc.).
4. Ensure the backend handles CORS for the deployed frontend origin.

## License

This project is part of the Oasis Infobyte Web Development and Designing
Internship.
