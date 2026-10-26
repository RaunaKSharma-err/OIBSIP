/**
 * Idempotent seed: `npm run seed`
 *  - Catalog (pizzas, options) and inventory items are UPSERTED by slug/name; re-running never duplicates.
 *  - Stock quantities are only set on first insert, so re-running never resets live inventory.
 *  - Admin account is created only if ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD are provided; an existing
 *    account is promoted to admin but its password is never overwritten.
 * DEVELOPMENT/DEMO sample data. No customers or orders are created.
 */
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import { InventoryItem } from '../models/InventoryItem';
import { Pizza } from '../models/Pizza';
import { PizzaOption } from '../models/PizzaOption';
import { User } from '../models/User';
import { logger } from '../utils/logger';

type Unit = 'g' | 'ml' | 'unit';
const inventory: Array<[string, string, Unit, number, number]> = [
  // name, category, unit, stock, lowStockThreshold
  ['Hand-tossed dough ball', 'dough', 'unit', 200, 30],
  ['Thin crust base', 'dough', 'unit', 120, 20],
  ['Whole wheat base', 'dough', 'unit', 100, 20],
  ['Gluten-free base', 'dough', 'unit', 60, 10],
  ['Tomato sauce', 'sauce', 'ml', 20000, 3000],
  ['Pesto sauce', 'sauce', 'ml', 8000, 1500],
  ['BBQ sauce', 'sauce', 'ml', 8000, 1500],
  ['White garlic sauce', 'sauce', 'ml', 8000, 1500],
  ['Mozzarella', 'cheese', 'g', 30000, 5000],
  ['Cheddar blend', 'cheese', 'g', 12000, 2000],
  ['Vegan cheese', 'cheese', 'g', 6000, 1000],
  ['Onion', 'vegetable', 'g', 8000, 1500],
  ['Capsicum', 'vegetable', 'g', 8000, 1500],
  ['Mushroom', 'vegetable', 'g', 6000, 1000],
  ['Black olives', 'vegetable', 'g', 4000, 800],
  ['Sweet corn', 'vegetable', 'g', 5000, 1000],
  ['Jalapeno', 'vegetable', 'g', 3000, 600],
  ['Paneer', 'vegetable', 'g', 6000, 1000],
  ['Chicken tikka', 'meat', 'g', 8000, 1500],
  ['Pepperoni', 'meat', 'g', 5000, 1000],
  ['Pizza box', 'packaging', 'unit', 300, 50],
];

// slug, type, name, price(paisa), inventory consumed
type Opt = [string, 'base' | 'sauce' | 'cheese' | 'topping', string, number, Array<[string, number]>];
const options: Opt[] = [
  ['base-hand-tossed', 'base', 'Hand-tossed', 0, [['Hand-tossed dough ball', 1]]],
  ['base-thin-crust', 'base', 'Thin crust', 0, [['Thin crust base', 1]]],
  ['base-whole-wheat', 'base', 'Whole wheat', 3000, [['Whole wheat base', 1]]],
  ['base-gluten-free', 'base', 'Gluten-free', 6000, [['Gluten-free base', 1]]],
  ['sauce-tomato', 'sauce', 'Classic tomato', 0, [['Tomato sauce', 60]]],
  ['sauce-pesto', 'sauce', 'Basil pesto', 2500, [['Pesto sauce', 50]]],
  ['sauce-bbq', 'sauce', 'Smoky BBQ', 2500, [['BBQ sauce', 50]]],
  ['sauce-white-garlic', 'sauce', 'White garlic', 2500, [['White garlic sauce', 50]]],
  ['cheese-mozzarella', 'cheese', 'Mozzarella', 0, [['Mozzarella', 80]]],
  ['cheese-cheddar-blend', 'cheese', 'Cheddar blend', 4000, [['Cheddar blend', 80]]],
  ['cheese-vegan', 'cheese', 'Vegan cheese', 5000, [['Vegan cheese', 80]]],
  ['top-onion', 'topping', 'Onion', 2000, [['Onion', 30]]],
  ['top-capsicum', 'topping', 'Capsicum', 2000, [['Capsicum', 30]]],
  ['top-mushroom', 'topping', 'Mushroom', 3000, [['Mushroom', 30]]],
  ['top-olives', 'topping', 'Black olives', 3000, [['Black olives', 20]]],
  ['top-corn', 'topping', 'Sweet corn', 2500, [['Sweet corn', 30]]],
  ['top-jalapeno', 'topping', 'Jalapeno', 2500, [['Jalapeno', 20]]],
  ['top-paneer', 'topping', 'Paneer', 4500, [['Paneer', 40]]],
  ['top-chicken-tikka', 'topping', 'Chicken tikka', 6000, [['Chicken tikka', 50]]],
  ['top-pepperoni', 'topping', 'Pepperoni', 6000, [['Pepperoni', 40]]],
];

