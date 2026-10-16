import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Star, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState, ErrorState, EmptyState, PageSkeleton } from '@/components/feedback/states';
import { pizzaService } from '@/services/pizza.service';
import { formatCurrency } from '@/lib/format';
import type { PizzaCategory } from '@/types';

const categories: { value: PizzaCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'classic', label: 'Classic' },
  { value: 'veg', label: 'Veg' },
  { value: 'non-veg', label: 'Non-Veg' },
  { value: 'gourmet', label: 'Gourmet' },
];

export function MenuPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PizzaCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'name'>('popular');
  const [availableOnly, setAvailableOnly] = useState(false);

  const params = useMemo(
    () => ({
      search: search || undefined,
      category,
      isAvailable: availableOnly ? true : undefined,
      sortBy,
      page: 1,
      limit: 50,
    }),
    [search, category, sortBy, availableOnly]
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pizzas', params],
    queryFn: () => pizzaService.getPizzas(params),
    placeholderData: (prev) => prev,
  });

  const hasActiveFilters = search !== '' || category !== 'all' || availableOnly;

  return (
    <div className="ambient-gradient">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Our Menu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse our selection of freshly made pizzas
          </p>
        </div>

        {/* Search + sort */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pizzas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="name">Name: A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category filter chips + available toggle */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={category === cat.value ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            variant={availableOnly ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => setAvailableOnly(!availableOnly)}
          >
            Available Only
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => { setSearch(''); setCategory('all'); setAvailableOnly(false); }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading && <PageSkeleton count={8} />}
        {isError && <ErrorState onRetry={refetch} message="Failed to load pizzas" />}

        {data && data.data.length === 0 && !isLoading && (
          <EmptyState
            title="No pizzas found"
            description="Try adjusting your search or filters."
            action={
              <Button
                variant="outline"
                onClick={() => { setSearch(''); setCategory('all'); setAvailableOnly(false); }}
              >
                Clear filters
              </Button>
            }
          />
        )}

        {data && data.data.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.data.map((pizza, idx) => (
              <Link
                key={pizza.id}
                to={`/pizza/${pizza.id}`}
                className="group block animate-fade-in-up"
                style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
              >
                <Card className="overflow-hidden card-glow-hover transition-all duration-300 hover:-translate-y-1">
                  <div className="relative aspect-square overflow-hidden bg-secondary">
                    <img
                      src={pizza.image}
                      alt={pizza.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent" />
                    {!pizza.isAvailable && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <Badge variant="secondary">Currently Unavailable</Badge>
                      </div>
                    )}
                    {pizza.isPopular && pizza.isAvailable && (
                      <Badge className="absolute left-2.5 top-2.5 gap-1 shadow-lg shadow-primary/20">
                        <Star className="h-3 w-3 fill-current" /> Popular
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] capitalize">{pizza.category}</Badge>
                      {pizza.rating && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-warning text-warning" /> {pizza.rating}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-semibold leading-tight">{pizza.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pizza.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">from </span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(pizza.basePrice)}</span>
                      </div>
                      <Button size="sm" disabled={!pizza.isAvailable} className="opacity-90 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-4 w-4" /> Customize
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
