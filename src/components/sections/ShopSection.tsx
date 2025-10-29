import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Filter,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
} from 'lucide-react';
import type { Profile, ShopFrontItem, ShopFrontVariant } from '../../types';
import { createShopCheckoutSession, fetchPublicShopCatalog } from '../../lib/shopfront';
import { getStripeClient, isStripeEnabled } from '../../lib/stripeClient';

interface ShopSectionProps {
  profile: Profile | null;
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'availability';
type CategoryId =
  | 'all'
  | 'decks'
  | 'wheels'
  | 'trucks'
  | 'bearings'
  | 'clothing'
  | 'shoes'
  | 'accessories';

interface CategoryDefinition {
  id: CategoryId;
  label: string;
  icon: string;
}

const CATEGORY_CONFIG: CategoryDefinition[] = [
  { id: 'all', label: 'Tous les produits', icon: '🛹' },
  { id: 'decks', label: 'Planches', icon: '🛹' },
  { id: 'wheels', label: 'Roues', icon: '⚙️' },
  { id: 'trucks', label: 'Trucks', icon: '🔩' },
  { id: 'bearings', label: 'Roulements', icon: '⚡' },
  { id: 'clothing', label: 'Vêtements', icon: '👕' },
  { id: 'shoes', label: 'Chaussures', icon: '👟' },
  { id: 'accessories', label: 'Accessoires', icon: '🎒' },
];

const CATEGORY_KEYWORDS: Record<Exclude<CategoryId, 'all'>, string[]> = {
  decks: ['deck', 'planche', 'complete', 'board'],
  wheels: ['roue', 'wheel'],
  trucks: ['truck'],
  bearings: ['roulement', 'bearing'],
  clothing: ['hoodie', 't-shirt', 'tee', 'sweat', 'veste', 'tshirt', 'shirt'],
  shoes: ['chaussure', 'shoe', 'sneaker'],
  accessories: ['sac', 'backpack', 'tool', 'accessoire', 'bag', 'protections', 'sticker'],
};

type EnrichedShopFrontItem = ShopFrontItem & {
  categoryId: Exclude<CategoryId, 'all'>;
  rating: number;
  reviewsCount: number;
  compareAtPriceCents: number | null;
  badge: string | null;
  tagline: string | null;
};

interface ShopMetadata {
  rating?: number;
  reviewsCount?: number;
  compareAtPriceCents?: number;
  badge?: string;
  tagline?: string;
  categoryId?: string;
  category?: string;
}

function resolveCategory(item: ShopFrontItem, metadata: ShopMetadata): Exclude<CategoryId, 'all'> {
  const metaCandidate = [metadata.categoryId, metadata.category]
    .map((entry) => (typeof entry === 'string' ? entry.toLowerCase() : null))
    .find((entry): entry is string => Boolean(entry));

  const haystack = `${metaCandidate ?? ''} ${item.name} ${item.description ?? ''}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'accessories' && metaCandidate && metaCandidate.includes('accessoire')) {
      return 'accessories';
    }
    if (metaCandidate && metaCandidate.includes(category)) {
      return category as Exclude<CategoryId, 'all'>;
    }
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category as Exclude<CategoryId, 'all'>;
    }
  }

  return 'accessories';
}

function deriveBadge(categoryId: Exclude<CategoryId, 'all'>, metadata: ShopMetadata): string | null {
  if (typeof metadata.badge === 'string' && metadata.badge.trim().length > 0) {
    return metadata.badge;
  }

  switch (categoryId) {
    case 'decks':
      return 'Bestseller';
    case 'wheels':
      return 'Top Rated';
    case 'bearings':
      return 'Pro Pick';
    case 'clothing':
      return 'Style';
    case 'shoes':
      return 'Confort';
    default:
      return null;
  }
}

function enrichCatalog(catalog: ShopFrontItem[]): EnrichedShopFrontItem[] {
  return catalog.map((item) => {
    const metadata = (item.metadata ?? {}) as ShopMetadata;
    const categoryId = resolveCategory(item, metadata);

    const ratingSeed =
      typeof metadata.rating === 'number' ? metadata.rating : 4.3 + ((item.priceCents % 40) / 100);
    const rating = Math.round(Math.min(4.9, Math.max(4.1, ratingSeed)) * 10) / 10;
    const reviewsCount =
      typeof metadata.reviewsCount === 'number'
        ? metadata.reviewsCount
        : Math.max(48, (item.stock ?? 12) * 6);
    const compareAtPriceCents =
      typeof metadata.compareAtPriceCents === 'number' ? metadata.compareAtPriceCents : null;
    const badge = deriveBadge(categoryId, metadata);
    const tagline = typeof metadata.tagline === 'string' ? metadata.tagline : null;

    return {
      ...item,
      categoryId,
      rating,
      reviewsCount,
      compareAtPriceCents,
      badge,
      tagline,
    } satisfies EnrichedShopFrontItem;
  });
}

function formatCurrency(value: number, currency: string) {
  return (value / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function pickInitialVariant(item: ShopFrontItem): string | null {
  if (item.variants.length === 0) {
    return null;
  }
  const available = item.variants.find((variant) => (variant.stock ?? 0) > 0);
  return available?.id ?? item.variants[0]?.id ?? null;
}

function computeVariantPrice(item: ShopFrontItem, variantId: string | null): number {
  if (!variantId) {
    return item.priceCents;
  }
  const variant = item.variants.find((entry) => entry.id === variantId);
  return variant?.priceCents ?? item.priceCents;
}

function getAvailabilityMessage(item: ShopFrontItem) {
  const now = new Date();
  const from = item.availableFrom ? new Date(item.availableFrom) : null;
  const until = item.availableUntil ? new Date(item.availableUntil) : null;
  if (from && from > now) {
    return `Disponible à partir du ${from.toLocaleDateString('fr-FR')}`;
  }
  if (until && until < now) {
    return `Offre terminée le ${until.toLocaleDateString('fr-FR')}`;
  }
  if (until) {
    return `Disponible jusqu'au ${until.toLocaleDateString('fr-FR')}`;
  }
  return 'Disponible immédiatement';
}

