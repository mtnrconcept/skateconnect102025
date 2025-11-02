import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { uploadFile } from '../../../lib/storage';
import { useSponsorContext } from '../../../contexts/SponsorContext';
import type { SponsorShopItem } from '../../../types';
import type {
  SponsorShopBundleDraft,
  SponsorShopCouponDraft,
  SponsorShopVariantDraft,
} from '../../../lib/sponsorShop';

export interface SponsorShopItemFormValues {
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  variants: SponsorShopVariantDraft[];
  coupons: SponsorShopCouponDraft[];
  bundles: SponsorShopBundleDraft[];
}

interface SponsorShopItemModalProps {
  mode: 'create' | 'edit';
  item?: SponsorShopItem | null;
  onClose: () => void;
  onSubmit: (values: SponsorShopItemFormValues) => Promise<void>;
}

function formatPriceInput(value: number): string {
  return (value / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePriceInput(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function toDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

const AVAILABLE_CURRENCIES = [
  { code: 'EUR', label: 'EUR – €' },
  { code: 'USD', label: 'USD – $' },
  { code: 'GBP', label: 'GBP – £' },
];

export default function SponsorShopItemModal({ mode, item, onClose, onSubmit }: SponsorShopItemModalProps) {
  const { sponsorId, shopItems, shopVariants, shopCoupons, shopBundles } = useSponsorContext();

  const initialVariants = useMemo<SponsorShopVariantDraft[]>(() => {
    if (!item) {
      return [];
    }
    return shopVariants
      .filter((variant) => variant.item_id === item.id)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        size: variant.size ?? null,
        color: variant.color ?? null,
        sku: variant.sku ?? null,
        price_cents: variant.price_cents ?? null,
        stock: variant.stock,
        is_active: variant.is_active,
        image_url: variant.image_url ?? null,
        availability_start: variant.availability_start ?? null,
        availability_end: variant.availability_end ?? null,
        metadata: variant.metadata ?? null,
      }));
  }, [item, shopVariants]);

  const initialCoupons = useMemo<SponsorShopCouponDraft[]>(() => {
    if (!item) {
      return [];
    }
    return shopCoupons
      .filter((coupon) => coupon.item_id === item.id)
      .map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description ?? '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        max_uses: coupon.max_uses,
        usage_count: coupon.usage_count,
        minimum_quantity: coupon.minimum_quantity,
        is_active: coupon.is_active,
        starts_at: coupon.starts_at ?? null,
        expires_at: coupon.expires_at ?? null,
        metadata: coupon.metadata ?? null,
      }));
  }, [item, shopCoupons]);

  const initialBundles = useMemo<SponsorShopBundleDraft[]>(() => {
    if (!item) {
      return [];
    }
    return shopBundles
      .filter((bundle) => bundle.primary_item_id === item.id)
      .map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        description: bundle.description ?? '',
        price_cents: bundle.price_cents,
        currency: bundle.currency,
        is_active: bundle.is_active,
        available_from: bundle.available_from ?? null,
        available_until: bundle.available_until ?? null,
        metadata: bundle.metadata ?? null,
        items: bundle.items.map((bundleItem) => ({
          item_id: bundleItem.item_id,
          quantity: bundleItem.quantity,
        })),
      }));
  }, [item, shopBundles]);

  const [form, setForm] = useState<SponsorShopItemFormValues>(() => ({
    name: item?.name ?? '',
    description: item?.description ?? '',
    priceCents: item?.price_cents ?? 0,
    currency: item?.currency ?? 'EUR',
    stock: item?.stock ?? 0,
    isActive: item?.is_active ?? true,
    imageUrl: item?.image_url ?? null,
    availableFrom: item?.available_from ?? null,
    availableUntil: item?.available_until ?? null,
    variants: initialVariants,
    coupons: initialCoupons,
    bundles: initialBundles,
  }));
  const [priceInput, setPriceInput] = useState<string>(formatPriceInput(form.priceCents));
  const [availableFromInput, setAvailableFromInput] = useState<string>(
    toDateTimeLocalInput(form.availableFrom),
  );
  const [availableUntilInput, setAvailableUntilInput] = useState<string>(
    toDateTimeLocalInput(form.availableUntil),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bundleItemOptions = useMemo(
    () => shopItems.map((option) => ({ id: option.id, name: option.name })),
    [shopItems],
  );

  const modalTitle = useMemo(
    () => (mode === 'create' ? 'Ajouter un produit' : 'Modifier le produit'),
    [mode],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.currentTarget;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadFile('sponsors', file, sponsorId ? `shop/${sponsorId}` : undefined);
      setForm((current) => ({ ...current, imageUrl: url }));
    } catch (cause) {
      console.error('Unable to upload sponsor shop media', cause);
      setUploadError("Impossible de téléverser le visuel. Réessaie ou utilise un fichier plus léger.");
    } finally {
      setUploading(false);
      target.value = '';
    }
  };

  const addVariant = () => {
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          name: '',
          size: null,
          color: null,
          sku: null,
          price_cents: null,
          stock: 0,
          is_active: true,
          image_url: null,
          availability_start: null,
          availability_end: null,
          metadata: null,
        },
      ],
    }));
  };

  const updateVariant = (index: number, patch: Partial<SponsorShopVariantDraft>) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
  };

  const removeVariant = (index: number) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  };

  const addCoupon = () => {
    setForm((current) => ({
      ...current,
      coupons: [
        ...current.coupons,
        {
          code: '',
          description: '',
          discount_type: 'percentage',
          discount_value: 10,
          max_uses: null,
          usage_count: 0,
          minimum_quantity: 1,
          is_active: true,
          starts_at: null,
          expires_at: null,
          metadata: null,
        },
      ],
    }));
  };

  const updateCoupon = (index: number, patch: Partial<SponsorShopCouponDraft>) => {
    setForm((current) => ({
      ...current,
      coupons: current.coupons.map((coupon, couponIndex) =>
        couponIndex === index ? { ...coupon, ...patch } : coupon,
      ),
    }));
  };

  const removeCoupon = (index: number) => {
    setForm((current) => ({
      ...current,
      coupons: current.coupons.filter((_, couponIndex) => couponIndex !== index),
    }));
  };

  const addBundle = () => {
    setForm((current) => ({
      ...current,
      bundles: [
        ...current.bundles,
        {
          name: '',
          description: '',
          price_cents: current.priceCents,
          currency: current.currency,
          is_active: true,
          available_from: null,
          available_until: null,
          metadata: null,
          items: [],
        },
      ],
    }));
  };

  const updateBundle = (index: number, patch: Partial<SponsorShopBundleDraft>) => {
    setForm((current) => ({
      ...current,
      bundles: current.bundles.map((bundle, bundleIndex) =>
        bundleIndex === index ? { ...bundle, ...patch } : bundle,
      ),
    }));
  };

  const removeBundle = (index: number) => {
    setForm((current) => ({
      ...current,
      bundles: current.bundles.filter((_, bundleIndex) => bundleIndex !== index),
    }));
  };

  const addBundleItem = (bundleIndex: number) => {
    setForm((current) => {
      const bundles = current.bundles.map((bundle, index) => {
        if (index !== bundleIndex) {
          return bundle;
        }
        return {
          ...bundle,
          items: [...bundle.items, { item_id: '', quantity: 1 }],
        };
      });
      return { ...current, bundles };
    });
  };

  const updateBundleItem = (
    bundleIndex: number,
    itemIndex: number,
    patch: Partial<{ item_id: string; quantity: number }>,
  ) => {
    setForm((current) => {
      const bundles = current.bundles.map((bundle, index) => {
        if (index !== bundleIndex) {
          return bundle;
        }
        const items = bundle.items.map((bundleItem, innerIndex) =>
          innerIndex === itemIndex ? { ...bundleItem, ...patch } : bundleItem,
        );
        return { ...bundle, items };
      });
      return { ...current, bundles };
    });
  };

  const removeBundleItem = (bundleIndex: number, itemIndex: number) => {
    setForm((current) => {
      const bundles = current.bundles.map((bundle, index) => {
        if (index !== bundleIndex) {
          return bundle;
        }
        return {
          ...bundle,
          items: bundle.items.filter((_, innerIndex) => innerIndex !== itemIndex),
        };
      });
      return { ...current, bundles };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (!form.name.trim()) {
      setError('Le nom du produit est requis.');
      return;
    }

    if (form.priceCents <= 0) {
      setError('Définis un prix supérieur à 0.');
      return;
    }

    if (form.stock < 0) {
      setError('Le stock ne peut pas être négatif.');
      return;
    }

    if (form.availableFrom && form.availableUntil) {
      if (new Date(form.availableFrom) >= new Date(form.availableUntil)) {
        setError('La date de fin de disponibilité doit être postérieure à la date de début.');
        return;
      }
    }

    for (const variant of form.variants) {
      if (!variant.name.trim()) {
        setError('Chaque variante doit posséder un nom.');
        return;
      }
      if ((variant.price_cents ?? 0) < 0) {
        setError('Le prix d’une variante ne peut pas être négatif.');
        return;
      }
      if (variant.stock < 0) {
        setError('Le stock d’une variante ne peut pas être négatif.');
        return;
      }
      if (variant.availability_start && variant.availability_end) {
        if (new Date(variant.availability_start) >= new Date(variant.availability_end)) {
          setError(`La période de disponibilité de la variante « ${variant.name} » est invalide.`);
          return;
        }
      }
    }

    for (const coupon of form.coupons) {
      if (!coupon.code.trim()) {
        setError('Chaque code promotionnel doit avoir un identifiant.');
        return;
      }
      if (coupon.discount_value <= 0) {
        setError(`Le coupon ${coupon.code} doit avoir une valeur de réduction supérieure à 0.`);
        return;
      }
      if (coupon.discount_type === 'percentage' && coupon.discount_value > 100) {
        setError(`Le coupon ${coupon.code} ne peut pas dépasser 100 % de réduction.`);
        return;
      }
      if ((coupon.minimum_quantity ?? 1) <= 0) {
        setError(`La quantité minimale du coupon ${coupon.code} doit être supérieure à 0.`);
        return;
      }
      if (coupon.max_uses != null && coupon.max_uses <= 0) {
        setError(`Le nombre maximal d’utilisations du coupon ${coupon.code} doit être positif.`);
        return;
      }
      if (coupon.starts_at && coupon.expires_at) {
        if (new Date(coupon.starts_at) >= new Date(coupon.expires_at)) {
          setError(`La fenêtre de validité du coupon ${coupon.code} est invalide.`);
          return;
        }
      }
    }

    for (const bundle of form.bundles) {
      if (!bundle.name.trim()) {
        setError('Chaque bundle doit être nommé.');
        return;
      }
      if (bundle.price_cents <= 0) {
        setError(`Le bundle ${bundle.name} doit avoir un prix supérieur à 0.`);
        return;
      }
      if (bundle.items.length === 0) {
        setError(`Ajoute au moins un produit complémentaire dans le bundle ${bundle.name}.`);
        return;
      }
      if (bundle.available_from && bundle.available_until) {
        if (new Date(bundle.available_from) >= new Date(bundle.available_until)) {
          setError(`La période du bundle ${bundle.name} est invalide.`);
          return;
        }
      }
      for (const bundleItem of bundle.items) {
        if (!bundleItem.item_id) {
          setError(`Chaque élément du bundle ${bundle.name} doit référencer un produit valide.`);
          return;
        }
        if (bundleItem.quantity <= 0) {
          setError(`Les quantités doivent être positives dans le bundle ${bundle.name}.`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (cause) {
      console.error('Unable to persist shop item', cause);
      setError("Impossible d'enregistrer le produit. Réessaie dans quelques instants.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80">
      <div className="flex min-h-full items-start justify-center px-4 py-10 md:items-center">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white"
          >
          <X size={18} />
        </button>
        <form onSubmit={handleSubmit} className="space-y-6 p-8">
          <div>
            <h2 className="text-2xl font-semibold text-white">{modalTitle}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Renseigne les informations merchandising de ton produit sponsorisé. Les visuels sont optimisés automatiquement.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Nom du produit
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value.slice(0, 120) }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Pack ambassadeur Q3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Prix (TTC)
              <input
                value={priceInput}
                onChange={(event) => {
                  const inputValue = event.target.value;
                  setPriceInput(inputValue);
                  setForm((current) => ({ ...current, priceCents: parsePriceInput(inputValue) }));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="249,90"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Devise
              <select
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {AVAILABLE_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Stock disponible
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(event) =>
                  setForm((current) => ({ ...current, stock: Number.parseInt(event.target.value, 10) || 0 }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Description
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value.slice(0, 600) }))
              }
              rows={4}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Précise les bénéfices du pack, les contreparties, la mécanique d'activation..."
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Disponible à partir
              <input
                type="datetime-local"
                value={availableFromInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setAvailableFromInput(value);
                  setForm((current) => ({
                    ...current,
                    availableFrom: value ? toIsoFromLocalInput(value) : null,
                  }));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <span className="text-xs text-slate-500">
                Laisse vide pour publier immédiatement.
              </span>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Disponible jusqu'au
              <input
                type="datetime-local"
                value={availableUntilInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setAvailableUntilInput(value);
                  setForm((current) => ({
                    ...current,
                    availableUntil: value ? toIsoFromLocalInput(value) : null,
                  }));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <span className="text-xs text-slate-500">
                Programme l'arrêt automatique des ventes.
              </span>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Visuel principal</p>
              {form.imageUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70">
                  <img src={form.imageUrl} alt="Visuel du produit" className="h-48 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-slate-950/70 px-4 py-2 text-xs text-slate-300">
                    <span className="truncate">{form.imageUrl}</span>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, imageUrl: null }))}
                      className="text-orange-300 hover:text-orange-200"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
                  Aucun visuel pour le moment.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white">
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  {uploading ? 'Téléversement...' : 'Téléverser un média'}
                </label>
                <span>PNG, JPG ou WEBP • 10 Mo max</span>
                {uploadError && <span className="text-orange-300">{uploadError}</span>}
              </div>
            </div>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Statut
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="active">Actif</option>
                <option value="inactive">En pause</option>
              </select>
              <span className="text-xs text-slate-500">
                Les produits en pause restent visibles dans l'inventaire interne mais ne sont plus proposés aux riders.
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Variantes</h3>
                <p className="text-xs text-slate-400">
                  Définis des déclinaisons (taille, couleur...) avec un stock et une fenêtre de vente dédiés.
                </p>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:text-white"
              >
                Ajouter une variante
              </button>
            </div>
            {form.variants.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                Aucune variante configurée. Les riders verront uniquement la fiche produit principale.
              </p>
            ) : (
              <div className="space-y-2">
                {form.variants.map((variant, index) => (
                  <details
                    key={variant.id ?? `variant-${index}`}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
                    open={form.variants.length <= 2}
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-200">
                      <span>{variant.name.trim() || `Variante #${index + 1}`}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{variant.is_active ? 'Active' : 'En pause'}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeVariant(index);
                          }}
                          className="rounded-full border border-orange-500/40 px-2 py-0.5 text-orange-200 hover:border-orange-400 hover:text-orange-100"
                        >
                          Supprimer
                        </button>
                      </div>
                    </summary>
                    <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-200">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Nom de la variante
                          <input
                            value={variant.name}
                            onChange={(event) =>
                              updateVariant(index, { name: event.target.value.slice(0, 100) })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="Taille M / Bleu"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          SKU interne (optionnel)
                          <input
                            value={variant.sku ?? ''}
                            onChange={(event) =>
                              updateVariant(index, { sku: event.target.value.slice(0, 60) || null })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="SKU-M-BLEU"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Stock dédié
                          <input
                            type="number"
                            min={0}
                            value={variant.stock}
                            onChange={(event) =>
                              updateVariant(index, {
                                stock: Number.parseInt(event.target.value, 10) || 0,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Statut
                          <select
                            value={variant.is_active ? 'active' : 'inactive'}
                            onChange={(event) =>
                              updateVariant(index, { is_active: event.target.value === 'active' })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">En pause</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Taille (optionnel)
                          <input
                            value={variant.size ?? ''}
                            onChange={(event) =>
                              updateVariant(index, { size: event.target.value.slice(0, 40) || null })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="M"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Couleur (optionnel)
                          <input
                            value={variant.color ?? ''}
                            onChange={(event) =>
                              updateVariant(index, { color: event.target.value.slice(0, 40) || null })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="Bleu nuit"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Prix spécifique (TTC)
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={
                              variant.price_cents != null
                                ? (variant.price_cents / 100).toString()
                                : ''
                            }
                            onChange={(event) => {
                              const inputValue = event.target.value;
                              const parsed = Number.parseFloat(inputValue);
                              updateVariant(index, {
                                price_cents: Number.isNaN(parsed) ? null : Math.round(parsed * 100),
                              });
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="Laisser vide pour hériter du prix principal"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Visuel spécifique (URL)
                          <input
                            value={variant.image_url ?? ''}
                            onChange={(event) =>
                              updateVariant(index, {
                                image_url: event.target.value.trim() ? event.target.value.trim() : null,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="https://..."
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Ouverture
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalInput(variant.availability_start ?? null)}
                            onChange={(event) =>
                              updateVariant(index, {
                                availability_start: toIsoFromLocalInput(event.target.value) ?? null,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Fermeture
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalInput(variant.availability_end ?? null)}
                            onChange={(event) =>
                              updateVariant(index, {
                                availability_end: toIsoFromLocalInput(event.target.value) ?? null,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Codes promotionnels</h3>
                <p className="text-xs text-slate-400">
                  Offre des remises ciblées et planifie leur disponibilité.
                </p>
              </div>
              <button
                type="button"
                onClick={addCoupon}
                className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:text-white"
              >
                Ajouter un code
              </button>
            </div>
            {form.coupons.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                Aucun code promo n'est actif pour ce produit.
              </p>
            ) : (
              <div className="space-y-2">
                {form.coupons.map((coupon, index) => (
                  <details
                    key={coupon.id ?? `coupon-${index}`}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
                    open={form.coupons.length <= 2}
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-200">
                      <span>{coupon.code.trim() || `Code promo #${index + 1}`}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{coupon.is_active ? 'Actif' : 'Archivé'}</span>
                        <span>{coupon.usage_count ?? 0} utilisation(s)</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeCoupon(index);
                          }}
                          className="rounded-full border border-orange-500/40 px-2 py-0.5 text-orange-200 hover:border-orange-400 hover:text-orange-100"
                        >
                          Supprimer
                        </button>
                      </div>
                    </summary>
                    <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-200">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Code
                          <input
                            value={coupon.code}
                            onChange={(event) =>
                              updateCoupon(index, { code: event.target.value.slice(0, 40) })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="WELCOME10"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Statut
                          <select
                            value={coupon.is_active ? 'active' : 'inactive'}
                            onChange={(event) =>
                              updateCoupon(index, { is_active: event.target.value === 'active' })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="active">Actif</option>
                            <option value="inactive">Archivé</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          Type de remise
                          <select
                            value={coupon.discount_type}
                            onChange={(event) =>
                              updateCoupon(index, { discount_type: event.target.value as SponsorShopCouponDraft['discount_type'] })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="percentage">Pourcentage</option>
                            <option value="fixed">Montant fixe</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          Valeur
                          <input
                            type="number"
                            min={1}
                            step={coupon.discount_type === 'percentage' ? 1 : 0.01}
                            max={coupon.discount_type === 'percentage' ? 100 : undefined}
                            value={
                              coupon.discount_type === 'percentage'
                                ? coupon.discount_value
                                : (coupon.discount_value / 100).toString()
                            }
                            onChange={(event) => {
                              const inputValue = event.target.value;
                              if (coupon.discount_type === 'percentage') {
                                const parsed = Number.parseInt(inputValue, 10);
                                updateCoupon(index, {
                                  discount_value: Number.isNaN(parsed) ? 0 : parsed,
                                });
                              } else {
                                const parsed = Number.parseFloat(inputValue);
                                updateCoupon(index, {
                                  discount_value: Number.isNaN(parsed)
                                    ? 0
                                    : Math.round(parsed * 100),
                                });
                              }
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Utilisations max (optionnel)
                          <input
                            type="number"
                            min={1}
                            value={coupon.max_uses ?? ''}
                            onChange={(event) =>
                              updateCoupon(index, {
                                max_uses: event.target.value
                                  ? Number.parseInt(event.target.value, 10) || 1
                                  : null,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Quantité minimale
                          <input
                            type="number"
                            min={1}
                            value={coupon.minimum_quantity ?? 1}
                            onChange={(event) =>
                              updateCoupon(index, {
                                minimum_quantity: Number.parseInt(event.target.value, 10) || 1,
                              })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Description (optionnelle)
                          <textarea
                            value={coupon.description ?? ''}
                            onChange={(event) =>
                              updateCoupon(index, {
                                description: event.target.value.slice(0, 160) || '',
                              })
                            }
                            rows={2}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            Débute le
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalInput(coupon.starts_at ?? null)}
                              onChange={(event) =>
                                updateCoupon(index, {
                                  starts_at: toIsoFromLocalInput(event.target.value) ?? null,
                                })
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            Expire le
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalInput(coupon.expires_at ?? null)}
                              onChange={(event) =>
                                updateCoupon(index, {
                                  expires_at: toIsoFromLocalInput(event.target.value) ?? null,
                                })
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Bundles / Packs</h3>
                <p className="text-xs text-slate-400">
                  Combine ce produit avec d'autres références pour créer des offres packagées.
                </p>
              </div>
              <button
                type="button"
                onClick={addBundle}
                className="rounded-full border border-slate-700/70 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:text-white"
              >
                Ajouter un bundle
              </button>
            </div>
            {form.bundles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                Aucun bundle n'est paramétré pour le moment.
              </p>
            ) : (
              <div className="space-y-2">
                {form.bundles.map((bundle, index) => (
                  <details
                    key={bundle.id ?? `bundle-${index}`}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
                    open={form.bundles.length <= 2}
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-200">
                      <span>{bundle.name.trim() || `Bundle #${index + 1}`}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{bundle.is_active ? 'Actif' : 'En pause'}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeBundle(index);
                          }}
                          className="rounded-full border border-orange-500/40 px-2 py-0.5 text-orange-200 hover:border-orange-400 hover:text-orange-100"
                        >
                          Supprimer
                        </button>
                      </div>
                    </summary>
                    <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-200">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Nom du bundle
                          <input
                            value={bundle.name}
                            onChange={(event) =>
                              updateBundle(index, { name: event.target.value.slice(0, 120) })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="Pack ambassadeur"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Statut
                          <select
                            value={bundle.is_active ? 'active' : 'inactive'}
                            onChange={(event) =>
                              updateBundle(index, { is_active: event.target.value === 'active' })
                            }
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="active">Actif</option>
                            <option value="inactive">En pause</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          Prix du pack (TTC)
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={(bundle.price_cents / 100).toString()}
                            onChange={(event) => {
                              const parsed = Number.parseFloat(event.target.value);
                              updateBundle(index, {
                                price_cents: Number.isNaN(parsed) ? 0 : Math.round(parsed * 100),
                              });
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          Devise
                          <select
                            value={bundle.currency}
                            onChange={(event) => updateBundle(index, { currency: event.target.value })}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            {AVAILABLE_CURRENCIES.map((currency) => (
                              <option key={`${bundle.id ?? 'new'}-${currency.code}`} value={currency.code}>
                                {currency.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          Description (optionnelle)
                          <textarea
                            value={bundle.description ?? ''}
                            onChange={(event) =>
                              updateBundle(index, {
                                description: event.target.value.slice(0, 180) || '',
                              })
                            }
                            rows={2}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            Débute le
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalInput(bundle.available_from ?? null)}
                              onChange={(event) =>
                                updateBundle(index, {
                                  available_from: toIsoFromLocalInput(event.target.value) ?? null,
                                })
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            Se termine le
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalInput(bundle.available_until ?? null)}
                              onChange={(event) =>
                                updateBundle(index, {
                                  available_until: toIsoFromLocalInput(event.target.value) ?? null,
                                })
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                          Produits inclus
                        </p>
                        {bundle.items.length === 0 ? (
                          <p className="text-xs text-slate-500">Ajoute un produit pour composer ton pack.</p>
                        ) : (
                          <div className="space-y-2">
                            {bundle.items.map((bundleItem, itemIndex) => (
                              <div
                                key={`${bundle.id ?? 'new'}-item-${itemIndex}`}
                                className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_90px] md:items-center"
                              >
                                <select
                                  value={bundleItem.item_id}
                                  onChange={(event) =>
                                    updateBundleItem(index, itemIndex, { item_id: event.target.value })
                                  }
                                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="">Sélectionner un produit</option>
                                  {bundleItemOptions.map((option) => (
                                    <option key={`${bundle.id ?? 'new'}-${option.id}`} value={option.id}>
                                      {option.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min={1}
                                  value={bundleItem.quantity}
                                  onChange={(event) =>
                                    updateBundleItem(index, itemIndex, {
                                      quantity: Number.parseInt(event.target.value, 10) || 1,
                                    })
                                  }
                                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeBundleItem(index, itemIndex)}
                                  className="rounded-full border border-orange-500/40 px-2 py-0.5 text-xs text-orange-200 hover:border-orange-400 hover:text-orange-100"
                                >
                                  Retirer
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => addBundleItem(index)}
                          className="rounded-full border border-slate-700/70 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 hover:text-white"
                        >
                          Ajouter un produit au pack
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-orange-300">{error}</p>}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-full border border-orange-500/70 bg-orange-500/10 px-6 py-2 text-sm font-medium text-orange-100 hover:border-orange-400 hover:bg-orange-500/20 disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : mode === 'create' ? 'Ajouter le produit' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
