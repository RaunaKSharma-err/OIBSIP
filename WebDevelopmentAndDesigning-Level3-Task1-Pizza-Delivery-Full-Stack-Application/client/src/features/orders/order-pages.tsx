import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, CheckCircle2, Clock, Truck, XCircle, MapPin, ArrowLeft, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoadingState, ErrorState, EmptyState } from '@/components/feedback/states';
import { orderService } from '@/services/order.service';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/format';
import type { OrderStatus, PaymentStatus } from '@/types';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_payment: { label: 'Pending Payment', variant: 'secondary' },
  received: { label: 'Received', variant: 'secondary' },
  kitchen: { label: 'In Kitchen', variant: 'default' },
  delivery: { label: 'Out for Delivery', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const paymentConfig: Record<PaymentStatus, { label: string; variant: 'secondary' | 'destructive' | 'default' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  refunded: { label: 'Refunded', variant: 'secondary' },
};

export function OrderHistoryPage() {
  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getOrders(),
  });

  return (
    <div className="ambient-gradient">
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your Orders</h1>

      {isLoading && <LoadingState message="Loading your orders..." />}
      {isError && <ErrorState onRetry={refetch} message="Failed to load orders" />}

      {orders && orders.length === 0 && !isLoading && (
        <EmptyState
          title="No orders yet"
          description="Your order history will appear here once you place an order."
          action={<Button asChild className="shadow-lg shadow-primary/20"><Link to="/menu">Order Now</Link></Button>}
        />
      )}

      {orders && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const sc = statusConfig[order.orderStatus];
            const pc = paymentConfig[order.paymentStatus];
            return (
              <Link key={order.id} to={`/orders/${order.id}`}>
                <Card className="card-glow-hover transition-all duration-300 hover:-translate-y-0.5 animate-fade-in">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary/40">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {order.items.length} item{order.items.length > 1 ? 's' : ''} · {order.items.map((i) => i.pizzaName).join(', ').slice(0, 40)}
                          {order.items.map((i) => i.pizzaName).join(', ').length > 40 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span className="text-lg font-bold text-primary">{formatCurrency(order.total)}</span>
                      <div className="flex gap-2">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                        <Badge variant={pc.variant}>{pc.label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}

export function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getOrder(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.orderStatus;
      return status === 'received' || status === 'kitchen' || status === 'delivery' ? 15000 : false;
    },
  });

  if (isLoading) return <LoadingState message="Loading order details..." />;
  if (isError) return <ErrorState onRetry={refetch} message="Failed to load order" />;
  if (!order) return <ErrorState message="Order not found" />;

  const trackingSteps = orderService.getOrderTrackingSteps(order);
  const sc = statusConfig[order.orderStatus];
  const pc = paymentConfig[order.paymentStatus];
  const isCancelled = order.orderStatus === 'cancelled';

  return (
    <div className="ambient-gradient">
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatRelativeTime(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={sc.variant}>{sc.label}</Badge>
          <Badge variant={pc.variant}>{pc.label}</Badge>
        </div>
      </div>

      {/* Tracking */}
      {!isCancelled && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Order Tracking</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {trackingSteps.map((step, idx) => {
                const icons: Record<string, React.ReactNode> = {
                  received: <Receipt className="h-5 w-5" />,
                  kitchen: <Clock className="h-5 w-5" />,
                  delivery: <Truck className="h-5 w-5" />,
                  delivered: <CheckCircle2 className="h-5 w-5" />,
                };
                return (
                  <div key={step.status} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-center">
                      {idx > 0 && <div className={`h-0.5 flex-1 ${step.isCompleted || step.isCurrent ? 'bg-primary' : 'bg-border'}`} />}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step.isCompleted ? 'border-primary bg-primary text-primary-foreground' : step.isCurrent ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'}`}>
                        {icons[step.status]}
                      </div>
                      {idx < trackingSteps.length - 1 && <div className={`h-0.5 flex-1 ${step.isCompleted ? 'bg-primary' : 'bg-border'}`} />}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${step.isCurrent || step.isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                      <p className="text-[10px] text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isCancelled && (
        <Card className="mb-6 border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4 text-destructive">
            <XCircle className="h-6 w-6" />
            <p className="font-medium">This order was cancelled.</p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Order Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {item.pizzaImage && <img src={item.pizzaImage} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-medium">{item.pizzaName}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                {item.customDetails && <p className="text-xs text-muted-foreground">{item.customDetails}</p>}
              </div>
              <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span>{order.deliveryCharge === 0 ? <span className="text-success">FREE</span> : formatCurrency(order.deliveryCharge)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-success">-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delivery info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Delivery Information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{order.delivery?.fullName}</p>
          <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 mt-0.5" /> {order.delivery?.addressLine1}, {order.delivery?.city}</p>
          <p className="text-muted-foreground">Phone: {order.delivery?.phone}</p>
          {order.delivery?.instructions && <p className="text-muted-foreground">Instructions: {order.delivery.instructions}</p>}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
