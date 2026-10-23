import { z } from 'zod';
import { PIZZA_CATEGORIES, OPTION_TYPES } from '../types';
import { paginationQuery } from '../utils/pagination';

const boolish = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listPizzasQuery = paginationQuery.extend({
  search: z.string().trim().max(60).optional(),
  category: z.enum(PIZZA_CATEGORIES).optional(),
  available: boolish.optional(),
  sort: z.enum(['name', 'price_asc', 'price_desc', 'newest']).default('name'),
});
export const listOptionsQuery = z.object({
  type: z.enum(OPTION_TYPES).optional(),
  available: boolish.optional(),
});
