import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Settings,
  TrendingUp,
  DollarSign,
  Clock,
  Truck,
  AlertTriangle,
  ArrowLeft,
  Search,
  Minus,
  Plus,
  ShoppingCart,
  MapPin,
  Phone as PhoneIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/feedback/states";
import { adminService } from "@/services/admin.service";
import { orderService } from "@/services/order.service";
import { inventoryService } from "@/services/inventory.service";
import {
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  getStockCondition,
} from "@/lib/format";
import type { OrderStatus, InventoryItem } from "@/types";

const PIE_COLORS = ["#FF453A", "#39D98A", "#FFB547", "#3b82f6", "#FF5B65"];

const statusLabels: Record<OrderStatus, string> = {
  received: "Received",
  kitchen: "In Kitchen",
  delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  pending_payment: "Pending Payment",
};
const statusBadgeVariant: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  received: "secondary",
  kitchen: "default",
  delivery: "default",
  delivered: "default",
  cancelled: "destructive",
  pending_payment: "secondary",
};

/* ============ DASHBOARD ============ */
export function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminService.getDashboardData(),
  });

  if (isLoading) return <LoadingState message="Loading dashboard..." />;
  if (isError)
    return <ErrorState onRetry={refetch} message="Failed to load dashboard" />;
  if (!data) return null;

  const { stats, orderStatusDistribution, recentOrders, lowStockItems } = data;
  const statCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(stats.revenue),
      icon: DollarSign,
      color: "text-success",
      bg: "bg-success/10 border-success/20",
    },
    {
      label: "Total Orders",
      value: stats.totalOrders.toString(),
      icon: ShoppingCart,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders.toString(),
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10 border-warning/20",
    },
    {
      label: "Out for Delivery",
      value: stats.outForDelivery.toString(),
      icon: Truck,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your restaurant performance
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="card-glow-hover transition-all duration-300 hover:-translate-y-0.5"
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl border ${stat.bg}`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order status chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={orderStatusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e) => e.status}
                >
                  {orderStatusDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
              <Badge variant="destructive">{stats.lowStockCount}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All items are well stocked.
              </p>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-destructive">
                      {item.quantity} {item.unit}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Min: {item.lowStockThreshold}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/admin/inventory">Manage Inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/orders">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        statusBadgeVariant[order.orderStatus as OrderStatus] ||
                        "secondary"
                      }
                    >
                      {statusLabels[order.orderStatus as OrderStatus] ||
                        order.orderStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ ORDERS LIST ============ */
export function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      page,
      limit: 10,
    }),
    [search, statusFilter, page],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => orderService.getAllOrdersAdmin(params),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Order Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and manage all customer orders
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as typeof statusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="kitchen">In Kitchen</SelectItem>
            <SelectItem value="delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <LoadingState message="Loading orders..." />}
      {isError && (
        <ErrorState onRetry={refetch} message="Failed to load orders" />
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No orders found"
          description="Try adjusting your search or filters."
        />
      )}

      {data && data.data.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.delivery?.fullName}</TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.paymentStatus === "paid"
                            ? "default"
                            : "secondary"
                        }
                        className="capitalize"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[order.orderStatus]}>
                        {statusLabels[order.orderStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/admin/orders/${order.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============ ORDER DETAILS ============ */
export function AdminOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => orderService.getOrderAdmin(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) =>
      orderService.updateOrderStatus({ orderId: id!, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading) return <LoadingState message="Loading order..." />;
  if (isError)
    return <ErrorState onRetry={refetch} message="Failed to load order" />;
  if (!order) return <ErrorState message="Order not found" />;

  const statuses: OrderStatus[] = [
    "received",
    "kitchen",
    "delivery",
    "delivered",
    "cancelled",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge
          variant={statusBadgeVariant[order.orderStatus]}
          className="text-sm"
        >
          {statusLabels[order.orderStatus]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items & totals */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  {item.pizzaImage && (
                    <img
                      src={item.pizzaImage}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                    {item.customDetails && (
                      <p className="text-xs text-muted-foreground">
                        {item.customDetails}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>
                  {order.deliveryCharge === 0
                    ? "FREE"
                    : formatCurrency(order.deliveryCharge)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status update */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <Button
                    key={status}
                    variant={
                      order.orderStatus === status ? "default" : "outline"
                    }
                    size="sm"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(status)}
                  >
                    {statusLabels[status]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer info */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">{order.delivery?.fullName}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <PhoneIcon className="h-3.5 w-3.5" /> {order.delivery?.phone}
                </p>
              </div>
              <Separator />
              <div>
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{" "}
                  {order.delivery?.addressLine1}, {order.delivery?.city}
                </p>
              </div>
              {order.delivery?.instructions && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Instructions
                    </p>
                    <p>{order.delivery?.instructions}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "Esewa"}
                </p>
                <Badge
                  variant={
                    order.paymentStatus === "paid" ? "default" : "secondary"
                  }
                  className="mt-1 capitalize"
                >
                  {order.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============ INVENTORY ============ */
export function AdminInventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      stockCondition: stockFilter as
        | "all"
        | "healthy"
        | "low"
        | "out"
        | undefined,
      page: 1,
      limit: 50,
    }),
    [search, categoryFilter, stockFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory", params],
    queryFn: () => inventoryService.getInventory(params),
    placeholderData: (prev) => prev,
  });

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.data.map((i) => i.category));
    return Array.from(cats).sort();
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Inventory Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor stock levels and adjust quantities
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <LoadingState message="Loading inventory..." />}
      {isError && (
        <ErrorState onRetry={refetch} message="Failed to load inventory" />
      )}

      {data && data.data.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((item) => {
                const condition = getStockCondition(
                  item.quantity,
                  item.lowStockThreshold,
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell>
                      {condition === "healthy" && (
                        <Badge className="bg-success/10 text-success">
                          Healthy
                        </Badge>
                      )}
                      {condition === "low" && (
                        <Badge className="bg-warning/10 text-warning">
                          Low Stock
                        </Badge>
                      )}
                      {condition === "out" && (
                        <Badge variant="destructive">Out of Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.lastUpdated)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAdjustItem(item)}
                      >
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && data.data.length === 0 && !isLoading && (
        <EmptyState
          title="No items found"
          description="Try adjusting your search or filters."
        />
      )}

      {adjustItem && (
        <AdjustStockDialog
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
        />
      )}
    </div>
  );
}

function AdjustStockDialog({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      inventoryService.adjustStock({
        itemId: item.id,
        adjustment,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Stock adjusted successfully");
      onClose();
    },
    onError: () => toast.error("Failed to adjust stock"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">
              Current Quantity
            </span>
            <span className="text-lg font-bold">
              {item.quantity} {item.unit}
            </span>
          </div>
          <div className="space-y-1.5">
            <Label>Adjustment Amount</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustment((a) => a - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                className="text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdjustment((a) => a + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use positive to add stock, negative to remove
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. New shipment received"
            />
          </div>
          {adjustment !== 0 && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">
                New Quantity
              </span>
              <span className="text-lg font-bold text-primary">
                {Math.max(0, item.quantity + adjustment)} {item.unit}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={adjustment === 0 || mutation.isPending}
          >
            {mutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              "Confirm Adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ SETTINGS ============ */
export function AdminSettingsPage() {
  const [restaurantName, setRestaurantName] = useState("PizzaHub");
  const [deliveryCharge, setDeliveryCharge] = useState("40");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("500");
  const [minOrderValue, setMinOrderValue] = useState("150");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Settings saved");
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your restaurant settings
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="restaurant-name">Restaurant Name</Label>
                <Input
                  id="restaurant-name"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value="INR (₹)"
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-charge">Delivery Charge (₹)</Label>
                <Input
                  id="delivery-charge"
                  type="number"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="free-threshold">
                  Free Delivery Threshold (₹)
                </Label>
                <Input
                  id="free-threshold"
                  type="number"
                  value={freeDeliveryThreshold}
                  onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-order">Minimum Order Value (₹)</Label>
                <Input
                  id="min-order"
                  type="number"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "New order alerts",
                "Low stock warnings",
                "Payment failure notifications",
                "Daily revenue summary",
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant="success">Enabled</Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Notification settings are managed via environment configuration.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
