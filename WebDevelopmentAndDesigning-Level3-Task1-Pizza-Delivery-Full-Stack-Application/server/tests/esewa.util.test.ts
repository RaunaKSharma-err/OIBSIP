import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EsewaUnavailableError,
  buildMessage,
  decodeRedirectData,
  esewaGateway,
  formatNpr,
  parseNprToPaisa,
  signMessage,
  signRequest,
  verifyRedirectSignature,
} from '../src/utils/esewa';

const SECRET = '8gBm/:&EnhH.1/q';
const NAMES = 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names';
import { signedResponse } from './helpers/esewa';

describe('amount formatting', () => {
  it('formats paisa as eSewa rupee strings', () => {
    expect(formatNpr(62000)).toBe('620');
    expect(formatNpr(62050)).toBe('620.50');
    expect(formatNpr(5)).toBe('0.05');
  });
  it('parses numbers and comma-formatted strings, rejects junk and sub-paisa values', () => {
    expect(parseNprToPaisa(620)).toBe(62000);
    expect(parseNprToPaisa(100.0)).toBe(10000);
    expect(parseNprToPaisa('1,250.50')).toBe(125050);
    expect(parseNprToPaisa('abc')).toBeNull();
    expect(parseNprToPaisa(-1)).toBeNull();
    expect(parseNprToPaisa(1.005)).toBeNull();
    expect(parseNprToPaisa(null)).toBeNull();
  });
});

describe('request signature', () => {
  it('is Base64 HMAC-SHA256 over total_amount,transaction_uuid,product_code in that order', () => {
    const got = signRequest({ totalAmount: '100', transactionUuid: '11-201-13', productCode: 'EPAYTEST' }, SECRET);
    const expected = crypto.createHmac('sha256', SECRET).update('total_amount=100,transaction_uuid=11-201-13,product_code=EPAYTEST').digest('base64');
    expect(got).toBe(expected);
    expect(buildMessage({ a: '1', b: '2' }, ['b', 'a'])).toBe('b=2,a=1');
  });
  it('changes when any signed value or the secret changes', () => {
    const base = signRequest({ totalAmount: '100', transactionUuid: 'u1', productCode: 'EPAYTEST' }, SECRET);
    expect(signRequest({ totalAmount: '101', transactionUuid: 'u1', productCode: 'EPAYTEST' }, SECRET)).not.toBe(base);
    expect(signRequest({ totalAmount: '100', transactionUuid: 'u2', productCode: 'EPAYTEST' }, SECRET)).not.toBe(base);
    expect(signRequest({ totalAmount: '100', transactionUuid: 'u1', productCode: 'EPAYTEST' }, 'other')).not.toBe(base);
  });
});

describe('response signature verification', () => {
  it('accepts a correctly signed response and returns the signed values', () => {
    const r = verifyRedirectSignature(signedResponse(), SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toMatchObject({ status: 'COMPLETE', total_amount: '620', product_code: 'EPAYTEST' });
  });
  it('signs numbers by their literal text (e.g. 100.0), as eSewa does', () => {
    expect(verifyRedirectSignature(signedResponse({ rawTotal: '100.0' }), SECRET).ok).toBe(true);
  });
  it('rejects a tampered amount, uuid, status or wrong secret', () => {
    const good = signedResponse();
    expect(verifyRedirectSignature(good.replace('"total_amount":620', '"total_amount":1'), SECRET).ok).toBe(false);
    expect(verifyRedirectSignature(good.replace('ABC123', 'EVIL99'), SECRET).ok).toBe(false);
    expect(verifyRedirectSignature(good.replace('COMPLETE', 'PENDING'), SECRET).ok).toBe(false);
    expect(verifyRedirectSignature(signedResponse({ secret: 'attacker-key' }), SECRET).ok).toBe(false);
  });
  it('rejects responses that do not sign the critical fields (field-dropping attack)', () => {
    const r = verifyRedirectSignature(signedResponse({ names: 'transaction_uuid,signed_field_names' }), SECRET);
    expect(r).toMatchObject({ ok: false, reason: 'REQUIRED_FIELDS_NOT_SIGNED' });
  });
  it('rejects missing signature and malformed field lists', () => {
    expect(verifyRedirectSignature('{"status":"COMPLETE"}', SECRET).ok).toBe(false);
    const bad = signedResponse({ names: NAMES + ',BAD NAME' });
    expect(verifyRedirectSignature(bad, SECRET).ok).toBe(false);
  });
  it('decodes Base64 incl. "+" turned into spaces by query strings, and rejects garbage', () => {
    const text = signedResponse();
    const b64 = Buffer.from(text).toString('base64');
    expect(decodeRedirectData(b64)).toBe(text);
    expect(decodeRedirectData(b64.replace(/\+/g, ' '))).toBe(text);
    expect(() => decodeRedirectData('bm90IGpzb24=')).toThrow();
    expect(() => decodeRedirectData('x'.repeat(5000))).toThrow();
  });
});

describe('status API client', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (impl: () => unknown) => vi.stubGlobal('fetch', vi.fn(impl));
  const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });
  const q = { productCode: 'EPAYTEST', totalAmount: '620', transactionUuid: 'u1' };

  it('calls the status URL with product_code, total_amount and transaction_uuid', async () => {
    stub(() => json({ product_code: 'EPAYTEST', transaction_uuid: 'u1', total_amount: 620.0, status: 'COMPLETE', ref_id: '000ABC' }));
    const r = await esewaGateway.checkStatus(q);
    const url = String((fetch as any).mock.calls[0][0]);
    expect(url).toContain('product_code=EPAYTEST');
    expect(url).toContain('total_amount=620');
    expect(url).toContain('transaction_uuid=u1');
    expect(r).toEqual({ status: 'COMPLETE', transactionUuid: 'u1', productCode: 'EPAYTEST', totalAmountPaisa: 62000, refId: '000ABC' });
  });
  it('also understands the older pid/scd/totalAmount/refId shape', async () => {
    stub(() => json({ pid: 'u1', scd: 'EPAYTEST', totalAmount: 150.0, status: 'pending', refId: null }));
    expect(await esewaGateway.checkStatus(q)).toMatchObject({ status: 'PENDING', transactionUuid: 'u1', totalAmountPaisa: 15000, refId: null });
  });
  it('treats HTTP errors, unreadable bodies, "service unavailable" payloads and network errors as unavailable', async () => {
    stub(() => json({}, false, 503));
    await expect(esewaGateway.checkStatus(q)).rejects.toBeInstanceOf(EsewaUnavailableError);
    stub(() => json({ code: 0, error_message: 'Service is currently unavailable' }));
    await expect(esewaGateway.checkStatus(q)).rejects.toBeInstanceOf(EsewaUnavailableError);
    stub(() => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }));
    await expect(esewaGateway.checkStatus(q)).rejects.toBeInstanceOf(EsewaUnavailableError);
    stub(() => { throw new TypeError('fetch failed'); });
    await expect(esewaGateway.checkStatus(q)).rejects.toBeInstanceOf(EsewaUnavailableError);
  });
  it('times out', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: unknown, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))));
    vi.useFakeTimers();
    const p = esewaGateway.checkStatus(q);
    const assertion = expect(p).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(9000);
    await assertion;
    vi.useRealTimers();
  });
});
