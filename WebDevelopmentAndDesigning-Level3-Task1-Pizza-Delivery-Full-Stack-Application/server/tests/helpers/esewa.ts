import { signMessage } from '../../src/utils/esewa';

const SECRET = '8gBm/:&EnhH.1/q';
const NAMES = 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names';

/** Builds a signed success-redirect body. `rawTotal` is the literal JSON token for total_amount. */
export function signedResponse(o: { rawTotal?: string; uuid?: string; status?: string; code?: string; product?: string; secret?: string; names?: string } = {}) {
  const names = o.names ?? NAMES;
  const v: Record<string, string> = {
    transaction_code: o.code ?? '0004T5I',
    status: o.status ?? 'COMPLETE',
    total_amount: o.rawTotal ?? '620',
    transaction_uuid: o.uuid ?? 'PZ20261023-ABC123-1a2b3c4d',
    product_code: o.product ?? 'EPAYTEST',
    signed_field_names: names,
  };
  const message = names.split(',').map((n) => `${n}=${v[n]}`).join(',');
  const signature = signMessage(message, o.secret ?? SECRET);
  const num = /^[0-9.]+$/.test(v.total_amount);
  return (
    `{"transaction_code":"${v.transaction_code}","status":"${v.status}","total_amount":${num ? v.total_amount : `"${v.total_amount}"`},` +
    `"transaction_uuid":"${v.transaction_uuid}","product_code":"${v.product_code}","signed_field_names":"${names}","signature":"${signature}"}`
  );
}

/** Base64 `data` exactly as eSewa appends it to success_url. */
export const redirectData = (o: Parameters<typeof signedResponse>[0] = {}) => Buffer.from(signedResponse(o)).toString('base64');
