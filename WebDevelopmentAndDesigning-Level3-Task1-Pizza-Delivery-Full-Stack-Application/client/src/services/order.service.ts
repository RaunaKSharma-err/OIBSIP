import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import type {
  Order,
  CreateOrderRequest,
  OrderStatusUpdate,
  OrderTrackingStep,
  OrderStatus,
} from '@/types';

const MOCK_DELAY = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mockOrders: Order[] = [
  {
    id: 'order-001',
    orderNumber: 'ORD-2024-0001',
    userId: 'user-001',
    items: [
      {
        pizzaId: 'pizza-001',
        pizzaName: 'Margherita Classic',
        pizzaImage: 'https://images.pexels.com/photos/315755/pizza-315755.jpeg',
        quantity: 2,
        unitPrice: 199,
        totalPrice: 398,
      },
    ],
    subtotal: 398,
    deliveryCharge: 40,
    discount: 0,
    total: 438,
    paymentStatus: 'paid',
    paymentMethod: 'razorpay',
    orderStatus: 'delivery',
    deliveryInfo: {
      name: 'John Customer',
      phone: '9876543210',
      address: '123 Main Street, Apt 4B',
      city: 'Mumbai',
    },
    razorpayOrderId: 'rzp_order_mock1',
    razorpayPaymentId: 'rzp_pay_mock1',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    estimatedDeliveryTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'order-002',
    orderNumber: 'ORD-2024-0002',
    userId: 'user-001',
    items: [
      {
        pizzaId: 'pizza-006',
        pizzaName: 'Paneer Tikka Masala',
        pizzaImage: 'https://images.pexels.com/photos/845811/pexels-photo-845811.jpeg',
        quantity: 1,
        unitPrice: 279,
        totalPrice: 279,
      },
    ],
    subtotal: 279,
    deliveryCharge: 40,
    discount: 0,
    total: 319,
    paymentStatus: 'pending',
    paymentMethod: 'razorpay',
    orderStatus: 'received',
    deliveryInfo: {
      name: 'John Customer',
      phone: '9876543210',
      address: '123 Main Street, Apt 4B',
      city: 'Mumbai',
    },
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
];

export const orderService = {
  async getOrders(): Promise<Order[]> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return mockOrders;
    }
    return apiClient.get<Order[]>('/orders');
  },

  async getOrder(id: string): Promise<Order> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const order = mockOrders.find((o) => o.id === id || o.orderNumber === id);
      if (!order) throw new Error('Order not found');
      return order;
    }
    return apiClient.get<Order>(`/orders/${id}`);
  },

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const order: Order = {
        id: `order-${Date.now()}`,
        orderNumber: `ORD-2024-${String(mockOrders.length + 1).padStart(4, '0')}`,
        userId: 'user-001',
        items: data.items.map((item, idx) => ({
          pizzaId: item.pizzaId,
          pizzaName: `Pizza ${idx + 1}`,
          pizzaImage: '',
          quantity: item.quantity,
          unitPrice: 250,
          totalPrice: 250 * item.quantity,
        })),
        subtotal: 250 * data.items.reduce((sum, i) => sum + i.quantity, 0),
        deliveryCharge: 40,
        discount: 0,
        total: 250 * data.items.reduce((sum, i) => sum + i.quantity, 0) + 40,
        paymentStatus: 'pending',
        paymentMethod: data.paymentMethod,
        orderStatus: 'received',
        deliveryInfo: data.deliveryInfo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockOrders.push(order);
      return order;
    }
    return apiClient.post<Order>('/orders', data);
  },

  async updateOrderStatus(update: OrderStatusUpdate): Promise<Order> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const order = mockOrders.find((o) => o.id === update.orderId);
      if (!order) throw new Error('Order not found');
      order.orderStatus = update.status;
      order.updatedAt = new Date().toISOString();
      return order;
    }
    return apiClient.patch<Order>(`/orders/${update.orderId}/status`, {
      status: update.status,
    });
  },

  async getAllOrdersAdmin(params?: {
    status?: OrderStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Order[]; total: number; page: number; totalPages: number }> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      let filtered = [...mockOrders];
      if (params?.status) {
        filtered = filtered.filter((o) => o.orderStatus === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            o.deliveryInfo.name.toLowerCase().includes(q)
        );
      }
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      return {
        data: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page,
        totalPages: Math.ceil(filtered.length / limit),
      };
    }
    return apiClient.get('/orders/admin/all', { params });
  },

  getOrderTrackingSteps(order: Order): OrderTrackingStep[] {
    const statusFlow: { status: OrderStatus; label: string; description: string }[] = [
      { status: 'received', label: 'Order Received', description: 'Your order has been placed' },
      { status: 'kitchen', label: 'In the Kitchen', description: 'Your pizza is being prepared' },
      { status: 'delivery', label: 'Out for Delivery', description: 'Your order is on its way' },
      { status: 'delivered', label: 'Delivered', description: 'Enjoy your pizza!' },
    ];

    const currentIndex = statusFlow.findIndex((s) => s.status === order.orderStatus);

    if (order.orderStatus === 'cancelled') {
      return statusFlow.map((s) => ({
        ...s,
        isCompleted: false,
        isCurrent: false,
      }));
    }

    return statusFlow.map((step, index) => ({
      status: step.status,
      label: step.label,
      description: step.description,
      isCompleted: index < currentIndex,
      isCurrent: index === currentIndex,
      timestamp:
        index === currentIndex ? order.updatedAt : index < currentIndex ? order.createdAt : undefined,
    }));
  },
};
