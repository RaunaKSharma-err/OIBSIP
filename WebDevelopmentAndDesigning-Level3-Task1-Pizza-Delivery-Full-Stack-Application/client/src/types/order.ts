export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'kitchen'
  | 'delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 'esewa' | 'cod';

export interface CartItemTopping {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  pizzaId: string;
  pizzaName: string;
  pizzaImage: string;
  basePrice: number;
  sizeName?: string;
  sizePriceMultiplier: number;
  baseId?: string;
  baseName?: string;
  basePriceAddon: number;
  sauceId?: string;
  sauceName?: string;
  saucePriceAddon: number;
  cheeseId?: string;
  cheeseName?: string;
  cheesePriceAddon: number;
  toppingIds?: string[];
  toppings: CartItemTopping[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isCustom: boolean;
}

export interface DeliveryInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  instructions?: string;
}

export interface OrderItem {
  pizzaId: string;
  pizzaName: string;
  pizzaImage: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customDetails?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  deliveryInfo: DeliveryInfo;
  delivery?: any;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryTime?: string;
}

export interface CreateOrderRequest {
  items: {
    pizzaId: string;
    quantity: number;
    customConfig?: {
      baseId: string;
      sauceId: string;
      cheeseId: string;
      toppingIds: string[];
      sizeId: string;
    };
  }[];
  deliveryInfo: DeliveryInfo;
  delivery?: any;
  paymentMethod: PaymentMethod;
  couponCode?: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
}

export interface OrderTrackingStep {
  status: OrderStatus;
  label: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  timestamp?: string;
}