const BASES = ['base-hand-tossed', 'base-thin-crust', 'base-whole-wheat', 'base-gluten-free'];
const SAUCES = ['sauce-tomato', 'sauce-pesto', 'sauce-bbq', 'sauce-white-garlic'];
const VEG_TOP = ['top-onion', 'top-capsicum', 'top-mushroom', 'top-olives', 'top-corn', 'top-jalapeno', 'top-paneer'];
const MEAT_TOP = ['top-chicken-tikka', 'top-pepperoni'];
const CHEESES = ['cheese-mozzarella', 'cheese-cheddar-blend'];

const pizzas = [
  { slug: 'margherita', name: 'Margherita', category: 'veg', basePrice: 19900, description: 'Classic tomato, mozzarella and fresh basil.', toppings: VEG_TOP, cheeses: CHEESES, recipe: [] as Array<[string, number]> },
  { slug: 'farmhouse', name: 'Farmhouse', category: 'veg', basePrice: 32900, description: 'Onion, capsicum, mushroom and sweet corn on a cheesy base.', toppings: VEG_TOP, cheeses: CHEESES, recipe: [['Onion', 25], ['Capsicum', 25], ['Mushroom', 25]] as Array<[string, number]> },
  { slug: 'paneer-tikka', name: 'Paneer Tikka', category: 'specialty', basePrice: 34900, description: 'Tandoori-spiced paneer with onions and capsicum.', toppings: VEG_TOP, cheeses: CHEESES, recipe: [['Paneer', 60], ['Onion', 20]] as Array<[string, number]> },
  { slug: 'chicken-tikka', name: 'Chicken Tikka', category: 'non-veg', basePrice: 37900, description: 'Smoky chicken tikka with onions and green chillies.', toppings: [...VEG_TOP, ...MEAT_TOP], cheeses: CHEESES, recipe: [['Chicken tikka', 80], ['Onion', 20]] as Array<[string, number]> },
  { slug: 'pepperoni-feast', name: 'Pepperoni Feast', category: 'non-veg', basePrice: 39900, description: 'Loaded with pepperoni and extra mozzarella.', toppings: [...VEG_TOP, ...MEAT_TOP], cheeses: CHEESES, recipe: [['Pepperoni', 80]] as Array<[string, number]> },
  { slug: 'vegan-garden', name: 'Vegan Garden', category: 'vegan', basePrice: 36900, description: 'Seasonal vegetables, pesto and dairy-free cheese.', toppings: VEG_TOP.filter((t) => t !== 'top-paneer'), cheeses: ['cheese-vegan'], recipe: [['Capsicum', 25], ['Mushroom', 25], ['Black olives', 15]] as Array<[string, number]> },
];

async function main() {
  await connectDb();

  const itemIds = new Map<string, any>();
  for (const [name, category, unit, stock, lowStockThreshold] of inventory) {
    const doc = await InventoryItem.findOneAndUpdate(
      { name },
      { $set: { category, unit, lowStockThreshold }, $setOnInsert: { stock, active: true, lowStockNotified: false } },
      { upsert: true, new: true },
    );
    itemIds.set(name, doc!._id);
  }
  const inv = (name: string) => {
    const id = itemIds.get(name);
    if (!id) throw new Error(`Seed error: unknown inventory item "${name}"`);
    return id;
  };

  const optionIds = new Map<string, any>();
  for (const [slug, type, name, price, consumes] of options) {
    const doc = await PizzaOption.findOneAndUpdate(
      { slug },
      { $set: { type, name, price, consumes: consumes.map(([n, quantity]) => ({ item: inv(n), quantity })) }, $setOnInsert: { available: true } },
      { upsert: true, new: true },
    );
    optionIds.set(slug, doc!._id);
  }
  const opt = (slugs: string[]) => slugs.map((s) => optionIds.get(s));

  for (const p of pizzas) {
    await Pizza.findOneAndUpdate(
      { slug: p.slug },
      {
        $set: {
          name: p.name,
          description: p.description,
          category: p.category,
          basePrice: p.basePrice,
          imageUrl: `/images/pizzas/${p.slug}.jpg`,
          options: { bases: opt(BASES), sauces: opt(SAUCES), cheeses: opt(p.cheeses), toppings: opt(p.toppings) },
          recipe: [...p.recipe, ['Pizza box', 1] as [string, number]].map(([n, quantity]) => ({ item: inv(n), quantity })),
        },
        $setOnInsert: { available: true },
      },
      { upsert: true },
    );
  }
  logger.info('Catalog seeded', { pizzas: pizzas.length, options: options.length, inventoryItems: inventory.length });

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters');
    const existing = await User.findOne({ email });
    if (existing) {
      await User.updateOne({ _id: existing._id }, { $set: { role: 'admin', emailVerified: true } });
      logger.info('Existing user promoted to admin (password unchanged)');
    } else {
      await User.create({
        name: process.env.ADMIN_SEED_NAME?.trim() || 'Store Admin',
        email,
        passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
        role: 'admin',
        emailVerified: true,
      });
      logger.info('Admin account created');
    }
  } else {
    logger.warn('ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set: no admin account was created');
  }
  await disconnectDb();
}

main().catch(async (err) => {
  logger.error('Seed failed', { err });
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