export default function ShopSection({ profile }: ShopSectionProps) {
  const [catalog, setCatalog] = useState<ShopFrontItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [variantSelections, setVariantSelections] = useState<Record<string, string | null>>({});
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    fetchPublicShopCatalog()
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setCatalog(items);
      })
      .catch((cause) => {
        console.error('Unable to load shop catalog', cause);
        if (!isMounted) {
          return;
        }
        setError("Impossible de charger la boutique. Réessaie dans un instant.");
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setVariantSelections((current) => {
      const next: Record<string, string | null> = {};
      catalog.forEach((item) => {
        const existing = current[item.id];
        const stillValid = existing ? item.variants.some((variant) => variant.id === existing) : false;
        next[item.id] = stillValid ? existing : pickInitialVariant(item);
      });
      return next;
    });
  }, [catalog]);

  useEffect(() => {
    if (!isStripeEnabled()) {
      setStripeReady(false);
      setStripeMessage(
        "Stripe n'est pas configuré dans cet environnement. Les paiements seront simulés via un lien direct.",
      );
      return;
    }
    getStripeClient()
      .then((client) => {
        const ready = Boolean(client);
        setStripeReady(ready);
        if (!ready) {
          setStripeMessage(
            "Impossible de charger Stripe.js. Vérifie ta connexion réseau ou les restrictions de contenu.",
          );
        }
      })
      .catch((cause) => {
        console.error('Unable to bootstrap Stripe client', cause);
        setStripeReady(false);
        setStripeMessage(
          "Impossible de charger Stripe.js. Vérifie ta connexion réseau ou les restrictions de contenu.",
        );
      });
  }, []);

  const enrichedCatalog = useMemo<EnrichedShopFrontItem[]>(() => enrichCatalog(catalog), [catalog]);

  const brands = useMemo(() => {
    const entries = enrichedCatalog.reduce<Record<string, { id: string; label: string }>>((acc, item) => {
      const label = item.sponsor.brandName ?? item.sponsor.displayName ?? 'Marque partenaire';
      if (!acc[item.sponsorId]) {
        acc[item.sponsorId] = { id: item.sponsorId, label };
      }
      return acc;
    }, {});
    return Object.values(entries).sort((a, b) => a.label.localeCompare(b.label));
  }, [enrichedCatalog]);

  const categoryStats = useMemo(() => {
    const counts = enrichedCatalog.reduce<Record<CategoryId, number>>((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] ?? 0) + 1;
      return acc;
    }, {} as Record<CategoryId, number>);

    return CATEGORY_CONFIG.map((category) => ({
      ...category,
      count: category.id === 'all' ? enrichedCatalog.length : counts[category.id] ?? 0,
    }));
  }, [enrichedCatalog]);

  const filteredCatalog = useMemo<EnrichedShopFrontItem[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return enrichedCatalog.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      if (brandFilter !== 'all' && item.sponsorId !== brandFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        item.name,
        item.description ?? '',
        item.tagline ?? '',
        item.sponsor.brandName ?? '',
        item.sponsor.displayName ?? '',
        item.variants.map((variant) => variant.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [brandFilter, enrichedCatalog, searchQuery, selectedCategory]);

  const sortedCatalog = useMemo<EnrichedShopFrontItem[]>(() => {
    const items = [...filteredCatalog];
    switch (sortOption) {
      case 'price-asc':
        return items.sort((a, b) => a.priceCents - b.priceCents);
      case 'price-desc':
        return items.sort((a, b) => b.priceCents - a.priceCents);
      case 'availability':
        return items.sort((a, b) => {
          const aStock = a.stock ?? a.variants.reduce((total, variant) => total + (variant.stock ?? 0), 0);
          const bStock = b.stock ?? b.variants.reduce((total, variant) => total + (variant.stock ?? 0), 0);
          return (bStock ?? 0) - (aStock ?? 0);
        });
      default:
        return items;
    }
  }, [filteredCatalog, sortOption]);

  const currentSelection = (item: ShopFrontItem): ShopFrontVariant | null => {
    const variantId = variantSelections[item.id] ?? null;
    if (!variantId) {
      return null;
    }
    return item.variants.find((variant) => variant.id === variantId) ?? null;
  };

  const handleCheckout = async (item: ShopFrontItem) => {
    const variantId = variantSelections[item.id] ?? null;
    const stock = variantId
      ? item.variants.find((variant) => variant.id === variantId)?.stock
      : item.stock;
    if (stock != null && stock <= 0) {
      setCheckoutError('Stock insuffisant pour ce produit.');
      return;
    }

    setPendingCheckoutId(item.id);
    setCheckoutError(null);

    try {
      const payload = {
        itemId: item.id,
        variantId,
        quantity: 1,
        customerEmail: profile?.sponsor_contact?.email ?? profile?.payout_email ?? null,
        successUrl: typeof window !== 'undefined' ? `${window.location.origin}/shop?checkout=success` : undefined,
        cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/shop?checkout=cancel` : undefined,
      };
      const { sessionId, url, mode } = await createShopCheckoutSession(payload);
      if (mode === 'stripe' && stripeReady) {
        const stripe = await getStripeClient();
        if (stripe) {
          const result = await stripe.redirectToCheckout({ sessionId });
          if (result && 'error' in result && result.error) {
            throw new Error(result.error.message ?? 'Stripe a refusé la redirection.');
          }
          return;
        }
      }
      if (url) {
        window.location.href = url;
        return;
      }
      const fallbackError =
        mode === 'external'
          ? "Lien produit Amazon introuvable pour ce modèle."
          : 'Redirection Stripe indisponible.';
      setCheckoutError(fallbackError);
    } catch (cause) {
      console.error('Unable to start checkout', cause);
      setCheckoutError("Impossible de lancer le paiement. Réessaie dans un instant.");
    } finally {
      setPendingCheckoutId(null);
    }
  };

  const handleVariantChange = (itemId: string, variantId: string | null) => {
    setVariantSelections((current) => ({ ...current, [itemId]: variantId }));
    setCheckoutError(null);
  };

  const renderVariantSelector = (item: ShopFrontItem) => {
    if (item.variants.length === 0) {
      return null;
    }
    const activeVariantId = variantSelections[item.id] ?? null;
    return (
      <select
        value={activeVariantId ?? ''}
        onChange={(event) => handleVariantChange(item.id, event.target.value || null)}
        className="w-full rounded-lg border border-purple-500/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400/40"
      >
        {item.variants.map((variant) => {
          const disabled = (variant.stock ?? 0) <= 0;
          return (
            <option key={variant.id} value={variant.id} disabled={disabled}>
              {variant.name}
              {variant.priceCents != null && variant.priceCents !== item.priceCents
                ? ` • ${formatCurrency(variant.priceCents, item.currency)}`
                : ''}
              {disabled ? ' (épuisé)' : ''}
            </option>
          );
        })}
      </select>
    );
  };

  const totalStock = useMemo(() => {
    return enrichedCatalog.reduce((acc, item) => {
      const baseStock = item.stock ?? 0;
      const variantStock = item.variants.reduce((total, variant) => total + (variant.stock ?? 0), 0);
      return acc + Math.max(baseStock, variantStock);
    }, 0);
  }, [enrichedCatalog]);

  const premiumTaglines = useMemo(
    () => enrichedCatalog.filter((item) => item.tagline && item.tagline.toLowerCase().includes('prime')).length,
    [enrichedCatalog],
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-1 shadow-[0_20px_60px_-25px_rgba(124,58,237,0.45)]">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 space-y-8 rounded-[22px] border border-white/5 bg-slate-950/70 p-8 backdrop-blur">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-500/10">
              <Package className="h-6 w-6 text-purple-200" />
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">Boutique SkateConnect</h1>
              <p className="text-sm text-slate-300">
                Explore les drops officiels des marques partenaires avec une expérience digne d'Amazon, calibrée pour la scène
                skate.
              </p>
              <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/80 px-3 py-1">
                  <ShieldCheck size={14} /> Paiement sécurisé
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/80 px-3 py-1">
                  <ShoppingBag size={14} /> Sélection premium
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/80 px-3 py-1">
                  <ShoppingCart size={14} /> Checkout instantané
                </span>
              </div>
            </div>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3">
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-purple-200">Drops actifs</span>
                <TrendingUp className="h-4 w-4 text-purple-200" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{enrichedCatalog.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-slate-300">Marques</span>
                <Package className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{brands.length}</p>
            </div>
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-orange-200">Livraison express</span>
                <ShoppingCart className="h-4 w-4 text-orange-300" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{premiumTaglines}</p>
            </div>
          </div>
        </header>

        {stripeMessage && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <AlertCircle size={16} /> {stripeMessage}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-64">
            <div className="sticky top-24 space-y-4 rounded-2xl border border-purple-500/20 bg-slate-900/70 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <Filter className="h-5 w-5 text-purple-300" />
                <h2 className="text-lg font-semibold">Catégories</h2>
              </div>
              <nav className="space-y-2">
                {categoryStats.map((category) => {
                  const isActive = selectedCategory === category.id;
                  const disabled = category.count === 0;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category.id)}
                      disabled={disabled}
                      className={`w-full rounded-xl px-4 py-3 text-left text-sm transition-all ${
                        isActive
                          ? 'border border-purple-400/60 bg-purple-600/30 text-white shadow-lg shadow-purple-500/20'
                          : 'border border-slate-800/60 bg-slate-900/70 text-slate-300 hover:border-purple-400/40 hover:text-white'
                      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="mr-2 text-lg">{category.icon}</span>
                          {category.label}
                        </span>
                        <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-xs text-slate-400">
                          {category.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-2xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Rechercher un produit, une marque..."
                  className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/80 py-3 pl-12 pr-4 text-sm text-white shadow-inner shadow-black/30 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <select
                  value={brandFilter}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                >
                  <option value="all">Toutes les marques</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                >
                  <option value="featured">Trier par : Popularité</option>
                  <option value="price-asc">Prix : Croissant</option>
                  <option value="price-desc">Prix : Décroissant</option>
                  <option value="availability">Disponibilité</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
              <span>
                <span className="font-semibold text-white">{sortedCatalog.length}</span> produit(s) disponible(s)
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-purple-300" /> Stock global :{' '}
                <span className="font-semibold text-white">{totalStock}</span>
              </span>
              {checkoutError && (
                <span className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-100">
                  {checkoutError}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-16 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement de la boutique...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
            ) : sortedCatalog.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/60 px-4 py-10 text-center text-sm text-slate-300">
                Aucun produit ne correspond à la recherche.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {sortedCatalog.map((item) => {
                  const variant = currentSelection(item);
                  const effectivePriceCents = computeVariantPrice(item, variantSelections[item.id] ?? null);
                  const price = formatCurrency(effectivePriceCents, item.currency);
                  const compareAtPriceCents = item.compareAtPriceCents;
                  const hasSavings =
                    typeof compareAtPriceCents === 'number' && compareAtPriceCents > effectivePriceCents;
                  const oldPrice = hasSavings ? formatCurrency(compareAtPriceCents, item.currency) : null;
                  const savingsPercentage = hasSavings
                    ? Math.round(((compareAtPriceCents - effectivePriceCents) / compareAtPriceCents) * 100)
                    : null;
                  const stock = variant?.stock ?? item.stock;
                  const filledStars = Math.floor(item.rating);

                  return (
                    <div
                      key={item.id}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-purple-500/20 bg-slate-950/80 backdrop-blur transition-all duration-200 hover:border-purple-400/40 hover:shadow-2xl hover:shadow-purple-900/30"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-slate-900 text-slate-600">
                            <Store size={40} />
                          </div>
                        )}
                        <div className="absolute left-3 top-3 flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-purple-100 backdrop-blur">
                            <span className="h-2 w-2 rounded-full bg-purple-400" />
                            {item.sponsor.brandName ?? item.sponsor.displayName ?? 'Marque partenaire'}
                          </span>
                          {item.badge && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                              <Star className="h-3.5 w-3.5 fill-white text-white" /> {item.badge}
                            </span>
                          )}
                        </div>
                        {stock != null && stock <= 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <span className="text-sm font-semibold text-white">Rupture de stock</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-purple-200">
                            {item.name}
                          </h3>
                          {(item.tagline || item.description) && (
                            <p className="text-sm text-slate-300 line-clamp-2">
                              {item.tagline ?? item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                className={`h-4 w-4 ${
                                  index < filledStars ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span>
                            {item.rating.toFixed(1)} ({item.reviewsCount.toLocaleString('fr-FR')})
                          </span>
                        </div>
                        {renderVariantSelector(item)}
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span className="inline-flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-purple-200" />
                            {getAvailabilityMessage(item)}
                          </span>
                          {stock != null && (
                            <span className="rounded-full border border-purple-500/30 bg-slate-900/70 px-3 py-1 text-xs text-purple-100">
                              {stock} en stock
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-white">{price}</span>
                            {oldPrice && <span className="text-sm text-slate-500 line-through">{oldPrice}</span>}
                          </div>
                          {savingsPercentage != null && (
                            <p className="text-xs font-medium text-green-400">Économisez {savingsPercentage}%</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCheckout(item)}
                          disabled={pendingCheckoutId === item.id}
                          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-600/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-600/40 disabled:opacity-60"
                        >
                          {pendingCheckoutId === item.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Redirection...
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={16} />
                              Commander maintenant
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
