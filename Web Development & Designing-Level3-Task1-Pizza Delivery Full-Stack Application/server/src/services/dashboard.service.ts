import { InventoryItem } from '../models/InventoryItem';
import { Order } from '../models/Order';

/**
 * Revenue = sum of `total` of orders that are PAID and NOT cancelled, by paidAt, in INR paise.
 * Unpaid, failed and cancelled(-and-refundable) orders never count. Taxes are not modelled.
 */
export async function getDashboard(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const revenueMatch = (from: Date) => ({ paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' }, paidAt: { $gte: from } });
  const sum = (from: Date) =>
    Order.aggregate<{ _id: null; amount: number; orders: number }>([
      { $match: revenueMatch(from) },
      { $group: { _id: null, amount: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]);

  const [byStatus, pendingPayment, period, today, lowItems, outCount] = await Promise.all([
    Order.aggregate<{ _id: string; count: number }>([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ orderStatus: 'pending_payment' }),
    sum(since),
    sum(startOfToday),
    InventoryItem.find({ active: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
      .sort({ stock: 1 })
      .limit(10)
      .lean(),
    InventoryItem.countDocuments({ active: true, stock: 0 }),
  ]);
  const lowCount = await InventoryItem.countDocuments({ active: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } });

  const c = (s: string) => byStatus.find((b) => b._id === s)?.count ?? 0;
  const paidTotal = byStatus.reduce((n, b) => n + b.count, 0);
  return {
    orders: {
      total: paidTotal, // paid orders (any fulfilment status)
      awaitingProcessing: c('received'),
      inKitchen: c('kitchen'),
      inDelivery: c('delivery'),
      delivered: c('delivered'),
      cancelledPaid: c('cancelled'),
      pendingPayment,
    },
    revenue: {
      currency: 'INR',
      unit: 'paise',
      periodDays: days,
      periodAmount: period[0]?.amount ?? 0,
      periodOrders: period[0]?.orders ?? 0,
      todayAmount: today[0]?.amount ?? 0,
      todayOrders: today[0]?.orders ?? 0,
    },
    inventory: {
      lowStockCount: lowCount,
      outOfStockCount: outCount,
      lowStockItems: lowItems.map((i) => ({
        id: String(i._id),
        name: i.name,
        stock: i.stock,
        unit: i.unit,
        lowStockThreshold: i.lowStockThreshold,
        stockStatus: i.stock === 0 ? 'out' : 'low',
      })),
    },
    generatedAt: new Date().toISOString(),
  };
}
