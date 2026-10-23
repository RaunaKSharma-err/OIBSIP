import { Schema, model, type Types } from 'mongoose';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../types';

export interface IInventoryItem {
  _id: Types.ObjectId;
  name: string;
  category: (typeof INVENTORY_CATEGORIES)[number];
  /** g, ml or unit. Stock is an INTEGER in this base unit (no floats). */
  unit: (typeof INVENTORY_UNITS)[number];
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  /** Low-stock alert state: true once an alert was sent; reset when stock rises above the threshold. */
  lowStockNotified: boolean;
  lowStockNotifiedAt?: Date;
  lastStockChangeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const int = { validator: Number.isInteger, message: '{PATH} must be an integer' };

const inventoryItemSchema = new Schema<IInventoryItem>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    category: { type: String, enum: INVENTORY_CATEGORIES, required: true, index: true },
    unit: { type: String, enum: INVENTORY_UNITS, required: true },
    stock: { type: Number, required: true, min: 0, validate: int, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, validate: int, default: 0 },
    active: { type: Boolean, default: true },
    lowStockNotified: { type: Boolean, default: false },
    lowStockNotifiedAt: { type: Date },
    lastStockChangeAt: { type: Date },
  },
  { timestamps: true },
);

export const InventoryItem = model<IInventoryItem>('InventoryItem', inventoryItemSchema);

export type StockStatus = 'ok' | 'low' | 'out';
export const stockStatus = (i: Pick<IInventoryItem, 'stock' | 'lowStockThreshold'>): StockStatus =>
  i.stock <= 0 ? 'out' : i.stock <= i.lowStockThreshold ? 'low' : 'ok';

export const inventoryDto = (i: IInventoryItem) => ({
  id: String(i._id),
  name: i.name,
  category: i.category,
  unit: i.unit,
  stock: i.stock,
  lowStockThreshold: i.lowStockThreshold,
  active: i.active,
  stockStatus: stockStatus(i),
  lowStockNotified: i.lowStockNotified,
  updatedAt: i.updatedAt,
});
