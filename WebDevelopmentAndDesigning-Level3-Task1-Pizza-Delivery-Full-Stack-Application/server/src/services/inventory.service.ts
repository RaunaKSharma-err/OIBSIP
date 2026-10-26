import mongoose, { type ClientSession, type FilterQuery, type Types } from 'mongoose';
import { env } from '../config/env';
import { InventoryItem, inventoryDto, type IInventoryItem } from '../models/InventoryItem';
import { InventoryTransaction, transactionDto } from '../models/InventoryTransaction';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { escapeRegex, pageMeta, skipFor } from '../utils/pagination';
import { evaluateLowStock } from './alert.service';

export interface Requirement {
  item: Types.ObjectId;
  quantity: number;
}

// ---------------------------------------------------------------------------------------------
// Transactions are used when MongoDB supports them (replica set / sharded cluster). On a standalone
// server we fall back to ordered conditional writes + a compensating undo (see README "Inventory").
// ---------------------------------------------------------------------------------------------
let txnUnsupported = env.MONGO_TRANSACTIONS === 'off';

export async function withOptionalTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (txnUnsupported) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err: any) {
    if (err?.code === 20 || /Transaction numbers are only allowed/i.test(err?.message ?? '')) {
      txnUnsupported = true;
      logger.warn('MongoDB transactions unsupported on this deployment; using conditional-update fallback');
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/** Atomically removes stock for each requirement; throws INSUFFICIENT_STOCK without partial effects. */
export async function reserveStock(orderId: Types.ObjectId, reqs: Requirement[], cycle: number, session?: ClientSession) {
  const applied: Requirement[] = [];
  try {
    for (const r of reqs) {
      const res = await InventoryItem.updateOne(
        { _id: r.item, active: true, stock: { $gte: r.quantity } },
        { $inc: { stock: -r.quantity }, $set: { lastStockChangeAt: new Date() } },
        { session },
      );
      if (res.modifiedCount !== 1) {
        const item = await InventoryItem.findById(r.item).select('name').session(session ?? null);
        throw ApiError.conflict('INSUFFICIENT_STOCK', `Sorry, we are out of an ingredient needed for your order${item ? ` (${item.name})` : ''}`, {
          itemId: String(r.item),
        });
      }
      applied.push(r);
      await InventoryTransaction.create(
        [
          {
            item: r.item,
            type: 'order_reserve',
            quantityChange: -r.quantity,
            order: orderId,
            cycle,
            reason: 'Stock reserved for order',
            actor: { kind: 'system' },
          },
        ],
        { session },
      );
    }
  } catch (err) {
    if (!session) await undoReserve(orderId, applied, cycle); // no transaction to roll back for us
    throw err;
  }
  return applied;
}

export async function undoReserve(orderId: Types.ObjectId, applied: Requirement[], cycle: number) {
  for (const r of applied) {
    await InventoryItem.updateOne({ _id: r.item }, { $inc: { stock: r.quantity } });
    await InventoryTransaction.deleteOne({ order: orderId, item: r.item, type: 'order_reserve', cycle });
  }
}

/** Returns reserved stock. Idempotent: the ledger row for (order,item,release,cycle) is written at most once. */
export async function releaseStock(orderId: Types.ObjectId, reqs: Requirement[], cycle: number, session?: ClientSession) {
  for (const r of reqs) {
    const done = await InventoryTransaction.exists({ order: orderId, item: r.item, type: 'order_release', cycle }).session(session ?? null);
    if (done) continue;
    await InventoryTransaction.create(
      [
        {
          item: r.item,
          type: 'order_release',
          quantityChange: r.quantity,
          order: orderId,
          cycle,
          reason: 'Reserved stock released',
          actor: { kind: 'system' },
        },
      ],
      { session },
    );
    await InventoryItem.updateOne({ _id: r.item }, { $inc: { stock: r.quantity }, $set: { lastStockChangeAt: new Date() } }, { session });
  }
}

export async function afterStockChange(itemIds: Types.ObjectId[]) {
  try {
    await evaluateLowStock(itemIds);
  } catch (err) {
    logger.error('Low-stock evaluation failed', { err });
  }
}

// ---------------------------------- admin operations ------------------------------------------

export async function listInventory(q: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: 'ok' | 'low' | 'out';
  active?: boolean;
}) {
  const filter: FilterQuery<IInventoryItem> = {};
  if (q.search) filter.name = { $regex: escapeRegex(q.search), $options: 'i' };
  if (q.category) filter.category = q.category as IInventoryItem['category'];
  if (q.active !== undefined) filter.active = q.active;
  if (q.status === 'out') filter.stock = 0;
  if (q.status === 'low') filter.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  if (q.status === 'ok') filter.$expr = { $gt: ['$stock', '$lowStockThreshold'] };
  const [docs, total] = await Promise.all([
    InventoryItem.find(filter).sort({ name: 1 }).skip(skipFor(q.page, q.limit)).limit(q.limit).lean(),
    InventoryItem.countDocuments(filter),
  ]);
  return { data: docs.map((d) => inventoryDto(d as IInventoryItem)), pagination: pageMeta(q.page, q.limit, total) };
}

export async function getInventoryItem(id: string) {
  const item = await InventoryItem.findById(id).lean();
  if (!item) throw ApiError.notFound('Inventory item not found', 'INVENTORY_NOT_FOUND');
  return inventoryDto(item as IInventoryItem);
}

export async function createInventoryItem(
  input: { name: string; category: any; unit: any; stock: number; lowStockThreshold: number },
  adminId: string,
) {
  const item = await InventoryItem.create(input);
  if (input.stock > 0) {
    await InventoryTransaction.create({
      item: item._id,
      type: 'initial',
      quantityChange: input.stock,
      reason: 'Initial stock',
      actor: { kind: 'admin', user: adminId },
    });
  }
  await afterStockChange([item._id]);
  return inventoryDto((await InventoryItem.findById(item._id).lean()) as IInventoryItem);
}

export async function updateInventoryItem(id: string, patch: Partial<Pick<IInventoryItem, 'name' | 'category' | 'lowStockThreshold' | 'active'>>) {
  const item = await InventoryItem.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!item) throw ApiError.notFound('Inventory item not found', 'INVENTORY_NOT_FOUND');
  await afterStockChange([item._id]); // threshold may have changed
  return inventoryDto((await InventoryItem.findById(id).lean()) as IInventoryItem);
}

