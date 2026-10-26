import { useCallback, useEffect, useRef, useState } from 'react';
import { getEsewaStatus, verifyEsewaRedirect, type PaymentResult } from './api';

export type UiState =
  | { kind: 'checking' }
  | { kind: 'paid'; result: PaymentResult }
  | { kind: 'failed'; result: PaymentResult }
  | { kind: 'pending'; result: PaymentResult; verificationDelayed: boolean }
  | { kind: 'error'; message: string };

const POLL_MS = 4000;
const MAX_POLLS = 8;

/** Shows ONLY what the server confirmed. `data` (if present) is sent to the backend, never interpreted here. */
export function usePaymentConfirmation(token: string, orderId: string, data: string | null) {
  const [ui, setUi] = useState<UiState>({ kind: 'checking' });
  const polls = useRef(0);
  const started = useRef(false); // React StrictMode runs effects twice in dev

  const apply = useCallback((r: PaymentResult) => {
    if (r.paymentStatus === 'paid') setUi({ kind: 'paid', result: r });
    else if (r.paymentStatus === 'failed') setUi({ kind: 'failed', result: r });
    else setUi({ kind: 'pending', result: r, verificationDelayed: r.paymentStatus === 'verification_required' });
    return r.paymentStatus;
  }, []);

  const check = useCallback(
    async (useData: boolean) => {
      try {
        const r = useData && data ? await verifyEsewaRedirect(token, data) : await getEsewaStatus(token, orderId);
        return apply(r);
      } catch (e) {
        setUi({ kind: 'error', message: (e as Error).message });
        return 'error';
      }
    },
    [apply, data, orderId, token],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async (first: boolean) => {
      const s = await check(first);
      if ((s === 'pending' || s === 'verification_required' || s === 'not_found') && polls.current++ < MAX_POLLS) {
        timer = setTimeout(() => void loop(false), POLL_MS);
      }
    };
    void loop(true);
    return () => clearTimeout(timer);
  }, [check]);

  return { ui, retry: () => { polls.current = 0; setUi({ kind: 'checking' }); void check(false); } };
}
