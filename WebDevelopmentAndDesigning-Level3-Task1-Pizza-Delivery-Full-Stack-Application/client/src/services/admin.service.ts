import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import type { DashboardData } from '@/types';

const MOCK_DELAY = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const adminService = {
  async getDashboardData(): Promise<DashboardData> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return {
        stats: {
          totalOrders: 348,
          pendingOrders: 12,
          preparingOrders: 8,
          outForDelivery: 5,
          lowStockCount: 4,
          revenue: 184750,
        },
        orderStatusDistribution: [
          { status: 'received', count: 45 },
          { status: 'kitchen', count: 28 },
          { status: 'delivery', count: 15 },
          { status: 'delivered', count: 250 },
          { status: 'cancelled', count: 10 },
        ],
        recentOrders: [
          { id: 'order-001', orderNumber: 'ORD-2024-0001', customerName: 'John Customer', total: 438, orderStatus: 'delivery', paymentStatus: 'paid', createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
          { id: 'order-002', orderNumber: 'ORD-2024-0002', customerName: 'Priya Sharma', total: 319, orderStatus: 'received', paymentStatus: 'pending', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
          { id: 'order-003', orderNumber: 'ORD-2024-0003', customerName: 'Rahul Verma', total: 678, orderStatus: 'kitchen', paymentStatus: 'paid', createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
          { id: 'order-004', orderNumber: 'ORD-2024-0004', customerName: 'Sneha Patel', total: 259, orderStatus: 'delivered', paymentStatus: 'paid', createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
          { id: 'order-005', orderNumber: 'ORD-2024-0005', customerName: 'Amit Kumar', total: 540, orderStatus: 'delivered', paymentStatus: 'paid', createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
        ],
        lowStockItems: [
          { id: 'inv-002', name: 'Mozzarella Cheese', quantity: 8, lowStockThreshold: 10, unit: 'kg' },
          { id: 'inv-004', name: 'Bell Peppers', quantity: 0, lowStockThreshold: 5, unit: 'kg' },
          { id: 'inv-007', name: 'Olive Oil', quantity: 3, lowStockThreshold: 5, unit: 'litres' },
          { id: 'inv-010', name: 'Grilled Chicken', quantity: 2, lowStockThreshold: 5, unit: 'kg' },
        ],
      };
    }
    const res = await apiClient.get<{ success: boolean; data: any }>('/admin/dashboard');
    const d = res.data;
    return {
      stats: {
        totalOrders: d.orders?.total ?? 0,
        pendingOrders: d.orders?.awaitingProcessing ?? 0,
        preparingOrders: d.orders?.inKitchen ?? 0,
        outForDelivery: d.orders?.inDelivery ?? 0,
        lowStockCount: d.inventory?.lowStockCount ?? 0,
        revenue: d.revenue?.todayAmount ?? 0,
      },
      orderStatusDistribution: [
        { status: 'received', count: d.orders?.awaitingProcessing ?? 0 },
        { status: 'kitchen', count: d.orders?.inKitchen ?? 0 },
        { status: 'delivery', count: d.orders?.inDelivery ?? 0 },
        { status: 'delivered', count: d.orders?.delivered ?? 0 },
        { status: 'cancelled', count: d.orders?.cancelledPaid ?? 0 },
      ],
      recentOrders: [],
      lowStockItems: (d.inventory?.lowStockItems || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.stock,
        lowStockThreshold: i.lowStockThreshold,
        unit: i.unit,
      })),
    };
  },
};
