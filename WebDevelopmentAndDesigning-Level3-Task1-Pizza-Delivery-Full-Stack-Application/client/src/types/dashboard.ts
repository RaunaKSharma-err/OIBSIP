export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  outForDelivery: number;
  lowStockCount: number;
  revenue: number;
}

export interface OrderStatusDistribution {
  status: string;
  count: number;
}

export interface DashboardData {
  stats: DashboardStats;
  orderStatusDistribution: OrderStatusDistribution[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    orderStatus: string;
    paymentStatus: string;
    createdAt: string;
  }[];
  lowStockItems: {
    id: string;
    name: string;
    quantity: number;
    lowStockThreshold: number;
    unit: string;
  }[];
}
