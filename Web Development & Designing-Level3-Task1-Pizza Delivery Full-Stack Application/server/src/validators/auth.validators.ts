import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt only uses the first 72 bytes, so cap there.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerBody = z.object({ name: z.string().trim().min(2).max(80), email, password }).strict();
export const loginBody = z.object({ email, password: z.string().min(1).max(72) }).strict();
export const tokenBody = z.object({ token: z.string().min(16).max(200) }).strict();
export const emailBody = z.object({ email }).strict();
export const resetPasswordBody = z.object({ token: z.string().min(16).max(200), password }).strict();

export type RegisterInput = z.infer<typeof registerBody>;
