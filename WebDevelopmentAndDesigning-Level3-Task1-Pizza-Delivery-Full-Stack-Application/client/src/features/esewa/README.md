# eSewa frontend drop-ins

Files for the Bolt.ai React app (React Router v6, TypeScript). They replace the Razorpay checkout.
1. Copy this folder to `src/esewa/` and delete the Razorpay script tag (`checkout.razorpay.com`) and button.
2. Routes: `/payment/esewa/success/:orderId` → `EsewaSuccessPage`, `/payment/esewa/failure/:orderId` → `EsewaFailurePage` (both inside your authenticated layout; pass the in-memory access token).
3. At checkout, after `POST /orders`, render `<PayWithEsewaButton orderId token />`.
4. Backend `ESEWA_SUCCESS_URL` / `ESEWA_FAILURE_URL` must equal those route prefixes (the backend appends `/<orderId>`).

These files are NOT type-checked, built or tested here (no frontend project or network was available). Cash-on-delivery was never part of the backend, so none was added.
