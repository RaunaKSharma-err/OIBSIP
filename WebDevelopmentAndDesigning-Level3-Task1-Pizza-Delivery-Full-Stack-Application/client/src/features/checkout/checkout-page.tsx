import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CreditCard, Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/states';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';
import { deliveryInfoSchema, type DeliveryInfoFormData } from '@/lib/validators';
import { orderService } from '@/services/order.service';
import { paymentService } from '@/services/payment.service';
import { config } from '@/lib/config';
import { formatCurrency } from '@/lib/format';
import type { DeliveryInfo, PaymentMethod } from '@/types';

const DELIVERY_CHARGE = 40;
const FREE_DELIVERY_THRESHOLD = 500;

type CheckoutStep = 'details' | 'processing' | 'success' | 'error';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, getSubtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [completedOrderId, setCompletedOrderId] = useState<string>('');

  const subtotal = getSubtotal();
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
  const total = subtotal + deliveryCharge;

  const { register, handleSubmit, formState: { errors } } = useForm<DeliveryInfoFormData>({
    resolver: zodResolver(deliveryInfoSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      address: '',
      city: '',
      instructions: '',
    },
  });

  const onSubmit = async (data: DeliveryInfoFormData) => {
    setStep('processing');
    try {
      const deliveryInfo: DeliveryInfo = {
        name: data.name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        instructions: data.instructions,
      };

      const order = await orderService.createOrder({
        items: items.map((item) => ({
          pizzaId: item.pizzaId,
          quantity: item.quantity,
          customConfig: {
            baseId: item.baseName || '',
            sauceId: item.sauceName || '',
            cheeseId: item.cheeseName || '',
            toppingIds: item.toppings.map((t) => t.id),
            sizeId: item.sizeName || '',
          },
        })),
        deliveryInfo,
        paymentMethod,
      });

      if (paymentMethod === 'razorpay') {
        const paymentRes = await paymentService.createPayment({
          orderId: order.id,
          amount: order.total,
        });

        let razorpayPaymentId = '';
        let razorpaySignature = '';

        if (config.useMock) {
          toast.info('Mock payment mode — simulating successful payment');
          razorpayPaymentId = `mock_pay_${Date.now()}`;
          razorpaySignature = 'mock_signature';
        } else {
          const result = await paymentService.openCheckout({
            razorpayOrderId: paymentRes.razorpayOrderId,
            amount: paymentRes.amount,
            keyId: paymentRes.keyId,
            customerName: deliveryInfo.name,
            customerEmail: user?.email || '',
            customerPhone: deliveryInfo.phone,
          });
          razorpayPaymentId = result.razorpayPaymentId;
          razorpaySignature = result.razorpaySignature;
        }

        await paymentService.verifyPayment({
          razorpayOrderId: paymentRes.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          orderId: order.id,
        });
      }

      setCompletedOrderId(order.id);
      clearCart();
      setStep('success');
      toast.success('Order placed successfully!');
    } catch (e) {
      setStep('error');
      const msg = e instanceof Error ? e.message : 'Checkout failed';
      toast.error(msg);
    }
  };

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="ambient-gradient">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          title="Your cart is empty"
          description="Add items to your cart before checking out."
          action={<Button onClick={() => navigate('/menu')} className="shadow-lg shadow-primary/20">Browse Menu</Button>}
        />
      </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="ambient-gradient">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-success/20 bg-success/5 shadow-lg">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="font-display text-2xl font-bold">Order Confirmed!</h1>
        <p className="text-sm text-muted-foreground">
          Your order has been placed and is being processed. You can track its progress anytime.
        </p>
        <div className="flex gap-3">
          <Button asChild className="shadow-lg shadow-primary/20"><a href={`/orders/${completedOrderId}`}>Track Order</a></Button>
          <Button variant="outline" onClick={() => navigate('/menu')}>Continue Shopping</Button>
        </div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="ambient-gradient">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 shadow-lg">
          <span className="text-3xl font-bold text-destructive">!</span>
        </div>
        <h1 className="font-display text-2xl font-bold">Payment Failed</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong during checkout. Your cart is still intact — please try again.
        </p>
        <Button onClick={() => setStep('details')} className="shadow-lg shadow-primary/20">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-gradient">
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/cart" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to cart
      </Link>
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">Checkout</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Delivery info */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Delivery Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="9876543210" {...register('phone')} />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Delivery Address</Label>
                  <Textarea id="address" placeholder="House number, street, area..." rows={2} {...register('address')} />
                  {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Mumbai" {...register('city')} />
                    {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="instructions">Delivery Instructions (optional)</Label>
                    <Input id="instructions" placeholder="e.g. Ring the bell" {...register('instructions')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Payment Method</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${paymentMethod === 'razorpay' ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <span className="block text-sm font-medium">Razorpay (Card / UPI / Net Banking)</span>
                      <span className="text-xs text-muted-foreground">Pay securely online</span>
                    </div>
                  </div>
                  {paymentMethod === 'razorpay' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center text-sm font-bold text-primary">₹</div>
                    <div className="text-left">
                      <span className="block text-sm font-medium">Cash on Delivery</span>
                      <span className="text-xs text-muted-foreground">Pay when your order arrives</span>
                    </div>
                  </div>
                  {paymentMethod === 'cod' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
                {config.useMock && paymentMethod === 'razorpay' && (
                  <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                    Development mode: Payment will be simulated. No real charge will occur.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div>
            <Card className="sticky top-20">
              <CardHeader><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 text-sm">
                    <img src={item.pizzaImage} alt="" className="h-12 w-12 rounded-md object-cover" />
                    <div className="flex-1">
                      <p className="font-medium leading-tight">{item.pizzaName}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} · {item.sizeName}</p>
                    </div>
                    <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">{deliveryCharge === 0 ? <span className="text-success">FREE</span> : formatCurrency(deliveryCharge)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
                </div>
                <Button type="submit" className="w-full shadow-lg shadow-primary/20" size="lg" disabled={step === 'processing'}>
                  {step === 'processing' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" /> Place Order · {formatCurrency(total)}</>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By placing your order, you agree to our terms.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
    </div>
  );
}
