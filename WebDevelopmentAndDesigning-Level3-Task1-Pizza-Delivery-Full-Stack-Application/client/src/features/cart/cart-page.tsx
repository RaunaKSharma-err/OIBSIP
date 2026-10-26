import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/states';
import { useCartStore } from '@/lib/cart-store';
import { formatCurrency } from '@/lib/format';

const DELIVERY_CHARGE = 40;
const FREE_DELIVERY_THRESHOLD = 500;

export function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore();

  const subtotal = getSubtotal();
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_CHARGE;
  const total = subtotal + deliveryCharge;
  const remainingForFree = FREE_DELIVERY_THRESHOLD - subtotal;

  if (items.length === 0) {
    return (
      <div className="ambient-gradient">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Your cart is empty"
            description="Browse our menu and add some delicious pizzas to your cart."
            action={
              <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                <Link to="/menu">Browse Menu</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-gradient">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your Cart</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-3 lg:col-span-2">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden animate-fade-in-up">
                <CardContent className="flex gap-4 p-4">
                  <img
                    src={item.pizzaImage}
                    alt={item.pizzaName}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display font-semibold">{item.pizzaName}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                          {item.sizeName && <span>{item.sizeName}</span>}
                          {item.baseName && <span>· {item.baseName}</span>}
                          {item.sauceName && <span>· {item.sauceName}</span>}
                          {item.cheeseName && <span>· {item.cheeseName}</span>}
                        </div>
                        {item.toppings.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Toppings: {item.toppings.map((t) => t.name).join(', ')}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-border">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" asChild className="mt-2">
              <Link to="/menu"><ShoppingBag className="mr-2 h-4 w-4" /> Continue Shopping</Link>
            </Button>
          </div>

          {/* Summary */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">
                    {deliveryCharge === 0 ? <Badge variant="success">FREE</Badge> : formatCurrency(deliveryCharge)}
                  </span>
                </div>
                {remainingForFree > 0 && (
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      Add <span className="font-semibold text-foreground">{formatCurrency(remainingForFree)}</span> more for free delivery
                    </p>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
                <Button className="w-full" size="lg" onClick={() => navigate('/checkout')} disabled={false}>
                  Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
