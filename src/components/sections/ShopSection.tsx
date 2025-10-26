import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  Package2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import type { Profile, ShopFrontItem, ShopFrontVariant } from '../../types';
import { createShopCheckoutSession, fetchPublicShopCatalog } from '../../lib/shopfront';
import { getStripeClient, isStripeEnabled } from '../../lib/stripeClient';

interface ShopSectionProps {
  profile: Profile | null;
}

interface CheckoutState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

function formatCurrency(value: number, currency: string) {
  return (value / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function computeVariantPrice(item: ShopFrontItem, variantId: string | null): number {
  if (!variantId) {
    return item.priceCents;
  }
  const variant = item.variants.find((entry) => entry.id === variantId);
  return variant?.priceCents ?? item.priceCents;
}

function pickInitialVariant(item: ShopFrontItem): string | null {
  if (item.variants.length === 0) {
    return null;
  }
  const inStock = item.variants.find((variant) => (variant.stock ?? 0) > 0);
  return inStock?.id ?? item.variants[0]?.id ?? null;
}

function canSell(item: ShopFrontItem, variantId: string | null, quantity: number): boolean {
  if (variantId) {
    const variant = item.variants.find((entry) => entry.id === variantId);
    if (!variant) {
      return false;
    }
    if (variant.stock != null && quantity > variant.stock) {
      return false;
    }
  } else if (item.stock != null && quantity > item.stock) {
    return false;
  }
  return true;
}

function availabilityBadge(item: ShopFrontItem) {
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
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ loading: false, error: null, success: null });
  const [stripeReady, setStripeReady] = useState<boolean>(false);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);

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
        if (items.length > 0) {
          const first = items[0];
          setSelectedItemId(first.id);
          setSelectedVariantId(pickInitialVariant(first));
        }
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
    if (!selectedItemId) {
      return;
    }
    const item = catalog.find((entry) => entry.id === selectedItemId);
    if (!item) {
      return;
    }
    if (!item.variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(pickInitialVariant(item));
    }
  }, [catalog, selectedItemId, selectedVariantId]);

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
        setStripeReady(Boolean(client));
        if (!client) {
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
    const normalizedSearch = search.trim().toLowerCase();
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
  }, [brandFilter, catalog, search]);

  const selectedItem = useMemo<ShopFrontItem | null>(() => {
    if (!selectedItemId) {
      return null;
    }
    return filteredCatalog.find((item) => item.id === selectedItemId) ?? catalog.find((item) => item.id === selectedItemId) ?? null;
  }, [catalog, filteredCatalog, selectedItemId]);

  const selectedVariant: ShopFrontVariant | null = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    if (!selectedVariantId) {
      return null;
    }
    return selectedItem.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  }, [selectedItem, selectedVariantId]);

  const handleSelectItem = (item: ShopFrontItem) => {
    setSelectedItemId(item.id);
    setSelectedVariantId(pickInitialVariant(item));
    setQuantity(1);
    setCheckoutState({ loading: false, error: null, success: null });
  };

  const handleCheckout = async () => {
    if (!selectedItem) {
      return;
    }
    const valid = canSell(selectedItem, selectedVariantId, quantity);
    if (!valid) {
      setCheckoutState({ loading: false, error: "Stock insuffisant pour cette configuration.", success: null });
      return;
    }

    setCheckoutState({ loading: true, error: null, success: null });

    try {
      const payload = {
        itemId: selectedItem.id,
        variantId: selectedVariantId,
        quantity,
        customerEmail: profile?.sponsor_contact?.email ?? profile?.payout_email ?? null,
        successUrl: typeof window !== 'undefined' ? `${window.location.origin}/shop?checkout=success` : undefined,
        cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}/shop?checkout=cancel` : undefined,
      };
      const { sessionId, url } = await createShopCheckoutSession(payload);
      if (stripeReady) {
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
      setCheckoutState({ loading: false, error: "Redirection Stripe indisponible.", success: null });
    } catch (cause) {
      console.error('Unable to start checkout', cause);
      setCheckoutState({ loading: false, error: "Impossible de lancer le paiement. Réessaie dans un instant.", success: null });
    }
  };

  const inventoryCard = (item: ShopFrontItem) => {
    const price = formatCurrency(item.priceCents, item.currency);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelectItem(item)}
        className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
          selectedItemId === item.id
            ? 'border-orange-500/70 bg-orange-500/10 text-white'
            : 'border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-orange-500/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/70"
              style={{
                background: item.sponsor.primaryColor ? `${item.sponsor.primaryColor}22` : undefined,
                color: item.sponsor.primaryColor ?? undefined,
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{item.name}</p>
              <p className="text-xs text-slate-400">{item.sponsor.brandName ?? 'Marque partenaire'}</p>
            </div>
          </div>
          <span className="text-sm font-medium text-slate-100">{price}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Package2 size={14} />
          <span>{availabilityBadge(item)}</span>
        </div>
      </button>
    );
  };

  const renderVariantPicker = () => {
    if (!selectedItem) {
      return null;
    }
    if (selectedItem.variants.length === 0) {
      return null;
    }
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Variantes</p>
        <div className="flex flex-wrap gap-2">
          {selectedItem.variants.map((variant) => {
            const isActive = selectedVariantId === variant.id;
            const disabled = (variant.stock ?? 0) <= 0;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedVariantId(variant.id)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  isActive ? 'border-orange-500 text-orange-200' : 'border-slate-700 text-slate-200 hover:border-orange-400'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>{variant.name}</span>
                {variant.priceCents != null && variant.priceCents !== selectedItem.priceCents && (
                  <span className="ml-2 text-[11px] text-slate-400">
                    {formatCurrency(variant.priceCents, selectedItem.currency)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Marketplace SkateConnect</h1>
            <p className="mt-1 text-sm text-slate-300">
              Découvre les drops officiels des shops et marques partenaires. Paiement sécurisé via Stripe Connect, commission
              reversée à la plateforme.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <ShieldCheck size={14} /> Paiement sécurisé
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <Truck size={14} /> Expédition par la marque
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <Sparkles size={14} /> Commission SkateConnect incluse
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
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-1/3">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un produit ou une marque"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-2 pl-10 pr-3 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBrandFilter('all')}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    brandFilter === 'all'
                      ? 'border-orange-500 text-orange-200'
                      : 'border-slate-700 text-slate-300 hover:border-orange-500/60'
                  }`}
                >
                  Toutes les marques
                </button>
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => setBrandFilter(brand.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      brandFilter === brand.id
                        ? 'border-orange-500 text-orange-200'
                        : 'border-slate-700 text-slate-300 hover:border-orange-500/60'
                    }`}
                  >
                    {brand.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3">
                {loading && (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 py-6 text-slate-300">
                    <Loader2 className="animate-spin" size={18} /> Chargement de la boutique...
                  </div>
                )}
                {!loading && error && (
                  <div className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                )}
                {!loading && !error && filteredCatalog.length === 0 && (
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-6 text-sm text-slate-300">
                    Aucun produit ne correspond à la recherche.
                  </div>
                )}
                {filteredCatalog.map((item) => inventoryCard(item))}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-2/3">
            {!selectedItem ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 text-slate-300">
                <Store size={32} className="mb-2" />
                Sélectionne un produit pour voir les détails.
              </div>
            ) : (
              <div className="flex h-full flex-col gap-5 rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {selectedItem.sponsor.brandName ?? 'Marque partenaire'}
                      </p>
                      <h2 className="text-2xl font-semibold text-white">{selectedItem.name}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Prix unitaire</p>
                      <p className="text-xl font-semibold text-white">
                        {formatCurrency(computeVariantPrice(selectedItem, selectedVariantId), selectedItem.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Sparkles size={14} />
                    <span>{availabilityBadge(selectedItem)}</span>
                    <span>•</span>
                    <ShoppingCart size={14} />
                    <span>
                      {(selectedVariant?.stock ?? selectedItem.stock ?? 0) > 0
                        ? `${selectedVariant?.stock ?? selectedItem.stock} en stock`
                        : 'Stock limité'}
                    </span>
                  </div>
                </div>

                {selectedItem.description && (
                  <p className="text-sm leading-relaxed text-slate-300">{selectedItem.description}</p>
                )}

                {renderVariantPicker()}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quantité</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="h-10 w-10 rounded-full border border-slate-700 text-lg text-white hover:border-orange-500"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                      className="w-16 rounded-xl border border-slate-700 bg-slate-900 py-2 text-center text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => value + 1)}
                      className="h-10 w-10 rounded-full border border-slate-700 text-lg text-white hover:border-orange-500"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Total estimé :{' '}
                    <span className="font-semibold text-white">
                      {formatCurrency(
                        computeVariantPrice(selectedItem, selectedVariantId) * quantity,
                        selectedItem.currency,
                      )}
                    </span>
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    <ShieldCheck size={14} /> Processus de paiement
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Paiement traité via Stripe Connect pour sécuriser les transactions.</li>
                    <li>La marque expédie directement le produit. SkateConnect conserve sa commission.</li>
                    <li>Un reçu est envoyé à l'adresse associée à ton compte.</li>
                  </ul>
                </div>

                {checkoutState.error && (
                  <div className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {checkoutState.error}
                  </div>
                )}
                {checkoutState.success && (
                  <div className="rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    <CheckCircle2 className="mr-2 inline" size={16} /> {checkoutState.success}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShoppingCart size={14} />
                    <span>{stripeReady ? 'Paiement Stripe prêt' : "Lien de paiement disponible"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkoutState.loading}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-500/70 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100 transition-colors hover:bg-orange-500/20 disabled:opacity-50"
                  >
                    {checkoutState.loading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Redirection Stripe...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} />
                        Procéder au paiement
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
