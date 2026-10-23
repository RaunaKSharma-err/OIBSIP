export const ROLES = ['customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** `pending_payment` = checkout created, stock reserved, awaiting verified payment. */
export const ORDER_STATUSES = ['pending_payment', 'received', 'kitchen', 'delivery', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Allowed manual/system transitions. `pending_payment -> received` is performed ONLY by payment verification. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['cancelled'],
  received: ['kitchen', 'cancelled'],
  kitchen: ['delivery', 'cancelled'],
  delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export const OPTION_TYPES = ['base', 'sauce', 'cheese', 'topping'] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

export const PIZZA_CATEGORIES = ['veg', 'non-veg', 'vegan', 'specialty'] as const;
export const INVENTORY_CATEGORIES = ['dough', 'sauce', 'cheese', 'vegetable', 'meat', 'packaging', 'other'] as const;
/** Quantities are stored as integers in base units: grams, millilitres, or whole units. */
export const INVENTORY_UNITS = ['g', 'ml', 'unit'] as const;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}
