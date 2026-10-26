import { Types } from 'mongoose';
import { env } from '../config/env';
import { Pizza } from '../models/Pizza';
import { PizzaOption, type IPizzaOption } from '../models/PizzaOption';
import type { IOptionSnapshot, IOrderItem } from '../models/Order';
import { ApiError } from '../utils/apiError';
import type { Requirement } from './inventory.service';

export interface CartItemInput {
  pizzaId: string;
  baseId: string;
  sauceId?: string;
  cheeseId?: string;
  toppingIds: string[];
  quantity: number;
}

export function deliveryFeeFor(subtotal: number): number {
  if (env.FREE_DELIVERY_ABOVE_PAISE > 0 && subtotal >= env.FREE_DELIVERY_ABOVE_PAISE) return 0;
  return env.DELIVERY_FEE_PAISE;
}

/** Pure arithmetic on integer paisa. */
export function calculateTotals(lineTotals: number[], discount = 0) {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const deliveryFee = deliveryFeeFor(subtotal);
  return { subtotal, deliveryFee, discount, total: subtotal + deliveryFee - discount };
}

const snapshot = (o: IPizzaOption): IOptionSnapshot => ({ option: o._id, name: o.name, price: o.price });
const invalid = (msg: string, details?: unknown) => new ApiError(422, 'INVALID_CUSTOMIZATION', msg, details);

/**
 * Re-prices a cart from the database. Nothing price-related is read from the client.
 * Validates availability and that every chosen option is offered for that pizza.
 */
export async function priceCart(items: CartItemInput[]) {
  const pizzaIds = [...new Set(items.map((i) => i.pizzaId))];
  const optionIds = [
    ...new Set(items.flatMap((i) => [i.baseId, i.sauceId, i.cheeseId, ...i.toppingIds].filter(Boolean) as string[])),
  ];
  const [pizzas, options] = await Promise.all([
    Pizza.find({ _id: { $in: pizzaIds } }).lean(),
    PizzaOption.find({ _id: { $in: optionIds } }).lean(),
  ]);
  const pizzaMap = new Map(pizzas.map((p) => [String(p._id), p]));
  const optionMap = new Map(options.map((o) => [String(o._id), o as IPizzaOption]));

  const lines: IOrderItem[] = [];
  const requirements = new Map<string, number>();
  const need = (item: Types.ObjectId, qty: number) => requirements.set(String(item), (requirements.get(String(item)) ?? 0) + qty);

  items.forEach((input, idx) => {
    const pizza = pizzaMap.get(input.pizzaId);
    if (!pizza) throw ApiError.notFound(`Pizza not found (item ${idx + 1})`, 'PIZZA_NOT_FOUND');
    if (!pizza.available) throw new ApiError(422, 'PIZZA_UNAVAILABLE', `${pizza.name} is currently unavailable`);

    const pick = (id: string, type: IPizzaOption['type'], allowed: Types.ObjectId[]) => {
      const o = optionMap.get(id);
      if (!o || o.type !== type) throw invalid(`Invalid ${type} selected for ${pizza.name}`);
      if (!allowed.some((a) => String(a) === id)) throw invalid(`${o.name} is not offered with ${pizza.name}`);
      if (!o.available) throw new ApiError(422, 'OPTION_UNAVAILABLE', `${o.name} is currently unavailable`);
      return o;
    };

    const base = pick(input.baseId, 'base', pizza.options.bases);
    const sauce = input.sauceId ? pick(input.sauceId, 'sauce', pizza.options.sauces) : undefined;
    const cheese = input.cheeseId ? pick(input.cheeseId, 'cheese', pizza.options.cheeses) : undefined;
    if (new Set(input.toppingIds).size !== input.toppingIds.length) throw invalid('Duplicate toppings are not allowed');
    const toppings = input.toppingIds.map((id) => pick(id, 'topping', pizza.options.toppings));

    const chosen = [base, sauce, cheese, ...toppings].filter(Boolean) as IPizzaOption[];
    const unitPrice = pizza.basePrice + chosen.reduce((sum, o) => sum + o.price, 0);
    lines.push({
      pizza: pizza._id,
      pizzaName: pizza.name,
      pizzaBasePrice: pizza.basePrice,
      quantity: input.quantity,
      base: snapshot(base),
      ...(sauce ? { sauce: snapshot(sauce) } : {}),
      ...(cheese ? { cheese: snapshot(cheese) } : {}),
      toppings: toppings.map(snapshot),
      unitPrice,
      lineTotal: unitPrice * input.quantity,
    });
    pizza.recipe.forEach((r) => need(r.item, r.quantity * input.quantity));
    chosen.forEach((o) => o.consumes.forEach((c) => need(c.item, c.quantity * input.quantity)));
  });

  const totals = calculateTotals(lines.map((l) => l.lineTotal));
  const reqs: Requirement[] = [...requirements.entries()].map(([item, quantity]) => ({
    item: new Types.ObjectId(item),
    quantity,
  }));
  return { lines, requirements: reqs, ...totals };
}
