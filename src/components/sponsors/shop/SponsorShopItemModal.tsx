import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { uploadFile } from '../../../lib/storage';
import { useSponsorContext } from '../../../contexts/SponsorContext';
import type { SponsorShopItem } from '../../../types';

export interface SponsorShopItemFormValues {
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
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

const AVAILABLE_CURRENCIES = [
  { code: 'EUR', label: 'EUR – €' },
  { code: 'USD', label: 'USD – $' },
  { code: 'GBP', label: 'GBP – £' },
];

export default function SponsorShopItemModal({ mode, item, onClose, onSubmit }: SponsorShopItemModalProps) {
  const { sponsorId } = useSponsorContext();
  const [form, setForm] = useState<SponsorShopItemFormValues>(() => ({
    name: item?.name ?? '',
    description: item?.description ?? '',
    priceCents: item?.price_cents ?? 0,
    currency: item?.currency ?? 'EUR',
    stock: item?.stock ?? 0,
    isActive: item?.is_active ?? true,
    imageUrl: item?.image_url ?? null,
  }));
  const [priceInput, setPriceInput] = useState<string>(formatPriceInput(form.priceCents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-10">
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Précise les bénéfices du pack, les contreparties, la mécanique d'activation..."
            />
          </label>

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
                      className="text-rose-300 hover:text-rose-200"
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
                {uploadError && <span className="text-rose-300">{uploadError}</span>}
              </div>
            </div>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Statut
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="active">Actif</option>
                <option value="inactive">En pause</option>
              </select>
              <span className="text-xs text-slate-500">
                Les produits en pause restent visibles dans l'inventaire interne mais ne sont plus proposés aux riders.
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}

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
              className="rounded-full border border-sky-500/70 bg-sky-500/10 px-6 py-2 text-sm font-medium text-sky-100 hover:border-sky-400 hover:bg-sky-500/20 disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : mode === 'create' ? 'Ajouter le produit' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
