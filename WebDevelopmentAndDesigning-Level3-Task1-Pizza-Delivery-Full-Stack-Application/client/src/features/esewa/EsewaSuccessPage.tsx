import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNpr } from './api';
import { usePaymentConfirmation } from './usePaymentConfirmation';
import { useCartStore } from '@/lib/cart-store';
import { useEffect } from 'react';

/** Route: /payment/esewa/success/:orderId  (eSewa appends ?data=<base64>) */
export function EsewaSuccessPage({ token }: { token: string }) {
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const { ui, retry } = usePaymentConfirmation(token, orderId, params.get('data'));
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    if (ui.kind === 'paid') clearCart();
  }, [ui.kind, clearCart]);

  if (ui.kind === 'checking') return <div className="flex min-h-[60vh] items-center justify-center"><p role="status">Confirming your payment with eSewa…</p></div>;
  if (ui.kind === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p role="alert">We could not confirm your payment: {ui.message}</p>
        <button onClick={retry}>Try again</button>
      </div>
    );
  }
  if (ui.kind === 'pending') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p role="status">{ui.verificationDelayed ? 'eSewa could not be reached to confirm your payment yet.' : 'Your payment is still being processed.'}</p>
        <p>Do not pay again. This page keeps checking automatically.</p>
        <button onClick={retry}>Check again</button>
      </div>
    );
  }
  if (ui.kind === 'failed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p role="alert">The payment was not completed. You have not been charged for this order.</p>
        <Link to={`/payment/esewa/failure/${orderId}`}>Back to payment options</Link>
      </div>
    );
  }
  const o = ui.result.order!;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <CheckCircle2 className="h-16 w-16 text-green-500" />
      <h2 className="text-2xl font-bold">Payment confirmed</h2>
      <p>Order {o.orderNumber} · {formatNpr(o.total)} paid via eSewa.</p>
      <Button asChild><Link to={`/orders/${o.id}`}>Track your order</Link></Button>
    </div>
  );
}
