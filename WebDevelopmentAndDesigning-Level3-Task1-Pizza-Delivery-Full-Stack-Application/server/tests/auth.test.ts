import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AuthToken } from '../src/models/AuthToken';
import { User } from '../src/models/User';
import { clearDb, startDb, stopDb } from './helpers/db';
import { createUser } from './helpers/factories';

vi.mock('../src/utils/email', () => ({ sendMail: vi.fn(async () => ({ delivered: true, mode: 'smtp' })) }));
import { sendMail } from '../src/utils/email';

const mail = vi.mocked(sendMail);
const app = createApp();
const tokenFromLastMail = () => /token=([a-f0-9]+)/.exec(mail.mock.calls.at(-1)![0].text)![1];
const creds = { name: 'Asha Rai', email: 'asha@example.test', password: 'Password1' };

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mail.mockClear();
});

describe('registration', () => {
  it('registers a customer and never returns the hash', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: creds.email, role: 'customer', emailVerified: true });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    expect(mail).not.toHaveBeenCalled();
  });
  it('rejects attempts to choose a role (mass assignment)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('rejects duplicate emails with 409', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });
  it('validates password strength', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, password: 'short' });
    expect(res.status).toBe(400);
  });
});


describe('login, sessions and protected routes', () => {
  it('rejects invalid credentials with a generic error', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const wrongPw = await request(app).post('/api/auth/login').send({ email: creds.email, password: 'Wrong123' });
    const noUser = await request(app).post('/api/auth/login').send({ email: 'x@example.test', password: 'Wrong123' });
    expect(wrongPw.status).toBe(401);
    expect(wrongPw.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(noUser.body.error).toEqual(wrongPw.body.error);
  });
  it('logs in, sets an HttpOnly refresh cookie, and /me works with the bearer token', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/refresh_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(creds.email);
  });
  it('401s without or with a bad token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')).status).toBe(401);
  });
  it('rotates refresh tokens and revokes the family when an old one is replayed', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const c1 = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', c1);
    expect(r1.status).toBe(200);
    const c2 = (r1.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c1)).status).toBe(401); // replay
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c2)).status).toBe(401); // family killed
  });
  it('blocks refresh from a foreign Origin (CSRF)', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });
  it('enforces roles on admin routes', async () => {
    const customer = await createUser();
    const admin = await createUser({ role: 'admin' });
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    expect((await request(app).get('/api/admin/dashboard').set(customer.auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/dashboard').set(admin.auth)).status).toBe(200);
  });
});

describe('password reset', () => {
  it('does not reveal whether an account exists', async () => {
    await request(app).post('/api/auth/register').send(creds);
    mail.mockClear();
    const known = await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.test' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(mail).toHaveBeenCalledTimes(1);
  });
  it('resets the password once and invalidates existing sessions', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    const oldAccess = login.body.data.accessToken;
    await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    const token = tokenFromLastMail();
    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword2' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldAccess}`)).status).toBe(401);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Another3pass' })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: creds.email, password: 'NewPassword2' })).status).toBe(200);
  });
});
