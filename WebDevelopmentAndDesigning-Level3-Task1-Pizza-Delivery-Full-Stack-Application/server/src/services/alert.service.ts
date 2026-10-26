import type { FilterQuery, Types } from 'mongoose';
import { env } from '../config/env';
import { InventoryItem, type IInventoryItem } from '../models/InventoryItem';
import { sendMail } from '../utils/email';
import { logger } from '../utils/logger';

export interface AlertResult {
  sent: number;
  delivered: boolean;
  itemNames: string[];
}

/**
 * Low-stock alert state machine (per item, stored in `lowStockNotified`):
 *   stock <= threshold && !notified  -> claim (atomic), email, keep notified=true
 *   stock >  threshold && notified   -> reset notified=false (so a later drop alerts again)
 * The atomic claim means two app instances / a cron run + an inline check can never alert twice.
 * If the email is not delivered (SMTP missing/failing) the claim is reverted so it retries next run.
 */
export async function evaluateLowStock(itemIds?: Types.ObjectId[]): Promise<AlertResult> {
  const scope: FilterQuery<IInventoryItem> = itemIds ? { _id: { $in: itemIds } } : {};

  await InventoryItem.updateMany(
    { ...scope, lowStockNotified: true, $expr: { $gt: ['$stock', '$lowStockThreshold'] } },
    { $set: { lowStockNotified: false }, $unset: { lowStockNotifiedAt: 1 } },
  );

  const none: AlertResult = { sent: 0, delivered: false, itemNames: [] };
  if (!env.LOW_STOCK_ALERT_ENABLED) return none;

  const candidates = await InventoryItem.find({
    ...scope,
    active: true,
    lowStockNotified: false,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  });
  const claimed: IInventoryItem[] = [];
  for (const c of candidates) {
    const r = await InventoryItem.updateOne(
      { _id: c._id, lowStockNotified: false },
      { $set: { lowStockNotified: true, lowStockNotifiedAt: new Date() } },
    );
    if (r.modifiedCount === 1) claimed.push(c);
  }
  if (!claimed.length) return none;

  const revert = () =>
    InventoryItem.updateMany(
      { _id: { $in: claimed.map((c) => c._id) } },
      { $set: { lowStockNotified: false }, $unset: { lowStockNotifiedAt: 1 } },
    );

  const recipient = env.ADMIN_EMAIL;
  if (!recipient) {
    await revert();
    logger.warn('Low-stock items found but ADMIN_EMAIL is not configured', { count: claimed.length });
    return none;
  }

  const lines = claimed.map(
    (c) => `- ${c.name}: ${c.stock} ${c.unit} left (alert threshold ${c.lowStockThreshold} ${c.unit})${c.stock === 0 ? '  ** OUT OF STOCK **' : ''}`,
  );
  try {
    const result = await sendMail({
      to: recipient,
      subject: `Low stock alert: ${claimed.length} item${claimed.length > 1 ? 's' : ''} need restocking`,
      text: `The following inventory items are at or below their low-stock threshold:\n\n${lines.join('\n')}\n\nRestock them from the admin inventory page.`,
    });
    if (!result.delivered) {
      await revert();
      logger.warn('Low-stock alert NOT delivered (email preview mode); will retry on next check', { count: claimed.length });
      return { sent: 0, delivered: false, itemNames: claimed.map((c) => c.name) };
    }
    logger.info('Low-stock alert sent', { count: claimed.length, items: claimed.map((c) => c.name) });
    return { sent: claimed.length, delivered: true, itemNames: claimed.map((c) => c.name) };
  } catch (err) {
    await revert();
    logger.error('Low-stock alert email failed; will retry on next check', { err });
    return { sent: 0, delivered: false, itemNames: claimed.map((c) => c.name) };
  }
}
