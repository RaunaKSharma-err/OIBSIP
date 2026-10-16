import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { AdminLayout } from '@/components/layout/admin-layout';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from './route-guards';
import { NotFoundPage, UnauthorizedPage } from './error-pages';

import { HomePage } from '@/features/menu/home-page';
import { MenuPage } from '@/features/menu/menu-page';
import { PizzaDetailsPage } from '@/features/customization/pizza-details-page';
import { CartPage } from '@/features/cart/cart-page';
import { CheckoutPage } from '@/features/checkout/checkout-page';
import { OrderHistoryPage, OrderDetailsPage } from '@/features/orders/order-pages';
import { ProfilePage } from '@/features/auth/profile-page';
import {
  LoginPage,
  RegisterPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  AdminLoginPage,
} from '@/features/auth/auth-pages';
import {
  AdminDashboardPage,
  AdminOrdersPage,
  AdminOrderDetailsPage,
  AdminInventoryPage,
  AdminSettingsPage,
} from '@/features/dashboard/admin-pages';

const router = createBrowserRouter([
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/menu', element: <MenuPage /> },
      { path: '/pizza/:id', element: <PizzaDetailsPage /> },
      { path: '/cart', element: <CartPage /> },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/orders', element: <OrderHistoryPage /> },
          { path: '/orders/:id', element: <OrderDetailsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    element: <AdminRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin/dashboard', element: <AdminDashboardPage /> },
          { path: '/admin/orders', element: <AdminOrdersPage /> },
          { path: '/admin/orders/:id', element: <AdminOrderDetailsPage /> },
          { path: '/admin/inventory', element: <AdminInventoryPage /> },
          { path: '/admin/settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
