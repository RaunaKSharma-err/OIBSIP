import { Schema, model, type Types } from 'mongoose';
import { PIZZA_CATEGORIES } from '../types';
import { consumesSchema, optionDto, type IConsumes } from './PizzaOption';

export interface IPizza {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /** Price in paisa before customisation. */
  basePrice: number;
  category: (typeof PIZZA_CATEGORIES)[number];
  available: boolean;
  options: {
    bases: Types.ObjectId[];
    sauces: Types.ObjectId[];
    cheeses: Types.ObjectId[];
    toppings: Types.ObjectId[];
  };
  /** Inventory consumed by the pizza itself (packaging, default toppings, ...). */
  recipe: IConsumes[];
  createdAt: Date;
}

const ref = () => [{ type: Schema.Types.ObjectId, ref: 'PizzaOption' }];

const pizzaSchema = new Schema<IPizza>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    imageUrl: { type: String, default: '' },
    basePrice: { type: Number, required: true, min: 0, validate: Number.isInteger },
    category: { type: String, enum: PIZZA_CATEGORIES, required: true, index: true },
    available: { type: Boolean, default: true, index: true },
    options: {
      bases: ref(),
      sauces: ref(),
      cheeses: ref(),
      toppings: ref(),
    },
    recipe: { type: [consumesSchema], default: [] },
  },
  { timestamps: true },
);

export const Pizza = model<IPizza>('Pizza', pizzaSchema);

/** `p` must have its `options.*` arrays populated with PizzaOption documents. */
export const pizzaDto = (p: any) => ({
  id: String(p._id),
  name: p.name,
  slug: p.slug,
  description: p.description,
  imageUrl: p.imageUrl,
  category: p.category,
  basePrice: p.basePrice,
  available: p.available,
  options: {
    bases: (p.options?.bases ?? []).map(optionDto),
    sauces: (p.options?.sauces ?? []).map(optionDto),
    cheeses: (p.options?.cheeses ?? []).map(optionDto),
    toppings: (p.options?.toppings ?? []).map(optionDto),
  },
});
