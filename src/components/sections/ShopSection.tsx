import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
} from 'lucide-react';
import type { Profile, ShopFrontItem, ShopFrontVariant } from '../../types';
import { createShopCheckoutSession, fetchPublicShopCatalog } from '../../lib/shopfront';
import { getStripeClient, isStripeEnabled } from '../../lib/stripeClient';

interface ShopSectionProps {
  profile: Profile | null;
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'availability';

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

  const brands = useMemo(() => {
    const entries = catalog.reduce<Record<string, { id: string; label: string }>>((acc, item) => {
      const label = item.sponsor.brandName ?? item.sponsor.displayName ?? 'Marque partenaire';
      if (!acc[item.sponsorId]) {
        acc[item.sponsorId] = { id: item.sponsorId, label };
      }
      return acc;
    }, {});
    return Object.values(entries).sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (brandFilter !== 'all' && item.sponsorId !== brandFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        item.name,
        item.description ?? '',
        item.sponsor.brandName ?? '',
        item.sponsor.displayName ?? '',
        item.variants.map((variant) => variant.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [brandFilter, catalog, searchQuery]);

  const sortedCatalog = useMemo(() => {
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
        className="w-full rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
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

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Marketplace SkateConnect</h1>
            <p className="mt-1 text-sm text-slate-300">
              Une sélection simple et efficace des drops officiels des shops et marques partenaires.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <ShieldCheck size={14} /> Paiement sécurisé
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <ShoppingBag size={14} /> Sélection premium
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <ShoppingCart size={14} /> Commande en un clic
            </span>
          </div>
        </div>
        {stripeMessage && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
            <AlertCircle size={14} /> {stripeMessage}
          </div>
        )}
      </header>

      <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher un produit, une marque..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-2 pl-11 pr-3 text-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-orange-400" />
              <select
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
                className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
              >
                <option value="all">Toutes les marques</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Trier</span>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
              >
                <option value="featured">En avant</option>
                <option value="price-asc">Prix: croissant</option>
                <option value="price-desc">Prix: décroissant</option>
                <option value="availability">Disponibilité</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
          <span>
            <span className="font-semibold text-white">{sortedCatalog.length}</span> produit(s) disponible(s)
          </span>
          {checkoutError && (
            <span className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-100">
              {checkoutError}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement de la boutique...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : sortedCatalog.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-300">
            Aucun produit ne correspond à la recherche.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sortedCatalog.map((item) => {
              const variant = currentSelection(item);
              const price = formatCurrency(computeVariantPrice(item, variantSelections[item.id] ?? null), item.currency);
              const stock = variant?.stock ?? item.stock;
              return (
                <div
                  key={item.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-purple-500/10 bg-slate-900/70 transition hover:border-purple-400/40 hover:shadow-xl hover:shadow-purple-500/10"
                >
                  <div className="relative aspect-video overflow-hidden bg-slate-950/60">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <Store size={40} />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-200">
                      {item.sponsor.brandName ?? item.sponsor.displayName ?? 'Marque partenaire'}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white line-clamp-2 group-hover:text-purple-200 transition">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-slate-300 line-clamp-3">{item.description}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {renderVariantSelector(item)}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <ShoppingBag size={14} />
                        <span>{getAvailabilityMessage(item)}</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Prix</p>
                        <p className="text-2xl font-semibold text-white">{price}</p>
                        <p className="text-xs text-slate-500">
                          {stock != null ? `${stock} article(s) restant(s)` : 'Stock disponible'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCheckout(item)}
                        disabled={pendingCheckoutId === item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-orange-500/70 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20 disabled:opacity-50"
                      >
                        {pendingCheckoutId === item.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redirection...
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={16} />
                            Acheter
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
