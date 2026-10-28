import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import { mockPizzas, mockCustomizationOptions } from './mock-data';
import type {
  Pizza,
  CustomizationOptions,
  MenuQueryParams,
  PaginatedResponse,
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

export const pizzaService = {
  async getPizzas(params: MenuQueryParams = {}): Promise<PaginatedResponse<Pizza>> {
    if (config.useMock) return mockGetPizzas(params);
    return apiClient.get<PaginatedResponse<Pizza>>('/pizzas', { params });
  },

  async getPizza(id: string): Promise<Pizza> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      const pizza = mockPizzas.find((p) => p.id === id);
      if (!pizza) throw new Error('Pizza not found');
      return pizza;
    }
    return apiClient.get<Pizza>(`/pizzas/${id}`);
  },

  async getFeaturedPizzas(): Promise<Pizza[]> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return mockPizzas.filter((p) => p.isPopular).slice(0, 4);
    }
    const res = await apiClient.get<PaginatedResponse<Pizza>>('/pizzas', { params: { limit: 4 } });
    return res.data;  },

  async getCustomizationOptions(): Promise<CustomizationOptions> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return mockCustomizationOptions;
    }
    return apiClient.get<CustomizationOptions>('/pizzas/customizations');
  },
};