export async function adjustStock(id: string, change: number, reason: string, adminId: string) {
  // Conditional update: stock can never go negative, even under concurrent adjustments.
  const filter: FilterQuery<IInventoryItem> = { _id: id };
  if (change < 0) filter.stock = { $gte: -change };
  const updated = await InventoryItem.findOneAndUpdate(
    filter,
    { $inc: { stock: change }, $set: { lastStockChangeAt: new Date() } },
    { new: true },
  );
  if (!updated) {
    if (!(await InventoryItem.exists({ _id: id }))) throw ApiError.notFound('Inventory item not found', 'INVENTORY_NOT_FOUND');
    throw ApiError.conflict('INSUFFICIENT_STOCK', 'Adjustment would make stock negative');
  }
  await InventoryTransaction.create({
    item: updated._id,
    type: change > 0 ? 'restock' : 'adjustment',
    quantityChange: change,
    reason,
    actor: { kind: 'admin', user: adminId },
  });
  logger.info('Inventory adjusted', { itemId: id, change, adminId });
  await afterStockChange([updated._id]);
  return inventoryDto((await InventoryItem.findById(id).lean()) as IInventoryItem);
}

export async function listTransactions(id: string, q: { page: number; limit: number }) {
  if (!(await InventoryItem.exists({ _id: id }))) throw ApiError.notFound('Inventory item not found', 'INVENTORY_NOT_FOUND');
  const [docs, total] = await Promise.all([
    InventoryTransaction.find({ item: id }).sort({ createdAt: -1 }).skip(skipFor(q.page, q.limit)).limit(q.limit).lean(),
    InventoryTransaction.countDocuments({ item: id }),
  ]);
  return { data: docs.map((d) => transactionDto(d as any)), pagination: pageMeta(q.page, q.limit, total) };
}
