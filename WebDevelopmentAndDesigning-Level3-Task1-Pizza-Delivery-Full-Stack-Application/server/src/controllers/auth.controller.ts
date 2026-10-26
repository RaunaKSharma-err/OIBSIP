import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import * as auth from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk } from '../utils/response';

const COOKIE = 'refresh_token';
const cookieBase = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth', // cookie is only ever sent to auth endpoints
});
const setRefreshCookie = (res: Response, token: string, expires: Date) =>
  res.cookie(COOKIE, token, { ...cookieBase(), expires });
const clearRefreshCookie = (res: Response) => res.clearCookie(COOKIE, cookieBase());
const refreshFrom = (req: Request): string | undefined => req.cookies?.[COOKIE];

export const register = asyncHandler(async (req, res) => {
  const user = await auth.registerUser(req.validated.body);
  sendOk(res, { user, message: 'Registration successful. Please check your email to verify your account.' }, 201);
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await auth.verifyEmail(req.validated.body.token);
  sendOk(res, { message: 'Email verified successfully' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await auth.resendVerification(req.validated.body.email);
  sendOk(res, { message: 'If the account exists and is not yet verified, a new verification email has been sent.' });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const s = await auth.loginUser(email, password);
  setRefreshCookie(res, s.refreshToken, s.refreshExpiresAt);
  sendOk(res, { user: s.user, accessToken: s.accessToken, expiresIn: env.JWT_ACCESS_EXPIRES_IN });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const s = await auth.refreshSession(refreshFrom(req));
    setRefreshCookie(res, s.refreshToken, s.refreshExpiresAt);
    sendOk(res, { user: s.user, accessToken: s.accessToken, expiresIn: env.JWT_ACCESS_EXPIRES_IN });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await auth.logoutSession(refreshFrom(req));
  clearRefreshCookie(res);
  sendOk(res, { message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  sendOk(res, { user: await auth.getProfile(req.user!.id) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await auth.requestPasswordReset(req.validated.body.email);
  sendOk(res, { message: 'If an account exists for that email, a password reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.validated.body.token, req.validated.body.password);
  clearRefreshCookie(res);
  sendOk(res, { message: 'Password updated. Please log in with your new password.' });
});
