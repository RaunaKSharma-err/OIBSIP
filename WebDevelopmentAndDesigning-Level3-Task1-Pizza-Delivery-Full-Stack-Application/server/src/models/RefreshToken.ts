import { Schema, model, type Types } from 'mongoose';

export interface IRefreshToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  /** All tokens descended from one login share a family; reuse of a revoked token revokes the family. */
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
