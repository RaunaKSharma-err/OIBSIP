import type { Pizza, CustomizationOptions } from '@/types';

/**
 * DEVELOPMENT MOCK DATA — explicitly labeled.
 * This data is only used when VITE_USE_MOCK=true.
 * It must never impersonate production data.
 */

export const mockPizzas: Pizza[] = [
  {
    id: 'pizza-001',
    name: 'Margherita Classic',
    description:
      'Fresh mozzarella, basil leaves, and our signature tomato sauce on a hand-tossed crust.',
    image: 'https://images.pexels.com/photos/315755/pizza-315755.jpeg',
    category: 'classic',
    basePrice: 199,
    isAvailable: true,
    isPopular: true,
    rating: 4.5,
    prepTimeMinutes: 20,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Mozzarella', 'Fresh Basil', 'Tomato Sauce', 'Olive Oil'],
  },
  {
    id: 'pizza-002',
    name: 'Pepperoni Supreme',
    description:
      'Double pepperoni, mozzarella, and a rich tomato base with a hint of oregano.',
    image: 'https://images.pexels.com/photos/803290/pexels-photo-803290.jpeg',
    category: 'non-veg',
    basePrice: 299,
    isAvailable: true,
    isPopular: true,
    rating: 4.7,
    prepTimeMinutes: 22,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Pepperoni', 'Mozzarella', 'Tomato Sauce', 'Oregano'],
  },
  {
    id: 'pizza-003',
    name: 'Veggie Garden Delight',
    description:
      'Bell peppers, onions, mushrooms, olives, and sweet corn on a classic crust.',
    image: 'https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg',
    category: 'veg',
    basePrice: 249,
    isAvailable: true,
    isPopular: true,
    rating: 4.3,
    prepTimeMinutes: 20,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: ['topping-pepper', 'topping-onion', 'topping-mushroom'],
    ingredients: ['Bell Peppers', 'Onions', 'Mushrooms', 'Olives', 'Sweet Corn'],
  },
  {
    id: 'pizza-004',
    name: 'BBQ Chicken Ranch',
    description:
      'Grilled chicken, BBQ sauce, red onions, and a drizzle of ranch dressing.',
    image: 'https://images.pexels.com/photos/3760895/pexels-photo-3760895.jpeg',
    category: 'non-veg',
    basePrice: 349,
    isAvailable: true,
    isPopular: false,
    rating: 4.6,
    prepTimeMinutes: 25,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Grilled Chicken', 'BBQ Sauce', 'Red Onion', 'Ranch'],
  },
  {
    id: 'pizza-005',
    name: 'Truffle Mushroom Gourmet',
    description:
      'Wild mushrooms, truffle oil, fontina cheese, and fresh thyme on a thin crust.',
    image: 'https://images.pexels.com/photos/598138/pexels-photo-598138.jpeg',
    category: 'gourmet',
    basePrice: 449,
    isAvailable: true,
    isPopular: false,
    rating: 4.8,
    prepTimeMinutes: 28,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: ['topping-mushroom'],
    ingredients: ['Wild Mushrooms', 'Truffle Oil', 'Fontina', 'Thyme'],
  },
  {
    id: 'pizza-006',
    name: 'Paneer Tikka Masala',
    description:
      'Spiced paneer, tikka sauce, capsicum, and red onion with a coriander finish.',
    image: 'https://images.pexels.com/photos/845811/pexels-photo-845811.jpeg',
    category: 'veg',
    basePrice: 279,
    isAvailable: true,
    isPopular: true,
    rating: 4.4,
    prepTimeMinutes: 22,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Paneer', 'Tikka Sauce', 'Capsicum', 'Red Onion', 'Coriander'],
  },
  {
    id: 'pizza-007',
    name: 'Four Cheese Deluxe',
    description:
      'Mozzarella, cheddar, parmesan, and gorgonzola on a white sauce base.',
    image: 'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg',
    category: 'classic',
    basePrice: 329,
    isAvailable: true,
    isPopular: false,
    rating: 4.5,
    prepTimeMinutes: 22,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Mozzarella', 'Cheddar', 'Parmesan', 'Gorgonzola', 'White Sauce'],
  },
  {
    id: 'pizza-008',
    name: 'Spicy Sausage Inferno',
    description:
      'Spicy Italian sausage, jalapeños, chili flakes, and hot sauce on a crispy crust.',
    image: 'https://images.pexels.com/photos/6605207/pexels-photo-6605207.jpeg',
    category: 'non-veg',
    basePrice: 319,
    isAvailable: false,
    isPopular: false,
    rating: 4.2,
    prepTimeMinutes: 25,
    sizes: [
      { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
      { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
      { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
    ],
    defaultToppingIds: [],
    ingredients: ['Italian Sausage', 'Jalapeños', 'Chili Flakes', 'Hot Sauce'],
  },
];

export const mockCustomizationOptions: CustomizationOptions = {
  bases: [
    { id: 'base-thin', name: 'Thin Crust', description: 'Crispy and light', price: 0, isAvailable: true },
    { id: 'base-classic', name: 'Classic Hand-Tossed', description: 'Our signature crust', price: 0, isAvailable: true },
    { id: 'base-pan', name: 'Pan Pizza', description: 'Thick and fluffy', price: 30, isAvailable: true },
    { id: 'base-stuffed', name: 'Cheese-Stuffed Crust', description: 'Mozzarella-filled edge', price: 60, isAvailable: true },
  ],
  sauces: [
    { id: 'sauce-tomato', name: 'Classic Tomato', description: 'Our signature sauce', price: 0, isAvailable: true },
    { id: 'sauce-bbq', name: 'BBQ Sauce', description: 'Smoky and sweet', price: 20, isAvailable: true },
    { id: 'sauce-white', name: 'White Sauce', description: 'Creamy béchamel', price: 25, isAvailable: true },
    { id: 'sauce-tikka', name: 'Tikka Masala', description: 'Spiced Indian-style', price: 25, isAvailable: true },
  ],
  cheeses: [
    { id: 'cheese-mozzarella', name: 'Mozzarella', description: 'Classic stretchy cheese', price: 0, isAvailable: true },
    { id: 'cheese-cheddar', name: 'Cheddar', description: 'Sharp and flavorful', price: 30, isAvailable: true },
    { id: 'cheese-vegan', name: 'Vegan Cheese', description: 'Plant-based alternative', price: 50, isAvailable: true },
    { id: 'cheese-extra', name: 'Extra Cheese', description: 'Double the mozzarella', price: 40, isAvailable: true },
  ],
  toppings: [
    { id: 'topping-pepper', name: 'Bell Peppers', description: 'Fresh and crunchy', price: 20, isAvailable: true, isVegetarian: true },
    { id: 'topping-onion', name: 'Red Onion', description: 'Sliced thin', price: 15, isAvailable: true, isVegetarian: true },
    { id: 'topping-mushroom', name: 'Mushrooms', description: 'Fresh button mushrooms', price: 25, isAvailable: true, isVegetarian: true },
    { id: 'topping-olive', name: 'Black Olives', description: 'Kalamata olives', price: 30, isAvailable: true, isVegetarian: true },
    { id: 'topping-corn', name: 'Sweet Corn', description: 'Crunchy kernels', price: 20, isAvailable: true, isVegetarian: true },
    { id: 'topping-jalapeno', name: 'Jalapeños', description: 'Spicy pickled', price: 25, isAvailable: true, isVegetarian: true },
    { id: 'topping-paneer', name: 'Paneer', description: 'Indian cottage cheese', price: 40, isAvailable: true, isVegetarian: true },
    { id: 'topping-chicken', name: 'Grilled Chicken', description: 'Marinated and grilled', price: 60, isAvailable: true, isVegetarian: false },
    { id: 'topping-bacon', name: 'Bacon Bits', description: 'Crispy bacon', price: 55, isAvailable: true, isVegetarian: false },
    { id: 'topping-pepperoni', name: 'Pepperoni', description: 'Classic slices', price: 50, isAvailable: true, isVegetarian: false },
  ],
  sizes: [
    { id: 'size-s', name: 'Small (8")', priceMultiplier: 1 },
    { id: 'size-m', name: 'Medium (10")', priceMultiplier: 1.3 },
    { id: 'size-l', name: 'Large (12")', priceMultiplier: 1.6 },
  ],
};
