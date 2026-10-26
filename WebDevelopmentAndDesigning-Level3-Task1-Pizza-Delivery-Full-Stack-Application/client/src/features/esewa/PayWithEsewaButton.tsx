import { useRef, useState } from 'react';
import { initiateEsewaPayment, submitEsewaForm } from './api';

/** Replaces the Razorpay button. `orderId` comes from POST /orders; `token` is the in-memory access token. */
export function PayWithEsewaButton({ orderId, token, disabled }: { orderId: string; token: string; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'starting' | 'redirecting' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false); // blocks double-clicks before React re-renders

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState('starting');
    setMessage('');
    try {
      const form = await initiateEsewaPayment(token, orderId);
      setState('redirecting');
      submitEsewaForm(form); // page navigates to eSewa
    } catch (e) {
      inFlight.current = false;
      setState('error');
      setMessage(
        (e as { code?: string }).code === 'ORDER_EXPIRED'
          ? 'This order expired before payment. Please place it again.'
          : (e as Error).message || 'Could not start the payment. Please try again.',
      );
    }
  }

  const busy = state === 'starting' || state === 'redirecting';
  return (
    <div>
      <button type="button" onClick={pay} disabled={disabled || busy} aria-busy={busy}>
        {state === 'starting' ? 'Preparing eSewa payment…' : state === 'redirecting' ? 'Redirecting to eSewa…' : 'Pay with eSewa'}
      </button>
      {state === 'error' && <p role="alert">{message}</p>}
    </div>
  );
}
