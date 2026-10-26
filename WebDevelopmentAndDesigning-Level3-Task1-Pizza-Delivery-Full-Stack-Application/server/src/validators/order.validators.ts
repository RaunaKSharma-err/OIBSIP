import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../types';
import { paginationQuery } from '../utils/pagination';
import { objectId } from './common';

const cartItem = z
  .object({
    pizzaId: objectId,
    baseId: objectId,
    sauceId: objectId.optional(),
    cheeseId: objectId.optional(),
    toppingIds: z.array(objectId).max(8).default([]),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();

const delivery = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^9[78]\d{8}$/, 'Enter a valid 10-digit Nepali mobile number (starts with 97 or 98)'),
    addressLine1: z.string().trim().min(5).max(120),
    addressLine2: z.string().trim().max(120).optional(),
    landmark: z.string().trim().max(80).optional(),
    city: z.string().trim().min(2).max(60),
    state: z.string().trim().min(2).max(60),
    postalCode: z.string().trim().regex(/^\d{5}$/, 'Enter a valid 5-digit postal code'),
    instructions: z.string().trim().max(200).optional(),
  })
  .strict();

/** `.strict()` rejects client-sent totals, prices, user ids, statuses, etc. */
export const createOrderBody = z.object({ items: z.array(cartItem).min(1).max(20), delivery }).strict();
export const idempotencyHeader = z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_\-:.]+$/);

export const myOrdersQuery = paginationQuery.extend({ status: z.enum(ORDER_STATUSES).optional() });

export const adminOrdersQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  search: z.string().trim().max(40).optional(),
});
export const updateStatusBody = z
  .object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(200).optional() })
  .strict();
export const cancelBody = z.object({ reason: z.string().trim().max(200).optional() }).strict();
