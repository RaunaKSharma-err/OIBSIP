import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { startDb, stopDb } from './helpers/db';

const app = createApp();
beforeAll(startDb);
afterAll(stopDb);

describe('platform behaviour', () => {
  it('liveness and readiness', async () => {
    expect((await request(app).get('/api/health')).body).toMatchObject({ success: true, data: { status: 'ok' } });
    const ready = await request(app).get('/api/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.checks.database).toBe('up');
  });
  it('uses the documented error envelope for 404, validation and malformed JSON', async () => {
    const nf = await request(app).get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body).toEqual({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: expect.any(String) } });
    const v = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(v.status).toBe(400);
    expect(v.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: expect.any(Array) });
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
  });
  it('rejects oversized bodies', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(80_000) });
    expect(res.status).toBe(413);
  });
  it('sets security headers and honours the CORS allowlist', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.headers['x-powered-by']).toBeUndefined();
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
