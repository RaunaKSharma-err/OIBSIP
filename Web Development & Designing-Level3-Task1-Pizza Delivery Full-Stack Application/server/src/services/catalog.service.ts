import type { FilterQuery } from 'mongoose';
import { Pizza, pizzaDto, type IPizza } from '../models/Pizza';
import { PizzaOption, optionDto, type IPizzaOption } from '../models/PizzaOption';
import { ApiError } from '../utils/apiError';
import { escapeRegex, pageMeta, skipFor } from '../utils/pagination';

const SORTS = {
  name: { name: 1 },
  price_asc: { basePrice: 1, name: 1 },
  price_desc: { basePrice: -1, name: 1 },
  newest: { createdAt: -1 },
} as const;

const populateOptions = [
  { path: 'options.bases' },
  { path: 'options.sauces' },
  { path: 'options.cheeses' },
  { path: 'options.toppings' },
];

export async function listPizzas(q: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  available?: boolean;
  sort: keyof typeof SORTS;
}) {
  const filter: FilterQuery<IPizza> = {};
  if (q.search) filter.name = { $regex: escapeRegex(q.search), $options: 'i' };
  if (q.category) filter.category = q.category as IPizza['category'];
  if (q.available !== undefined) filter.available = q.available;
  const [docs, total] = await Promise.all([
    Pizza.find(filter).sort(SORTS[q.sort]).skip(skipFor(q.page, q.limit)).limit(q.limit).populate(populateOptions).lean(),
    Pizza.countDocuments(filter),
  ]);
  return { data: docs.map(pizzaDto), pagination: pageMeta(q.page, q.limit, total) };
}

export async function getPizza(id: string) {
  const pizza = await Pizza.findById(id).populate(populateOptions).lean();
  if (!pizza) throw ApiError.notFound('Pizza not found', 'PIZZA_NOT_FOUND');
  return pizzaDto(pizza);
}

export async function listOptions(q: { type?: string; available?: boolean }) {
  const filter: FilterQuery<IPizzaOption> = {};
  if (q.type) filter.type = q.type as IPizzaOption['type'];
  if (q.available !== undefined) filter.available = q.available;
  const docs = await PizzaOption.find(filter).sort({ type: 1, name: 1 }).lean();
  return docs.map(optionDto);
}
