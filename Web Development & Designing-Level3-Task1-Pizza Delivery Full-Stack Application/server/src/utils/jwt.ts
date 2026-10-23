import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../types';

const ISSUER = 'pizza-delivery-api';

export interface AccessPayload {
  sub: string;
  role: Role;
  tv: number;
}

export function signAccessToken(user: { id: string; role: Role; tokenVersion: number }): string {
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: ISSUER,
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: ISSUER }) as JwtPayload;
  return { sub: String(p.sub), role: p.role as Role, tv: Number(p.tv) };
}
