import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatNpr } from './api';
import { usePaymentConfirmation } from './usePaymentConfirmation';

/** Route: /payment/esewa/success/:orderId  (eSewa appends ?data=<base64>) */
export function EsewaSuccessPage({ token }: { token: string }) {
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const { ui, retry } = usePaymentConfirmation(token, orderId, params.get('data'));

  if (ui.kind === 'checking') return <p role="status">Confirming your payment with eSewa…</p>;
  if (ui.kind === 'error') {
    return (
      <div role="alert">
        <p>We could not confirm your payment: {ui.message}</p>
        <button onClick={retry}>Try again</button>
      </div>
    );
  }
  if (ui.kind === 'pending') {
    return (
      <div role="status">
        <p>{ui.verificationDelayed ? 'eSewa could not be reached to confirm your payment yet.' : 'Your payment is still being processed.'}</p>
        <p>Do not pay again. This page keeps checking automatically.</p>
        <button onClick={retry}>Check again</button>
      </div>
    );
  }
  if (ui.kind === 'failed') {
    return (
      <div role="alert">
        <p>The payment was not completed. You have not been charged for this order.</p>
        <Link to={`/payment/esewa/failure/${orderId}`}>Back to payment options</Link>
      </div>
    );
  }
  const o = ui.result.order!;
  return (
    <div role="status">
      <h2>Payment confirmed</h2>
      <p>Order {o.orderNumber} · {formatNpr(o.total)} paid via eSewa.</p>
      <Link to={`/orders/${o.id}`}>Track your order</Link>
    </div>
  );
}
