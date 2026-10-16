import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Truck,
  Leaf,
  Flame,
  ArrowRight,
  Pizza,
  ChefHat,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState, ErrorState, PageSkeleton } from '@/components/feedback/states';
import { pizzaService } from '@/services/pizza.service';
import { formatCurrency } from '@/lib/format';

const heroImage = 'https://images.pexels.com/photos/31450854/pexels-photo-31450854.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const heroImage2 = 'https://images.pexels.com/photos/19957349/pexels-photo-19957349.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const ctaImage = 'https://images.pexels.com/photos/35760011/pexels-photo-35760011.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

export function HomePage() {
  const { data: featured, isLoading, isError, refetch } = useQuery({
    queryKey: ['featured-pizzas'],
    queryFn: () => pizzaService.getFeaturedPizzas(),
  });

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 ambient-gradient">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-6 animate-fade-in-up">
            <Badge variant="secondary" className="w-fit gap-1.5 px-3 py-1.5 text-xs font-medium border-border">
              <Flame className="h-3.5 w-3.5 text-primary" /> Fresh from the oven, every time
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              Your perfect pizza, <span className="text-primary">built your way</span>
            </h1>
            <p className="max-w-md text-base text-muted-foreground sm:text-lg">
              Choose from our artisan bases, house-made sauces, and farm-fresh
              toppings. Crafted fresh, delivered hot to your door.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild className="shadow-lg shadow-primary/20">
                <Link to="/menu">
                  Order Now <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/menu">Explore Menu</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 pt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> 30-min delivery
              </span>
              <span className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-success" /> Fresh ingredients
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary" /> Free over Rs. 500
              </span>
            </div>
          </div>

          <div className="relative order-first lg:order-last">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 shadow-2xl">
              <img
                src={heroImage}
                alt="Fresh pizza"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
            <div className="absolute -bottom-5 -left-5 hidden overflow-hidden rounded-xl border-4 border-background shadow-xl sm:block">
              <img
                src={heroImage2}
                alt="Pizza closeup"
                className="h-32 w-32 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured pizzas */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Popular Pizzas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customer favorites, ready to customize
            </p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:flex">
            <Link to="/menu">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading && <PageSkeleton count={4} />}
        {isError && <ErrorState onRetry={refetch} />}
        {featured && featured.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((pizza, idx) => (
              <Link
                key={pizza.id}
                to={`/pizza/${pizza.id}`}
                className="group block animate-fade-in-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <Card className="overflow-hidden card-glow-hover transition-all duration-300 hover:-translate-y-1">
                  <div className="relative aspect-square overflow-hidden bg-secondary">
                    <img
                      src={pizza.image}
                      alt={pizza.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
                    {!pizza.isAvailable && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <Badge variant="secondary">Unavailable</Badge>
                      </div>
                    )}
                    {pizza.isPopular && pizza.isAvailable && (
                      <Badge className="absolute left-2 top-2 gap-1 shadow-lg shadow-primary/20">
                        <Star className="h-3 w-3 fill-current" /> Popular
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-display text-base font-semibold leading-tight">
                      {pizza.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {pizza.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">from </span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(pizza.basePrice)}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {featured && featured.length === 0 && !isLoading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No featured pizzas available right now.
          </p>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-border/50 bg-secondary/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            How It Works
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { icon: Pizza, title: 'Pick Your Pizza', desc: 'Browse our menu or build your own from scratch' },
              { icon: ChefHat, title: 'Customize', desc: 'Choose your base, sauce, cheese, and toppings' },
              { icon: ShoppingBag, title: 'Checkout', desc: 'Pay securely and track your order in real time' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-lg">
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="mt-2 text-sm font-semibold text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom pizza CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <img
            src={ctaImage}
            alt="Chef preparing pizza"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/40" />
          <div className="relative z-10 max-w-lg p-8 sm:p-12 lg:p-14">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <ChefHat className="h-3.5 w-3.5 text-primary" /> Custom Builder
            </Badge>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Build Your Own Pizza
            </h2>
            <p className="mt-2 text-muted-foreground">
              Pick your base, sauce, cheese, and toppings — craft the pizza that's
              exactly what you crave.
            </p>
            <Button size="lg" className="mt-5 shadow-lg shadow-primary/20" asChild>
              <Link to="/menu">
                Start Building <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
