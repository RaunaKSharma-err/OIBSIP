import { Schema, model, type Types } from 'mongoose';
import type { OptionType } from '../types';

export interface IConsumes {
  item: Types.ObjectId;
  quantity: number;
}
export interface IPizzaOption {
  _id: Types.ObjectId;
  type: OptionType;
  name: string;
  slug: string;
  /** Additional price in paisa. */
  price: number;
  available: boolean;
  /** Inventory consumed per pizza that uses this option. */
  consumes: IConsumes[];
}

export const consumesSchema = new Schema<IConsumes>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false },
);

const pizzaOptionSchema = new Schema<IPizzaOption>(
  {
    type: { type: String, enum: ['base', 'sauce', 'cheese', 'topping'], required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    available: { type: Boolean, default: true },
    consumes: { type: [consumesSchema], default: [] },
  },
  { timestamps: true },
);

export const PizzaOption = model<IPizzaOption>('PizzaOption', pizzaOptionSchema);

export const optionDto = (o: Pick<IPizzaOption, '_id' | 'type' | 'name' | 'price' | 'available'>) => ({
  id: String(o._id),
  type: o.type,
  name: o.name,
  price: o.price,
  available: o.available,
});
