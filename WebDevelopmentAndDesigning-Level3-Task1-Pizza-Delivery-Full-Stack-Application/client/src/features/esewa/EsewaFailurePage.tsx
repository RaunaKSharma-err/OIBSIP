import { Link, useParams } from 'react-router-dom';
import { PayWithEsewaButton } from './PayWithEsewaButton';
import { usePaymentConfirmation } from './usePaymentConfirmation';

/** Route: /payment/esewa/failure/:orderId. eSewa sends cancelled AND pending payments here, so ask the server. */
export function EsewaFailurePage({ token }: { token: string }) {
  const { orderId = '' } = useParams();
  const { ui, retry } = usePaymentConfirmation(token, orderId, null);

  if (ui.kind === 'checking') return <p role="status">Checking what happened with your payment…</p>;
  if (ui.kind === 'paid') {
    return (
      <div role="status">
        <h2>Payment confirmed</h2>
        <p>Your payment actually went through. No need to pay again.</p>
        <Link to={`/orders/${orderId}`}>Track your order</Link>
      </div>
    );
  }
  if (ui.kind === 'pending') {
    return (
      <div role="status">
        <p>eSewa has not reported a final result yet. Please wait a moment before trying again.</p>
        <button onClick={retry}>Check again</button>
      </div>
    );
  }
  return (
    <div role="alert">
      <h2>Payment not completed</h2>
      <p>{ui.kind === 'error' ? ui.message : 'The payment was cancelled or failed. Your order is still reserved for a short time.'}</p>
      <PayWithEsewaButton orderId={orderId} token={token} />
      <p><Link to="/orders">View my orders</Link></p>
    </div>
  );
}
