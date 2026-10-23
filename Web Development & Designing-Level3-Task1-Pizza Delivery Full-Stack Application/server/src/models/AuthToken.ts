import { Schema, model, type Types } from 'mongoose';

/** Single-use, hashed, short-lived tokens for email verification and password reset. */
export interface IAuthToken {
  user: Types.ObjectId;
  type: 'email_verification' | 'password_reset';
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

const authTokenSchema = new Schema<IAuthToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['email_verification', 'password_reset'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup

export const AuthToken = model<IAuthToken>('AuthToken', authTokenSchema);
