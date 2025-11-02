import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import type { SponsorShopItem } from '../../types';
import { uploadFile } from '../../lib/storage';
import { useSponsorContext } from '../../contexts/SponsorContext';

interface SponsorShopItemFormModalProps {
  mode: 'create' | 'edit';
  item?: SponsorShopItem | null;
  onClose: () => void;
}

const formatPrice = (priceCents?: number) => {
  if (!priceCents) {
    return '';
  }

  return (priceCents / 100).toFixed(2);
};

export default function SponsorShopItemFormModal({ mode, item, onClose }: SponsorShopItemFormModalProps) {
  const { sponsorId, createShopItem, editShopItem } = useSponsorContext();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(formatPrice(item?.price_cents));
  const [stock, setStock] = useState(item ? String(item.stock) : '0');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setPrice(formatPrice(item?.price_cents));
    setStock(item ? String(item.stock) : '0');
    setIsActive(item?.is_active ?? true);
    setImageUrl(item?.image_url ?? '');
    setFormError(null);
  }, [item]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const modalTitle = useMemo(
    () => (mode === 'edit' ? 'Modifier le produit' : 'Ajouter un produit'),
    [mode],
  );

  const submitLabel = useMemo(
    () => (mode === 'edit' ? 'Enregistrer les modifications' : 'Créer le produit'),
    [mode],
  );

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    if (!sponsorId) {
      setFormError("Identifiant sponsor introuvable : réessaie après reconnexion.");
      event.target.value = '';
      return;
    }

    const file = event.target.files[0];
    setUploading(true);
    setFormError(null);

    try {
      const { url } = await uploadFile('sponsors', file, sponsorId);
      setImageUrl(url);
    } catch (cause) {
      console.error('Unable to upload sponsor shop media', cause);
      setFormError('Impossible de téléverser le média. Merci de réessayer plus tard.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Le nom du produit est obligatoire.');
      setSubmitting(false);
      return;
    }

    const normalizedPrice = price.replace(',', '.').trim();
    const parsedPrice = Number.parseFloat(normalizedPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError('Le prix doit être un montant positif (ex: 49.90).');
      setSubmitting(false);
      return;
    }

    const parsedStock = Number.parseInt(stock, 10);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setFormError('Le stock doit être un nombre entier supérieur ou égal à 0.');
      setSubmitting(false);
      return;
    }

    const descriptionValue = description.trim() ? description.trim() : null;
    const imageValue = imageUrl ? imageUrl : null;
    const priceCents = Math.round(parsedPrice * 100);

    try {
      if (mode === 'edit' && item) {
        await editShopItem(item.id, {
          name: trimmedName,
          description: descriptionValue,
          price_cents: priceCents,
          currency: item.currency ?? 'EUR',
          stock: parsedStock,
          is_active: isActive,
          image_url: imageValue,
        });
      } else {
        await createShopItem({
          name: trimmedName,
          description: descriptionValue,
          price_cents: priceCents,
          currency: 'EUR',
          stock: parsedStock,
          is_active: isActive,
          image_url: imageValue,
          metadata: null,
        });
      }
      onClose();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Impossible d'enregistrer le produit. Merci de réessayer.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const disableActions = submitting || uploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Boutique sponsor</p>
            <h2 className="text-xl font-semibold text-white">{modalTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700/70 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
            aria-label="Fermer la fenêtre de création de produit"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(90vh-96px)] space-y-6 overflow-y-auto px-6 py-6">
          {formError && (
            <div className="rounded-xl border border-orange-500/40 bg-orange-950/40 px-4 py-3 text-sm text-orange-100">
              {formError}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-200">Nom du produit *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Pack découverte Street"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-200">Prix TTC (€) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="49.90"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-200">Stock disponible *</span>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="25"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-200">Statut</span>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(event) => setIsActive(event.target.value === 'active')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="active">Actif · visible dans la boutique</option>
                <option value="inactive">En pause</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-200">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Détaille le contenu du pack, l'expérience proposée..."
            />
          </label>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-200">Visuel produit</p>
            {imageUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-700/70">
                <img src={imageUrl} alt={name || 'Visuel produit'} className="h-48 w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={32} className="text-slate-600" />
                  <span>Aucun média sélectionné</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-orange-500/70 px-4 py-2 text-sm text-orange-200 hover:bg-orange-500/10">
                <UploadCloud size={16} />
                <span>{uploading ? 'Téléversement...' : 'Importer un visuel'}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={disableActions}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
                >
                  Retirer le média
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={disableActions}
              className="inline-flex items-center gap-2 rounded-full border border-orange-500/70 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Traitement...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
