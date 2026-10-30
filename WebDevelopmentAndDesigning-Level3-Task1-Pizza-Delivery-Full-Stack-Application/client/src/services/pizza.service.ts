import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import { mockPizzas, mockCustomizationOptions } from './mock-data';
import type {
  Pizza,
  CustomizationOptions,
  MenuQueryParams,
  PaginatedResponse,
  PizzaBase,
  PizzaSauce,
  PizzaCheese,
  PizzaTopping,
  PizzaSize,
} from '@/types';

const MOCK_DELAY = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockGetPizzas(params: MenuQueryParams): Promise<PaginatedResponse<Pizza>> {
  await delay(MOCK_DELAY);
  let filtered = [...mockPizzas];

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  if (params.category && params.category !== 'all') {
    filtered = filtered.filter((p) => p.category === params.category);
  }

  if (params.isAvailable !== undefined) {
    filtered = filtered.filter((p) => p.isAvailable === params.isAvailable);
  }

  switch (params.sortBy) {
    case 'price-asc':
      filtered.sort((a, b) => a.basePrice - b.basePrice);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.basePrice - a.basePrice);
      break;
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'popular':
    default:
      filtered.sort((a, b) => Number(b.isPopular) - Number(a.isPopular));
      break;
  }

  const page = params.page || 1;
  const limit = params.limit || 12;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    total: filtered.length,
    page,
    limit,
    totalPages: Math.ceil(filtered.length / limit),
  };
}

const defaultSizes: PizzaSize[] = [
  { id: 'small', name: 'Small', priceMultiplier: 0.8 },
  { id: 'medium', name: 'Medium', priceMultiplier: 1 },
  { id: 'large', name: 'Large', priceMultiplier: 1.3 },
];

function mapCategory(c: string): Pizza['category'] {
  if (c === 'specialty') return 'gourmet';
  if (c === 'vegan') return 'veg';
  if (c === 'classic') return 'classic';
  if (c === 'non-veg') return 'non-veg';
  if (c === 'veg') return 'veg';
  return 'custom';
}

function mapPizza(p: any): Pizza {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    image: p.imageUrl || '',
    category: mapCategory(p.category),
    basePrice: p.basePrice,
    isAvailable: p.available !== false,
    isPopular: false,
    sizes: defaultSizes,
    defaultToppingIds: [],
    ingredients: [],
  };
}

function mapOption(o: any) {
  return {
    id: o.id,
    name: o.name,
    price: o.price,
    isAvailable: o.available !== false,
    description: '',
  };
}

export const pizzaService = {
  async getPizzas(params: MenuQueryParams = {}): Promise<PaginatedResponse<Pizza>> {
    if (config.useMock) return mockGetPizzas(params);
    const qp: any = {};
    if (params.search) qp.search = params.search;
    if (params.category && params.category !== 'all') {
      const catMap: Record<string, string> = { veg: 'veg', 'non-veg': 'non-veg', gourmet: 'specialty', custom: 'specialty', classic: 'veg' };
      qp.category = catMap[params.category] || params.category;
    }
    if (params.isAvailable !== undefined) qp.available = params.isAvailable ? 'true' : 'false';
    if (params.sortBy) {
      const sortMap: Record<string, string> = { 'price-asc': 'price_asc', 'price-desc': 'price_desc', name: 'name', popular: 'name' };
      qp.sort = sortMap[params.sortBy] || 'name';
    } else {
      qp.sort = 'name';
    }
    qp.page = params.page || 1;
    qp.limit = params.limit || 12;
    const res = await apiClient.get<{ success: boolean; data: any[]; pagination: any }>('/pizzas', { params: qp });
    const data = (res.data || []).map(mapPizza);
    return {
      data,
      total: res.pagination?.total ?? data.length,
      page: res.pagination?.page ?? 1,
      limit: res.pagination?.limit ?? params.limit ?? 12,
      totalPages: res.pagination?.totalPages ?? 1,
    };
  },

  async getPizza(id: string): Promise<Pizza> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const pizza = mockPizzas.find((p) => p.id === id);
      if (!pizza) throw new Error('Pizza not found');
      return pizza;
    }
    const res = await apiClient.get<{ success: boolean; data: any }>(`/pizzas/${id}`);
    return mapPizza(res.data);
  },

  async getFeaturedPizzas(): Promise<Pizza[]> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return mockPizzas.filter((p) => p.isPopular).slice(0, 4);
    }
    const res = await apiClient.get<{ success: boolean; data: any[]; pagination: any }>('/pizzas', { params: { limit: 4 } });
    return (res.data || []).map(mapPizza);
  },

  async getCustomizationOptions(): Promise<CustomizationOptions> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return mockCustomizationOptions;
    }
    const res = await apiClient.get<{ success: boolean; data: any[] }>('/pizza-options');
    const opts = res.data || [];
    const bases: PizzaBase[] = opts.filter((o) => o.type === 'base').map((o) => ({ ...mapOption(o), isVegetarian: false })) as any;
    const sauces: PizzaSauce[] = opts.filter((o) => o.type === 'sauce').map(mapOption) as any;
    const cheeses: PizzaCheese[] = opts.filter((o) => o.type === 'cheese').map(mapOption) as any;
    const toppings: PizzaTopping[] = opts.filter((o) => o.type === 'topping').map((o) => ({ ...mapOption(o), isVegetarian: true })) as any;
    return {
      bases,
      sauces,
      cheeses,
      toppings,
      sizes: defaultSizes,
    };
  },
};
