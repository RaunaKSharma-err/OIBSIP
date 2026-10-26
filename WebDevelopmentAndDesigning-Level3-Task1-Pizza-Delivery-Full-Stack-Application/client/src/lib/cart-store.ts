import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) =>
              i.pizzaId === item.pizzaId &&
              i.sizeName === item.sizeName &&
              i.baseName === item.baseName &&
              i.sauceName === item.sauceName &&
              i.cheeseName === item.cheeseName &&
              i.toppings.length === item.toppings.length &&
              i.toppings.every((t) =>
                item.toppings.some((nt) => nt.id === t.id)
              )
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === existing.id
                  ? {
                      ...i,
                      quantity: i.quantity + item.quantity,
                      totalPrice:
                        (i.quantity + item.quantity) * i.unitPrice,
                    }
                  : i
              ),
            };
          }

          return { items: [...state.items, item] };
        }),

      updateQuantity: (itemId, quantity) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    quantity,
                    totalPrice: quantity * item.unitPrice,
                  }
                : item
            )
            .filter((item) => item.quantity > 0),
        })),

      removeItem: (itemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        })),

      clearCart: () => set({ items: [] }),

      getTotalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),

      getSubtotal: () =>
        get().items.reduce((total, item) => total + item.totalPrice, 0),
    }),
    {
      name: 'pizza-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
