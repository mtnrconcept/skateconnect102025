import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { X, UploadCloud, Trash2 } from 'lucide-react';
import { uploadFile } from '../../../lib/storage';
import { useSponsorContext } from '../../../contexts/SponsorContext';
import type { SponsorSpotlight } from '../../../types';

export interface SponsorSpotlightFormValues {
  title: string;
  description: string;
  callToAction: string;
  callToActionUrl: string;
  status: SponsorSpotlight['status'];
  startDate: string | null;
  endDate: string | null;
  mediaUrl: string | null;
}

interface SponsorSpotlightModalProps {
  mode: 'create' | 'edit';
  spotlight?: SponsorSpotlight | null;
  onClose: () => void;
  onSubmit: (values: SponsorSpotlightFormValues) => Promise<void>;
}

const statusOptions: Array<{ value: SponsorSpotlight['status']; label: string }> = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'scheduled', label: 'Programmé' },
  { value: 'active', label: 'Actif' },
  { value: 'completed', label: 'Terminé' },
];

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

export default function SponsorSpotlightModal({
  mode,
  spotlight,
  onClose,
  onSubmit,
}: SponsorSpotlightModalProps) {
  const { sponsorId } = useSponsorContext();
  const [form, setForm] = useState<SponsorSpotlightFormValues>(() => ({
    title: spotlight?.title ?? '',
    description: spotlight?.description ?? '',
    callToAction: spotlight?.call_to_action ?? '',
    callToActionUrl: spotlight?.call_to_action_url ?? '',
    status: spotlight?.status ?? 'draft',
    startDate: spotlight?.start_date ?? null,
    endDate: spotlight?.end_date ?? null,
    mediaUrl: spotlight?.media_url ?? null,
  }));
  const [startDateInput, setStartDateInput] = useState<string>(toDateTimeLocalInput(form.startDate));
  const [endDateInput, setEndDateInput] = useState<string>(toDateTimeLocalInput(form.endDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const modalTitle = useMemo(
    () => (mode === 'create' ? 'Nouveau Spotlight' : 'Modifier le Spotlight'),
    [mode],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const path = sponsorId ? `spotlights/${sponsorId}` : undefined;
      const { url } = await uploadFile('sponsors', file, path);
      setForm((current) => ({ ...current, mediaUrl: url }));
    } catch (cause) {
      console.error('Unable to upload spotlight media', cause);
      setUploadError("Échec du téléversement. Vérifie la taille du fichier ou réessaie plus tard.");
    } finally {
      setUploading(false);
      event.currentTarget.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (!form.title.trim()) {
      setError('Le titre du Spotlight est requis.');
      return;
    }

    if (form.startDate && form.endDate) {
      if (new Date(form.startDate) >= new Date(form.endDate)) {
        setError('La date de fin doit être postérieure à la date de début.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        callToAction: form.callToAction.trim(),
        callToActionUrl: form.callToActionUrl.trim(),
      });
      onClose();
    } catch (cause) {
      console.error('Unable to persist sponsor spotlight', cause);
      setError("Impossible d'enregistrer le Spotlight. Réessaie dans quelques instants.");
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
              Configure le message sponsorisé, la fenêtre de diffusion et le visuel mis en avant auprès des riders.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Titre du Spotlight
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value.slice(0, 140) }))
              }
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Activation pro team – Été"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value.slice(0, 600) }))
              }
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Détaille l'opération, les riders impliqués et les livrables attendus."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Texte CTA
              <input
                value={form.callToAction}
                onChange={(event) =>
                  setForm((current) => ({ ...current, callToAction: event.target.value.slice(0, 80) }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Rejoins la tournée"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              URL CTA
              <input
                type="url"
                value={form.callToActionUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, callToActionUrl: event.target.value.slice(0, 200) }))
                }
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="https://ton-site.com/landing"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Début de diffusion
              <input
                type="datetime-local"
                value={startDateInput}
                onChange={(event) => {
                  setStartDateInput(event.target.value);
                  setForm((current) => ({ ...current, startDate: toIsoFromLocalInput(event.target.value) }));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Fin de diffusion
              <input
                type="datetime-local"
                value={endDateInput}
                onChange={(event) => {
                  setEndDateInput(event.target.value);
                  setForm((current) => ({ ...current, endDate: toIsoFromLocalInput(event.target.value) }));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Statut
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as SponsorSpotlight['status'] }))
              }
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">Visuel / média</p>
              {form.mediaUrl && (
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mediaUrl: null }))}
                  className="inline-flex items-center gap-2 text-xs text-rose-300 hover:text-rose-200"
                >
                  <Trash2 size={14} /> Retirer
                </button>
              )}
            </div>
            {form.mediaUrl ? (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Un média est déjà associé à ce Spotlight.</p>
                <a
                  href={form.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200"
                >
                  Prévisualiser le média
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 text-sm text-slate-300">
                <p>Formats acceptés : images et vidéos (max. 50 Mo).</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white">
                  <UploadCloud size={16} />
                  <span>{uploading ? 'Téléversement...' : 'Choisir un fichier'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
                {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-full border border-sky-500/70 bg-sky-500/10 px-6 py-2 text-sm font-medium text-sky-100 hover:border-sky-400 hover:bg-sky-500/20 disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : mode === 'create' ? 'Créer le Spotlight' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
