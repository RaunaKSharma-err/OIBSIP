import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, ShoppingCart, User, LogOut, Settings, Pizza, Flame, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useCartStore } from '@/lib/cart-store';
import { useAuthStore } from '@/lib/auth-store';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/menu', label: 'Menu' },
  { to: '/orders', label: 'My Orders' },
];

export function CustomerHeader() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.getTotalItems());
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
            <Pizza className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Pizza<span className="text-primary">Hub</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <Link
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-bold shadow-lg shadow-primary/30">
                {cartCount}
              </Badge>
            )}
          </Link>

          {/* Account */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile"><User className="mr-2 h-4 w-4" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders"><Settings className="mr-2 h-4 w-4" /> Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Sign Up</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col w-80">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold">
                  Pizza<span className="text-primary">Hub</span>
                </span>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>
              <nav className="mt-8 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                {isAuthenticated ? (
                  <>
                    <SheetClose asChild>
                      <Button variant="outline" asChild>
                        <Link to="/profile"><User className="mr-2 h-4 w-4" /> Profile</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="outline" asChild>
                        <Link to="/cart"><ShoppingCart className="mr-2 h-4 w-4" /> Cart ({cartCount})</Link>
                      </Button>
                    </SheetClose>
                    <Button variant="destructive" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Button variant="outline" asChild>
                        <Link to="/login">Login</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild>
                        <Link to="/register">Sign Up</Link>
                      </Button>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function CustomerFooter() {
  return (
    <footer className="border-t border-border/50 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
                <Pizza className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold">
                Pizza<span className="text-primary">Hub</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Fresh, customizable pizza delivered to your door.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> 30-min delivery</span>
              <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary" /> Free over Rs. 500</span>
              <span className="flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-primary" /> Fresh from the oven</span>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/menu" className="hover:text-foreground transition-colors">Menu</Link></li>
              <li><Link to="/cart" className="hover:text-foreground transition-colors">Cart</Link></li>
              <li><Link to="/orders" className="hover:text-foreground transition-colors">Orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-foreground transition-colors">Login</Link></li>
              <li><Link to="/register" className="hover:text-foreground transition-colors">Register</Link></li>
              <li><Link to="/profile" className="hover:text-foreground transition-colors">Profile</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>support@pizzahub.com</li>
              <li>+91 98765 43210</li>
              <li>Available 11 AM – 11 PM</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} PizzaHub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <CustomerHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <CustomerFooter />
    </div>
  );
}
