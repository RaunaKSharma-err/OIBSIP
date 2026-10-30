import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import type {
  InventoryItem,
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  InventoryQueryParams,
  PaginatedResponse,
} from '@/types';

const MOCK_DELAY = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mockInventory: InventoryItem[] = [
  { id: 'inv-001', name: 'Pizza Dough', category: 'Base', unit: 'kg', quantity: 50, lowStockThreshold: 10, lastUpdated: new Date(Date.now() - 3600000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-002', name: 'Mozzarella Cheese', category: 'Cheese', unit: 'kg', quantity: 8, lowStockThreshold: 10, lastUpdated: new Date(Date.now() - 7200000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-003', name: 'Tomato Sauce', category: 'Sauce', unit: 'litres', quantity: 25, lowStockThreshold: 5, lastUpdated: new Date(Date.now() - 1800000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-004', name: 'Bell Peppers', category: 'Vegetable', unit: 'kg', quantity: 0, lowStockThreshold: 5, lastUpdated: new Date(Date.now() - 86400000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-005', name: 'Pepperoni Slices', category: 'Meat', unit: 'kg', quantity: 15, lowStockThreshold: 3, lastUpdated: new Date(Date.now() - 5400000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-006', name: 'Fresh Basil', category: 'Herb', unit: 'bunches', quantity: 12, lowStockThreshold: 5, lastUpdated: new Date(Date.now() - 10800000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-007', name: 'Olive Oil', category: 'Oil', unit: 'litres', quantity: 3, lowStockThreshold: 5, lastUpdated: new Date(Date.now() - 14400000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-008', name: 'Pizza Boxes (Large)', category: 'Packaging', unit: 'units', quantity: 200, lowStockThreshold: 50, lastUpdated: new Date(Date.now() - 21600000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-009', name: 'Jalapeños', category: 'Vegetable', unit: 'kg', quantity: 7, lowStockThreshold: 4, lastUpdated: new Date(Date.now() - 3600000).toISOString(), updatedBy: 'Admin' },
  { id: 'inv-010', name: 'Grilled Chicken', category: 'Meat', unit: 'kg', quantity: 2, lowStockThreshold: 5, lastUpdated: new Date(Date.now() - 7200000).toISOString(), updatedBy: 'Admin' },
];

export const inventoryService = {
  async getInventory(params: InventoryQueryParams = {}): Promise<PaginatedResponse<InventoryItem>> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      let filtered = [...mockInventory];
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
      }
      if (params.category) {
        filtered = filtered.filter((i) => i.category.toLowerCase() === params.category!.toLowerCase());
      }
      if (params.stockCondition && params.stockCondition !== 'all') {
        filtered = filtered.filter((i) => {
          if (params.stockCondition === 'out') return i.quantity <= 0;
          if (params.stockCondition === 'low') return i.quantity > 0 && i.quantity <= i.lowStockThreshold;
          if (params.stockCondition === 'healthy') return i.quantity > i.lowStockThreshold;
          return true;
        });
      }
      const page = params.page || 1;
      const limit = params.limit || 20;
      return {
        data: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit),
      };
    }
    const res = await apiClient.get<{ success: boolean; data: any[]; pagination: any }>('/admin/inventory', { params });
    return {
      data: (res.data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        unit: i.unit,
        quantity: i.stock ?? i.quantity,
        lowStockThreshold: i.lowStockThreshold,
        lastUpdated: i.lastStockChangeAt || new Date().toISOString(),
        updatedBy: 'Admin',
      })),
      total: res.pagination?.total ?? (res.data || []).length,
      page: res.pagination?.page ?? params.page ?? 1,
      limit: res.pagination?.limit ?? params.limit ?? 20,
      totalPages: res.pagination?.totalPages ?? 1,
    };
  },

  async getItem(id: string): Promise<InventoryItem> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const item = mockInventory.find((i) => i.id === id);
      if (!item) throw new Error('Item not found');
      return item;
    }
    const res = await apiClient.get<{ success: boolean; data: { item: InventoryItem } }>(`/admin/inventory/${id}`);
    return res.data.item;
  },

  async adjustStock(data: InventoryAdjustmentRequest): Promise<InventoryAdjustmentResponse> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const item = mockInventory.find((i) => i.id === data.itemId);
      if (!item) throw new Error('Item not found');
      const prev = item.quantity;
      item.quantity = Math.max(0, item.quantity + data.adjustment);
      item.lastUpdated = new Date().toISOString();
      return { item, previousQuantity: prev, newQuantity: item.quantity };
    }
    const res = await apiClient.post<{ success: boolean; data: { item: InventoryItem } }>(`/admin/inventory/${data.itemId}/adjustments`, { change: data.adjustment, reason: data.reason || 'manual adjustment' });
    return { item: res.data.item, previousQuantity: 0, newQuantity: res.data.item.quantity };
  },
};
