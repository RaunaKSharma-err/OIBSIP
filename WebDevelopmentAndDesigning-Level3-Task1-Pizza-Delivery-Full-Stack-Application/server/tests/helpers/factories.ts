import bcrypt from 'bcryptjs';
import { InventoryItem } from '../../src/models/InventoryItem';
import { Pizza } from '../../src/models/Pizza';
import { PizzaOption } from '../../src/models/PizzaOption';
import { User } from '../../src/models/User';
import { signAccessToken } from '../../src/utils/jwt';

export async function createUser(opts: { role?: 'customer' | 'admin'; verified?: boolean; email?: string } = {}) {
  const user = await User.create({
    name: 'Test User',
    email: opts.email ?? `user${Math.random().toString(36).slice(2, 8)}@example.test`,
    passwordHash: await bcrypt.hash('Password1', 4),
    role: opts.role ?? 'customer',
    emailVerified: opts.verified ?? true,
  });
  const token = signAccessToken({ id: String(user._id), role: user.role, tokenVersion: user.tokenVersion });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

/**
 * Pizza "Test Margherita" (base 20000 paise). Options: bases Classic(0)/Thin(2000), sauce(1000),
 * cheese(3000), topping Olives(5000). Another pizza offers a different topping to test invalid combos.
 */
export async function seedCatalog(doughStock = 100) {
  const dough = await InventoryItem.create({ name: 'Dough', category: 'dough', unit: 'unit', stock: doughStock, lowStockThreshold: 10 });
  const cheeseInv = await InventoryItem.create({ name: 'Cheese', category: 'cheese', unit: 'g', stock: 10000, lowStockThreshold: 500 });
  const box = await InventoryItem.create({ name: 'Box', category: 'packaging', unit: 'unit', stock: 500, lowStockThreshold: 20 });

  const base = await PizzaOption.create({ type: 'base', name: 'Classic', slug: 'base-classic', price: 0, consumes: [{ item: dough._id, quantity: 1 }] });
  const thin = await PizzaOption.create({ type: 'base', name: 'Thin', slug: 'base-thin', price: 2000, consumes: [{ item: dough._id, quantity: 1 }] });
  const sauce = await PizzaOption.create({ type: 'sauce', name: 'Tomato', slug: 'sauce-tomato', price: 1000 });
  const cheese = await PizzaOption.create({ type: 'cheese', name: 'Mozzarella', slug: 'cheese-moz', price: 3000, consumes: [{ item: cheeseInv._id, quantity: 80 }] });
  const olives = await PizzaOption.create({ type: 'topping', name: 'Olives', slug: 'top-olives', price: 5000 });
  const jalapeno = await PizzaOption.create({ type: 'topping', name: 'Jalapeno', slug: 'top-jalapeno', price: 2500 });

  const pizza = await Pizza.create({
    name: 'Test Margherita', slug: 'test-margherita', basePrice: 20000, category: 'veg',
    options: { bases: [base._id, thin._id], sauces: [sauce._id], cheeses: [cheese._id], toppings: [olives._id] },
    recipe: [{ item: box._id, quantity: 1 }],
  });
  const other = await Pizza.create({
    name: 'Spicy One', slug: 'spicy-one', basePrice: 25000, category: 'veg',
    options: { bases: [base._id], sauces: [sauce._id], cheeses: [cheese._id], toppings: [jalapeno._id] },
  });
  return { dough, cheeseInv, box, base, thin, sauce, cheese, olives, jalapeno, pizza, other };
}

export const delivery = {
  fullName: 'Asha Rai', phone: '9812345678', addressLine1: '12 Lake Road', city: 'Birgunj', state: 'Madhesh', postalCode: '44300',
};

export function orderBody(c: Awaited<ReturnType<typeof seedCatalog>>, over: Record<string, unknown> = {}) {
  return {
    items: [
      { pizzaId: String(c.pizza._id), baseId: String(c.base._id), sauceId: String(c.sauce._id), cheeseId: String(c.cheese._id), toppingIds: [String(c.olives._id)], quantity: 2 },
    ],
    delivery,
    ...over,
  };
}
/** 2 x (20000 + 0 + 1000 + 3000 + 5000) = 58000 paisa, + 4000 delivery (= NPR 620). */
export const EXPECTED = { subtotal: 58000, deliveryFee: 4000, total: 62000 };
