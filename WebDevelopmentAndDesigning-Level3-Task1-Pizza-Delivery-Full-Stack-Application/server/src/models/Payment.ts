import { Schema, model, type Types } from 'mongoose';

/** One row per eSewa payment ATTEMPT (each has its own transaction_uuid). */
export interface IPayment {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  user: Types.ObjectId;
  provider: 'esewa';
  /** Sent to eSewa as transaction_uuid. Alphanumeric + hyphen only. */
  transactionUuid: string;
  productCode: string;
  /** Paisa (1 NPR = 100 paisa). Always copied from the server-calculated order total. */
  amount: number;
  currency: 'NPR';
  /** created = form issued; pending = eSewa not final / verification unavailable; paid; failed (canceled etc.) */
  status: 'created' | 'pending' | 'paid' | 'failed';
  /** Last status reported by eSewa's status API (COMPLETE, PENDING, CANCELED, ...), or VERIFICATION_UNAVAILABLE. */
  gatewayStatus?: string;
  verificationStatus: 'unverified' | 'verified' | 'failed';
  /** eSewa transaction_code / ref_id of the successful payment. */
  transactionCode?: string;
  failedAttempts: number;
  /** Short, safe description only. */
  failureReason?: string;
  paidAt?: Date;
  failedAt?: Date;
  lastCheckedAt?: Date;
  confirmedVia?: 'redirect' | 'status_check' | 'reconciliation';
  /** Set when the order had already been paid by another attempt (customer paid twice). */
  duplicatePayment: boolean;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['esewa'], default: 'esewa' },
    transactionUuid: { type: String, required: true, unique: true, match: /^[A-Za-z0-9-]+$/ },
    productCode: { type: String, required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currency: { type: String, enum: ['NPR'], default: 'NPR' },
    status: { type: String, enum: ['created', 'pending', 'paid', 'failed'], default: 'created' },
    gatewayStatus: String,
    verificationStatus: { type: String, enum: ['unverified', 'verified', 'failed'], default: 'unverified' },
    transactionCode: String,
    failedAttempts: { type: Number, default: 0 },
    failureReason: { type: String, maxlength: 200 },
    paidAt: Date,
    failedAt: Date,
    lastCheckedAt: Date,
    confirmedVia: { type: String, enum: ['redirect', 'status_check', 'reconciliation'] },
    duplicatePayment: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// An eSewa transaction code can confirm at most one Payment row.
paymentSchema.index(
  { transactionCode: 1 },
  { unique: true, partialFilterExpression: { transactionCode: { $type: 'string' } } },
);
paymentSchema.index({ status: 1, createdAt: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
