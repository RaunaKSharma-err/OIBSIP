import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../src/services/pricing.service';
import { ORDER_STATUSES, canTransition } from '../src/types';
import { pageMeta } from '../src/utils/pagination';

describe('order status transitions', () => {
  it('allows the forward fulfilment path', () => {
    expect(canTransition('received', 'kitchen')).toBe(true);
    expect(canTransition('kitchen', 'delivery')).toBe(true);
    expect(canTransition('delivery', 'delivered')).toBe(true);
  });
  it('rejects skipping, going backwards and leaving terminal states', () => {
    expect(canTransition('received', 'delivery')).toBe(false);
    expect(canTransition('kitchen', 'received')).toBe(false);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'received')).toBe(false);
  });
  it('never lets an admin move pending_payment to a paid state', () => {
    for (const s of ORDER_STATUSES) if (s !== 'cancelled') expect(canTransition('pending_payment', s)).toBe(false);
  });
});

describe('pricing and pagination helpers', () => {
  it('adds the delivery fee to integer paise', () => {
    expect(calculateTotals([10000, 5000])).toEqual({ subtotal: 15000, deliveryFee: 4000, discount: 0, total: 19000 });
  });
  it('computes page metadata', () => {
    expect(pageMeta(2, 10, 25)).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(pageMeta(1, 12, 0).totalPages).toBe(0);
  });
});
