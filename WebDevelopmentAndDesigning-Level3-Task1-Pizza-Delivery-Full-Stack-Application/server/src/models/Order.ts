import { Schema, model, type Types } from 'mongoose';
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from '../types';

export interface IOptionSnapshot {
  option: Types.ObjectId;
  name: string;
  price: number;
}
export interface IOrderItem {
  pizza: Types.ObjectId;
  pizzaName: string;
  pizzaBasePrice: number;
  quantity: number;
  base: IOptionSnapshot;
  sauce?: IOptionSnapshot;
  cheese?: IOptionSnapshot;
  toppings: IOptionSnapshot[];
  unitPrice: number;
  lineTotal: number;
}
export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: 'NPR';
  delivery: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    postalCode: string;
    instructions?: string;
  };
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: Array<{
    status: OrderStatus;
    at: Date;
    by: { kind: 'customer' | 'admin' | 'system'; user?: Types.ObjectId };
    note?: string;
  }>;
  cancellation?: { reason: string; at: Date; by: 'customer' | 'admin' | 'system' };
  /** Paid order that was cancelled (or could not be fulfilled): refund must be issued manually from the eSewa merchant portal. */
  needsRefund: boolean;
  paidAt?: Date;
  idempotencyKey?: string;
  inventory: {
    state: 'reserved' | 'committed' | 'released' | 'releasing';
    reservedUntil: Date;
    cycle: number;
    requirements: Array<{ item: Types.ObjectId; quantity: number }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const money = { type: Number, required: true, min: 0, validate: Number.isInteger };

const optionSnapshot = new Schema<IOptionSnapshot>(
  {
    option: { type: Schema.Types.ObjectId, ref: 'PizzaOption', required: true },
    name: { type: String, required: true },
    price: money,
  },
  { _id: false },
);

const itemSchema = new Schema<IOrderItem>(
  {
    pizza: { type: Schema.Types.ObjectId, ref: 'Pizza', required: true },
    pizzaName: { type: String, required: true },
    pizzaBasePrice: money,
    quantity: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger },
    base: { type: optionSnapshot, required: true },
    sauce: { type: optionSnapshot },
    cheese: { type: optionSnapshot },
    toppings: { type: [optionSnapshot], default: [] },
    unitPrice: money,
    lineTotal: money,
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    by: {
      kind: { type: String, enum: ['customer', 'admin', 'system'], required: true },
      user: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    note: { type: String, maxlength: 200 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [itemSchema], validate: [(v: unknown[]) => v.length > 0, 'An order needs at least one item'] },
    subtotal: money,
    deliveryFee: money,
    discount: { ...money, default: 0 },
    total: money,
    currency: { type: String, enum: ['NPR'], default: 'NPR' },
    delivery: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      landmark: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      instructions: String,
    },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'pending_payment' },
    statusHistory: { type: [historySchema], default: [] },
    cancellation: {
      reason: String,
      at: Date,
      by: { type: String, enum: ['customer', 'admin', 'system'] },
    },
    needsRefund: { type: Boolean, default: false },
    paidAt: Date,
    idempotencyKey: String,
    inventory: {
      state: { type: String, enum: ['reserved', 'committed', 'released', 'releasing'], default: 'reserved' },
      reservedUntil: { type: Date, required: true },
      cycle: { type: Number, default: 0 },
      requirements: {
        type: [
          new Schema(
            { item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true }, quantity: Number },
            { _id: false },
          ),
        ],
        default: [],
      },
    },
  },
  { timestamps: true },
);
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, 'inventory.reservedUntil': 1 });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const Order = model<IOrder>('Order', orderSchema);

const snap = (s?: IOptionSnapshot) => (s ? { optionId: String(s.option), name: s.name, price: s.price } : null);

export const orderDto = (o: any) => ({
  id: String(o._id),
  orderNumber: o.orderNumber,
  ...(o.user && o.user.name ? { customer: { id: String(o.user._id), name: o.user.name, email: o.user.email } } : {}),
  items: o.items.map((i: IOrderItem) => ({
    pizzaId: String(i.pizza),
    pizzaName: i.pizzaName,
    quantity: i.quantity,
    pizzaBasePrice: i.pizzaBasePrice,
    base: snap(i.base),
    sauce: snap(i.sauce),
    cheese: snap(i.cheese),
    toppings: i.toppings.map((t) => snap(t)),
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  })),
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  discount: o.discount,
  total: o.total,
  currency: o.currency,
  delivery: o.delivery,
  paymentStatus: o.paymentStatus,
  orderStatus: o.orderStatus,
  statusHistory: o.statusHistory.map((h: any) => ({ status: h.status, at: h.at, by: h.by?.kind, note: h.note ?? null })),
  cancellation: o.cancellation?.reason ? o.cancellation : null,
  needsRefund: o.needsRefund,
  reservedUntil: o.orderStatus === 'pending_payment' ? o.inventory?.reservedUntil : null,
  paidAt: o.paidAt ?? null,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
