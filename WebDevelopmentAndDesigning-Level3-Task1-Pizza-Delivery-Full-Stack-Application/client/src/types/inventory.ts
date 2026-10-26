export type StockCondition = 'healthy' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  lastUpdated: string;
  updatedBy?: string;
}

export interface InventoryAdjustmentRequest {
  itemId: string;
  adjustment: number;
  reason?: string;
}

export interface InventoryAdjustmentResponse {
  item: InventoryItem;
  previousQuantity: number;
  newQuantity: number;
}

export interface InventoryQueryParams {
  search?: string;
  category?: string;
  stockCondition?: StockCondition | 'all';
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}
