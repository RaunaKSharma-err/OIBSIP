import { Schema, model, type Types } from 'mongoose';

export const TXN_TYPES = ['initial', 'restock', 'adjustment', 'order_reserve', 'order_release'] as const;

export interface IInventoryTransaction {
  _id: Types.ObjectId;
  item: Types.ObjectId;
  type: (typeof TXN_TYPES)[number];
  /** Signed integer: negative = stock removed, positive = stock added. */
  quantityChange: number;
  reason: string;
  order?: Types.ObjectId;
  /** Re-reservation counter for an order (late payment after expiry). */
  cycle: number;
  actor: { kind: 'admin' | 'system'; user?: Types.ObjectId };
  createdAt: Date;
}

const schema = new Schema<IInventoryTransaction>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    type: { type: String, enum: TXN_TYPES, required: true },
    quantityChange: { type: Number, required: true, validate: Number.isInteger },
    reason: { type: String, default: '', maxlength: 200 },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    cycle: { type: Number, default: 0 },
    actor: {
      kind: { type: String, enum: ['admin', 'system'], required: true },
      user: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// Idempotency guard: an order can reserve / release a given item only once per cycle.
schema.index(
  { order: 1, item: 1, type: 1, cycle: 1 },
  { unique: true, partialFilterExpression: { order: { $exists: true } } },
);

export const InventoryTransaction = model<IInventoryTransaction>('InventoryTransaction', schema);

export const transactionDto = (t: IInventoryTransaction) => ({
  id: String(t._id),
  item: String(t.item),
  type: t.type,
  quantityChange: t.quantityChange,
  reason: t.reason,
  order: t.order ? String(t.order) : null,
  actor: { kind: t.actor.kind, user: t.actor.user ? String(t.actor.user) : null },
  createdAt: t.createdAt,
});
