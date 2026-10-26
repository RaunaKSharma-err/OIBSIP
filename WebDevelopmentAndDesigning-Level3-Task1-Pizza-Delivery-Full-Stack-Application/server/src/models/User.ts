import { Schema, model, type Types } from 'mongoose';
import type { Role } from '../types';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
  status: 'active' | 'disabled';
  /** Incremented on password reset; embedded in access tokens so old ones stop working. */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    emailVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);

export const toUserDto = (u: Pick<IUser, '_id' | 'name' | 'email' | 'role' | 'emailVerified' | 'createdAt'>) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
});
