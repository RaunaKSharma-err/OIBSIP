export type PizzaCategory =
  | 'classic'
  | 'veg'
  | 'non-veg'
  | 'gourmet'
  | 'custom';

export interface PizzaBase {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
}

export interface PizzaSauce {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
}

export interface PizzaCheese {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
}

export interface PizzaTopping {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  isVegetarian: boolean;
}

export interface PizzaSize {
  id: string;
  name: string;
  priceMultiplier: number;
}

export interface Pizza {
  id: string;
  name: string;
  description: string;
  image: string;
  category: PizzaCategory;
  basePrice: number;
  isAvailable: boolean;
  isPopular: boolean;
  rating?: number;
  prepTimeMinutes?: number;
  sizes: PizzaSize[];
  defaultToppingIds: string[];
  ingredients?: string[];
}

export interface CustomPizzaConfig {
  baseId: string;
  sauceId: string;
  cheeseId: string;
  toppingIds: string[];
  sizeId: string;
  quantity: number;
}

export interface MenuQueryParams {
  search?: string;
  category?: PizzaCategory | 'all';
  isAvailable?: boolean;
  sortBy?: 'price-asc' | 'price-desc' | 'popular' | 'name';
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomizationOptions {
  bases: PizzaBase[];
  sauces: PizzaSauce[];
  cheeses: PizzaCheese[];
  toppings: PizzaTopping[];
  sizes: PizzaSize[];
}
