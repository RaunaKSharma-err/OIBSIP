import crypto from 'crypto';
import { esewa } from '../config/env';
import { safeEqual } from './crypto';

/* ------------------------------ amounts ------------------------------------------------------
 * Internally money is integer PAISA (1 NPR = 100 paisa). eSewa speaks decimal rupees as strings.
 * The exact string we sign/send as total_amount is also the one used in the status-check call. */
export const formatNpr = (paisa: number): string =>
  paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2);

export function parseNprToPaisa(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') n = Number(value.replace(/,/g, '').trim());
  else return null;
  if (!Number.isFinite(n) || n < 0) return null;
  const paisa = Math.round(n * 100);
  return Math.abs(paisa - n * 100) < 1e-6 ? paisa : null; // reject sub-paisa precision
}

/* ------------------------------ signatures ---------------------------------------------------
 * HMAC-SHA256, Base64 output, over "name=value" pairs joined with "," in signed_field_names order. */
export const signMessage = (message: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(message).digest('base64');

export const buildMessage = (values: Record<string, string>, names: string[]): string =>
  names.map((n) => `${n}=${values[n]}`).join(',');

export const REQUEST_SIGNED_FIELDS = ['total_amount', 'transaction_uuid', 'product_code'];

export function signRequest(f: { totalAmount: string; transactionUuid: string; productCode: string }, secret: string) {
  const values = { total_amount: f.totalAmount, transaction_uuid: f.transactionUuid, product_code: f.productCode };
  return signMessage(buildMessage(values, REQUEST_SIGNED_FIELDS), secret);
}

/** Fields that MUST be covered by the response signature, so an attacker cannot drop them from signed_field_names. */
const REQUIRED_RESPONSE_FIELDS = ['transaction_uuid', 'total_amount', 'product_code', 'status'];

/** Returns the RAW textual value of a top-level-looking JSON key (numbers keep their exact text, e.g. "100.0"). */
function rawJsonValue(text: string, name: string): string | null {
  const re = new RegExp(`"${name}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|-?[0-9][0-9.eE+-]*|true|false|null)`);
  const m = re.exec(text);
  if (!m) return null;
  return m[1].startsWith('"') ? (JSON.parse(m[1]) as string) : m[1];
}

export function decodeRedirectData(data: string): string {
  if (data.length > 4000) throw new Error('too large');
  // '+' becomes ' ' when Base64 travels through a query string
  const text = Buffer.from(data.replace(/ /g, '+'), 'base64').toString('utf8');
  const parsed = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
  return text;
}

export type SignatureCheck = { ok: true; values: Record<string, string> } | { ok: false; reason: string };

/**
 * Verifies the Base64 `data` eSewa appends to success_url. The returned `values` are the exact strings that
 * were signed; callers must use ONLY these (never a separately parsed copy) for every later comparison.
 */
export function verifyRedirectSignature(text: string, secret: string): SignatureCheck {
  const signedList = rawJsonValue(text, 'signed_field_names');
  const signature = rawJsonValue(text, 'signature');
  if (!signedList || !signature) return { ok: false, reason: 'MISSING_FIELDS' };
  const names = signedList.split(',').map((n) => n.trim());
  if (names.length > 20 || names.some((n) => !/^[a-z_]+$/.test(n))) return { ok: false, reason: 'BAD_FIELD_NAMES' };
  if (!REQUIRED_RESPONSE_FIELDS.every((r) => names.includes(r))) return { ok: false, reason: 'REQUIRED_FIELDS_NOT_SIGNED' };
  const values: Record<string, string> = {};
  for (const n of names) {
    const v = n === 'signed_field_names' ? signedList : rawJsonValue(text, n);
    if (v === null) return { ok: false, reason: 'MISSING_SIGNED_VALUE' };
    values[n] = v;
  }
  const expected = signMessage(buildMessage(values, names), secret);
  return safeEqual(expected, signature) ? { ok: true, values } : { ok: false, reason: 'SIGNATURE_MISMATCH' };
}

/* ------------------------------ status API ---------------------------------------------------- */
export class EsewaUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EsewaUnavailableError';
  }
}

export interface EsewaStatus {
  /** COMPLETE | PENDING | CANCELED | NOT_FOUND | AMBIGUOUS | FULL_REFUND | PARTIAL_REFUND | (anything else) */
  status: string;
  transactionUuid: string | null;
  productCode: string | null;
  totalAmountPaisa: number | null;
  refId: string | null;
}

/** Network boundary (mocked in tests). Any failure to obtain a well-formed answer throws EsewaUnavailableError. */
export const esewaGateway = {
  async checkStatus(q: { productCode: string; totalAmount: string; transactionUuid: string }): Promise<EsewaStatus> {
    const url = new URL(esewa.statusUrl);
    url.searchParams.set('product_code', q.productCode);
    url.searchParams.set('total_amount', q.totalAmount);
    url.searchParams.set('transaction_uuid', q.transactionUuid);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), esewa.timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new EsewaUnavailableError(`eSewa status API returned HTTP ${res.status}`);
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json || typeof json !== 'object') throw new EsewaUnavailableError('eSewa status API returned an unreadable body');
      const status = typeof json.status === 'string' ? json.status.trim().toUpperCase() : '';
      if (!status) throw new EsewaUnavailableError('eSewa status API did not return a status'); // e.g. {code:0,error_message}
      // The docs show two shapes: product_code/transaction_uuid/total_amount/ref_id and scd/pid/totalAmount/refId.
      const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
      return {
        status,
        transactionUuid: str(json.transaction_uuid ?? json.pid),
        productCode: str(json.product_code ?? json.scd),
        totalAmountPaisa: parseNprToPaisa(json.total_amount ?? json.totalAmount),
        refId: str(json.ref_id ?? json.refId),
      };
    } catch (err) {
      if (err instanceof EsewaUnavailableError) throw err;
      throw new EsewaUnavailableError(err instanceof Error && err.name === 'AbortError' ? 'eSewa status API timed out' : 'eSewa status API is unreachable');
    } finally {
      clearTimeout(timer);
    }
  },
};
