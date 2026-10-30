import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { AuthToken } from '../models/AuthToken';
import { RefreshToken } from '../models/RefreshToken';
import { User, toUserDto, type IUser } from '../models/User';
import { ApiError } from '../utils/apiError';
import { randomToken, sha256 } from '../utils/crypto';
import { sendMail } from '../utils/email';
import { signAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
// Used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

type TokenType = 'email_verification' | 'password_reset';

async function issueAuthToken(userId: Types.ObjectId, type: TokenType, ttlMs: number): Promise<string> {
  await AuthToken.updateMany({ user: userId, type, usedAt: null }, { $set: { usedAt: new Date() } });
  const raw = randomToken();
  await AuthToken.create({ user: userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw; // only the hash is stored
}

async function consumeAuthToken(raw: string, type: TokenType) {
  const token = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(raw), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!token) throw ApiError.badRequest('INVALID_OR_EXPIRED_TOKEN', 'This link is invalid or has expired');
  return token;
}

async function sendVerificationEmail(user: Pick<IUser, '_id' | 'email' | 'name'>) {
  const raw = await issueAuthToken(user._id, 'email_verification', VERIFY_TTL_MS);
  const link = `${env.FRONTEND_URL}/verify-email?token=${raw}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your email address',
    text: `Hi ${user.name},\n\nConfirm your email to start ordering:\n${link}\n\nThis link expires in 24 hours. If you did not sign up, ignore this email.`,
  });
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  if (await User.exists({ email: input.email })) {
    throw ApiError.conflict('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  let user;
  try {
    // role is never taken from input: new accounts are always customers.
    user = await User.create({ name: input.name, email: input.email, passwordHash, role: 'customer', emailVerified: true });
  } catch (err: any) {
    if (err?.code === 11000) throw ApiError.conflict('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    throw err;
  }
  logger.info('User registered', { userId: String(user._id) });
  return toUserDto(user);
}

export async function verifyEmail(rawToken: string) {
  const token = await consumeAuthToken(rawToken, 'email_verification');
  await User.updateOne({ _id: token.user }, { $set: { emailVerified: true } });
}

export async function resendVerification(email: string) {
  const user = await User.findOne({ email });
  if (!user || user.emailVerified || user.status !== 'active') return; // same response either way
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    logger.error('Failed to send verification email', { err, userId: String(user._id) });
  }
}

async function createSession(user: Pick<IUser, '_id' | 'role' | 'tokenVersion'>, family?: string) {
  const refreshToken = randomToken(48);
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    family: family ?? randomToken(16),
    expiresAt: refreshExpiresAt,
  });
  const accessToken = signAccessToken({ id: String(user._id), role: user.role, tokenVersion: user.tokenVersion });
  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    logger.warn('Failed login attempt');
    throw ApiError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'active') throw ApiError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');
  const session = await createSession(user);
  logger.info('User logged in', { userId: String(user._id) });
  return { user: toUserDto(user), ...session };
}

export async function refreshSession(rawRefreshToken?: string) {
  const invalid = () => ApiError.unauthorized('Session expired. Please log in again.', 'REFRESH_TOKEN_INVALID');
  if (!rawRefreshToken) throw invalid();
  const doc = await RefreshToken.findOne({ tokenHash: sha256(rawRefreshToken) });
  if (!doc) throw invalid();
  if (doc.revokedAt) {
    // A rotated token was replayed: assume theft and kill the whole family.
    await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
    logger.warn('Refresh token reuse detected; family revoked', { userId: String(doc.user) });
    throw invalid();
  }
  if (doc.expiresAt.getTime() < Date.now()) throw invalid();
  const user = await User.findById(doc.user);
  if (!user || user.status !== 'active') throw invalid();
  const claimed = await RefreshToken.findOneAndUpdate({ _id: doc._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!claimed) throw invalid();
  const session = await createSession(user, doc.family);
  return { user: toUserDto(user), ...session };
}

export async function logoutSession(rawRefreshToken?: string) {
  if (!rawRefreshToken) return;
  const doc = await RefreshToken.findOne({ tokenHash: sha256(rawRefreshToken) });
  if (doc) await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toUserDto(user);
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });
  if (!user || user.status !== 'active') return; // never reveal whether the account exists
  try {
    const raw = await issueAuthToken(user._id, 'password_reset', RESET_TTL_MS);
    const link = `${env.FRONTEND_URL}/reset-password?token=${raw}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (err) {
    logger.error('Failed to send password reset email', { err, userId: String(user._id) });
  }
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const token = await consumeAuthToken(rawToken, 'password_reset');
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await User.updateOne({ _id: token.user }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } });
  // Old access tokens die via tokenVersion; refresh tokens are revoked here.
  await RefreshToken.updateMany({ user: token.user, revokedAt: null }, { $set: { revokedAt: new Date() } });
  logger.info('Password reset completed', { userId: String(token.user) });
}
