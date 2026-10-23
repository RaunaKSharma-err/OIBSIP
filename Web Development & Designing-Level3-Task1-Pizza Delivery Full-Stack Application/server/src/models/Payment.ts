import { Schema, model, type Types } from 'mongoose';

export interface IPayment {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  user: Types.ObjectId;
  provider: 'razorpay';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  /** Smallest currency unit (paise). */
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  verificationStatus: 'unverified' | 'verified' | 'failed';
  failedAttempts: number;
  /** Safe, short failure description only. Never card data. */
  failureReason?: string;
  paidAt?: Date;
  failedAt?: Date;
  confirmedVia?: 'verify' | 'webhook';
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currency: { type: String, required: true, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    verificationStatus: { type: String, enum: ['unverified', 'verified', 'failed'], default: 'unverified' },
    failedAttempts: { type: Number, default: 0 },
    failureReason: { type: String, maxlength: 200 },
    paidAt: Date,
    failedAt: Date,
    confirmedVia: { type: String, enum: ['verify', 'webhook'] },
  },
  { timestamps: true },
);
// A Razorpay payment id can confirm at most one Payment record.
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } },
);

export const Payment = model<IPayment>('Payment', paymentSchema);
