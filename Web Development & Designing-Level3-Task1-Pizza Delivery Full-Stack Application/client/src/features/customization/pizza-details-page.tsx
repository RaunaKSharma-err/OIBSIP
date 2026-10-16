import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingCart, ArrowLeft, Check, Clock, Star, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LoadingState, ErrorState } from '@/components/feedback/states';
import { pizzaService } from '@/services/pizza.service';
import { useCartStore } from '@/lib/cart-store';
import { formatCurrency } from '@/lib/format';
import type { CartItem, CartItemTopping } from '@/types';

export function PizzaDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const { data: pizza, isLoading, isError, refetch } = useQuery({
    queryKey: ['pizza', id],
    queryFn: () => pizzaService.getPizza(id!),
    enabled: !!id,
  });

  const { data: options } = useQuery({
    queryKey: ['customization-options'],
    queryFn: () => pizzaService.getCustomizationOptions(),
  });

  const [sizeId, setSizeId] = useState('');
  const [baseId, setBaseId] = useState('');
  const [sauceId, setSauceId] = useState('');
  const [cheeseId, setCheeseId] = useState('');
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (pizza && !sizeId) setSizeId(pizza.sizes[0]?.id || '');
  }, [pizza, sizeId]);

  useEffect(() => {
    if (options && !baseId) setBaseId(options.bases.find((b) => b.isAvailable)?.id || '');
    if (options && !sauceId) setSauceId(options.sauces.find((s) => s.isAvailable)?.id || '');
    if (options && !cheeseId) setCheeseId(options.cheeses.find((c) => c.isAvailable)?.id || '');
  }, [options, baseId, sauceId, cheeseId]);

  const unitPrice = useMemo(() => {
    if (!pizza || !options) return 0;
    const size = pizza.sizes.find((s) => s.id === sizeId);
    const multiplier = size?.priceMultiplier || 1;
    const base = options.bases.find((b) => b.id === baseId);
    const sauce = options.sauces.find((s) => s.id === sauceId);
    const cheese = options.cheeses.find((c) => c.id === cheeseId);
    const toppingsTotal = toppingIds.reduce((sum, tid) => {
      const t = options.toppings.find((tp) => tp.id === tid);
      return sum + (t?.price || 0);
    }, 0);
    return Math.round(
      pizza.basePrice * multiplier +
        (base?.price || 0) +
        (sauce?.price || 0) +
        (cheese?.price || 0) +
        toppingsTotal
    );
  }, [pizza, options, sizeId, baseId, sauceId, cheeseId, toppingIds]);

  const handleToppingToggle = (tid: string) => {
    setToppingIds((prev) =>
      prev.includes(tid) ? prev.filter((t) => t !== tid) : [...prev, tid]
    );
  };

  const handleAddToCart = () => {
    if (!pizza || !options) return;
    const size = pizza.sizes.find((s) => s.id === sizeId);
    const base = options.bases.find((b) => b.id === baseId);
    const sauce = options.sauces.find((s) => s.id === sauceId);
    const cheese = options.cheeses.find((c) => c.id === cheeseId);
    const selectedToppings: CartItemTopping[] = toppingIds
      .map((tid) => options.toppings.find((t) => t.id === tid))
      .filter(Boolean)
      .map((t) => ({ id: t!.id, name: t!.name, price: t!.price }));

    const cartItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pizzaId: pizza.id,
      pizzaName: pizza.name,
      pizzaImage: pizza.image,
      basePrice: pizza.basePrice,
      sizeName: size?.name,
      sizePriceMultiplier: size?.priceMultiplier || 1,
      baseName: base?.name,
      basePriceAddon: base?.price || 0,
      sauceName: sauce?.name,
      saucePriceAddon: sauce?.price || 0,
      cheeseName: cheese?.name,
      cheesePriceAddon: cheese?.price || 0,
      toppings: selectedToppings,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      isCustom: true,
    };

    addItem(cartItem);
    toast.success(`${pizza.name} added to cart`);
    navigate('/cart');
  };

  if (isLoading) return <LoadingState message="Loading pizza details..." />;
  if (isError) return <ErrorState onRetry={refetch} message="Failed to load pizza" />;
  if (!pizza || !options) return <ErrorState message="Pizza not found" />;

  return (
    <div className="ambient-gradient">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/menu" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to menu
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image & info */}
          <div className="animate-fade-in">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/50 shadow-2xl">
              <img src={pizza.image} alt={pizza.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card/40 to-transparent" />
              {pizza.isPopular && (
                <Badge className="absolute left-4 top-4 gap-1 shadow-lg shadow-primary/20">
                  <Star className="h-3 w-3 fill-current" /> Popular
                </Badge>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {pizza.prepTimeMinutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> {pizza.prepTimeMinutes} min
                </span>
              )}
              {pizza.rating && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-warning text-warning" /> {pizza.rating}
                </span>
              )}
              <Badge variant="outline" className="capitalize">{pizza.category}</Badge>
            </div>
          </div>

          {/* Customization */}
          <div className="flex flex-col gap-5 animate-fade-in-up">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">{pizza.name}</h1>
              <p className="mt-2 text-muted-foreground">{pizza.description}</p>
            </div>

            {!pizza.isAvailable && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-4 text-sm text-destructive flex items-center gap-2">
                  <Flame className="h-4 w-4" /> This pizza is currently unavailable.
                </CardContent>
              </Card>
            )}

            {/* Size */}
            <div>
              <Label className="mb-2.5 block text-sm font-semibold">Size</Label>
              <RadioGroup value={sizeId} onValueChange={setSizeId}>
                <div className="grid grid-cols-3 gap-2">
                  {pizza.sizes.map((size) => (
                    <Label
                      key={size.id}
                      htmlFor={size.id}
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all duration-200 hover:bg-accent ${sizeId === size.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'}`}
                    >
                      <RadioGroupItem value={size.id} id={size.id} className="sr-only" />
                      <span className="text-sm font-medium">{size.name.split(' (')[0]}</span>
                      <span className="text-xs text-muted-foreground">
                        {size.name.match(/\(([^)]+)\)/)?.[1] || ''}
                      </span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Base */}
            <div>
              <Label className="mb-2.5 block text-sm font-semibold">Pizza Base</Label>
              <RadioGroup value={baseId} onValueChange={setBaseId}>
                <div className="space-y-2">
                  {options.bases.map((base) => (
                    <Label
                      key={base.id}
                      htmlFor={base.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent ${baseId === base.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={base.id} id={base.id} />
                        <div>
                          <span className="text-sm font-medium">{base.name}</span>
                          {base.description && (
                            <p className="text-xs text-muted-foreground">{base.description}</p>
                          )}
                        </div>
                      </div>
                      {base.price > 0 && <span className="text-sm font-medium text-primary">+{formatCurrency(base.price)}</span>}
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Sauce */}
            <div>
              <Label className="mb-2.5 block text-sm font-semibold">Sauce</Label>
              <RadioGroup value={sauceId} onValueChange={setSauceId}>
                <div className="space-y-2">
                  {options.sauces.map((sauce) => (
                    <Label
                      key={sauce.id}
                      htmlFor={sauce.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent ${sauceId === sauce.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={sauce.id} id={sauce.id} />
                        <div>
                          <span className="text-sm font-medium">{sauce.name}</span>
                          {sauce.description && <p className="text-xs text-muted-foreground">{sauce.description}</p>}
                        </div>
                      </div>
                      {sauce.price > 0 && <span className="text-sm font-medium text-primary">+{formatCurrency(sauce.price)}</span>}
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Cheese */}
            <div>
              <Label className="mb-2.5 block text-sm font-semibold">Cheese</Label>
              <RadioGroup value={cheeseId} onValueChange={setCheeseId}>
                <div className="space-y-2">
                  {options.cheeses.map((cheese) => (
                    <Label
                      key={cheese.id}
                      htmlFor={cheese.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent ${cheeseId === cheese.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={cheese.id} id={cheese.id} />
                        <div>
                          <span className="text-sm font-medium">{cheese.name}</span>
                          {cheese.description && <p className="text-xs text-muted-foreground">{cheese.description}</p>}
                        </div>
                      </div>
                      {cheese.price > 0 && <span className="text-sm font-medium text-primary">+{formatCurrency(cheese.price)}</span>}
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Toppings */}
            <div>
              <Label className="mb-2.5 block text-sm font-semibold">Toppings (optional)</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.toppings.map((topping) => (
                  <Label
                    key={topping.id}
                    htmlFor={topping.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:bg-accent ${toppingIds.includes(topping.id) ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={topping.id}
                        checked={toppingIds.includes(topping.id)}
                        onCheckedChange={() => handleToppingToggle(topping.id)}
                      />
                      <div>
                        <span className="text-sm font-medium">{topping.name}</span>
                        {topping.isVegetarian && <Badge variant="success" className="ml-1.5 text-[9px]">Veg</Badge>}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-primary">+{formatCurrency(topping.price)}</span>
                  </Label>
                ))}
              </div>
            </div>

            {/* Summary & Add to Cart */}
            <Card className="glass-surface sticky bottom-4 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-border">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity((q) => Math.min(10, q + 1))}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total</span>
                      <p className="text-xl font-bold text-primary">{formatCurrency(unitPrice * quantity)}</p>
                    </div>
                  </div>
                  <Button size="lg" disabled={!pizza.isAvailable} onClick={handleAddToCart} className="shadow-lg shadow-primary/20">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
