import { Link } from 'react-router-dom';
import { Home, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background ambient-gradient px-4 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
        <span className="font-display text-3xl font-bold text-primary">404</span>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
      </div>
      <Button asChild className="shadow-lg shadow-primary/20">
        <Link to="/">
          <Home className="mr-2 h-4 w-4" /> Back to Home
        </Link>
      </Button>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background ambient-gradient px-4 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
        <ShieldAlert className="h-10 w-10 text-warning" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
      </div>
      <Button asChild className="shadow-lg shadow-primary/20">
        <Link to="/">
          <Home className="mr-2 h-4 w-4" /> Back to Home
        </Link>
      </Button>
    </div>
  );
}
