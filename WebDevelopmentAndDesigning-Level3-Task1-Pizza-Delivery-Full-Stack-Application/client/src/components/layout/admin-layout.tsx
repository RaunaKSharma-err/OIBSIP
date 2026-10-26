import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  Pizza,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

function SidebarContent() {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {adminNav.map((item) => {
        const isActive =
          location.pathname === item.to ||
          (item.to !== '/admin/dashboard' && location.pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PageTitle() {
  const location = useLocation();
  const current = adminNav.find((nav) =>
    location.pathname === nav.to ||
    (nav.to !== '/admin/dashboard' && location.pathname.startsWith(nav.to))
  );
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
        Admin
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">
        {current?.label || 'Page'}
      </span>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/50 bg-card lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
            <Pizza className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="font-display text-base font-bold">
            Pizza<span className="text-primary">Hub</span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">Admin</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarContent />
        </div>
        <div className="border-t border-border/50 p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-6">
            <span className="font-display text-base font-bold">
              Pizza<span className="text-primary">Hub</span> Admin
            </span>
            <SheetClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
          <div className="flex-1 p-4">
            <SidebarContent />
          </div>
          <div className="border-t border-border/50 p-4">
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <PageTitle />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20 text-sm font-semibold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
