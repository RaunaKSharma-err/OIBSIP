import { z } from 'zod';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../types';
import { paginationQuery } from '../utils/pagination';

const qty = z.number().int().min(0).max(100_000_000);

export const listInventoryQuery = paginationQuery.extend({
  search: z.string().trim().max(60).optional(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  status: z.enum(['ok', 'low', 'out']).optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export const createInventoryBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    category: z.enum(INVENTORY_CATEGORIES),
    unit: z.enum(INVENTORY_UNITS),
    stock: qty.default(0),
    lowStockThreshold: qty.default(0),
  })
  .strict();
/** Stock itself can only change through adjustments (auditable). */
export const updateInventoryBody = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    category: z.enum(INVENTORY_CATEGORIES).optional(),
    lowStockThreshold: qty.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');
export const adjustmentBody = z
  .object({
    change: z.number().int().min(-100_000_000).max(100_000_000).refine((n) => n !== 0, 'Change must not be zero'),
    reason: z.string().trim().min(3).max(200),
  })
  .strict();
export const transactionsQuery = paginationQuery;
export const dashboardQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
