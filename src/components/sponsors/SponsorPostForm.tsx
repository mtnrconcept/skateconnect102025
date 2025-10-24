import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Calendar, FileText, Hash, Image as ImageIcon, Loader2, MapPin, Tag, UploadCloud } from 'lucide-react';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
} from '../../types';
import {
  createSponsorCall,
  createSponsorChallenge,
  createSponsorEvent,
  type CreateSponsorCallPayload,
  type CreateSponsorChallengePayload,
  type CreateSponsorEventPayload,
  updateSponsorCall,
  updateSponsorChallenge,
  updateSponsorEvent,
} from '../../lib/sponsorOpportunities';
import { uploadFile } from '../../lib/storage';

const parseTagsInput = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toIsoDateTime = (value: string): string | null => {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00Z`).toISOString();
};

const toNumber = (value: string): number => {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateInput = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (value.length >= 10) {
    return value.slice(0, 10);
  }

  return value;
};

const DEFAULT_CHALLENGE_LABEL = 'Crews inscrites';
const DEFAULT_EVENT_CTA = 'Réserver';
const DEFAULT_CHALLENGE_CTA = 'Voir le défi';
const DEFAULT_CALL_CTA = 'Déposer un projet';
const DEFAULT_CALL_LABEL = 'Candidatures';

interface SponsorPostFormProps {
  sponsorId: string;
  mode: 'create' | 'edit';
  initial?:
    | { type: 'challenge'; data: SponsorChallengeOpportunity }
    | { type: 'event'; data: SponsorEventOpportunity }
    | { type: 'call'; data: SponsorCallOpportunity };
  onCancel: () => void;
  onSaved: (
    type: SponsorEditableOpportunityType,
    record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
  ) => void;
  onDeleted?: (type: SponsorEditableOpportunityType, id: string) => Promise<void> | void;
}

export default function SponsorPostForm({ sponsorId, mode, initial, onCancel, onSaved, onDeleted }: SponsorPostFormProps) {
  const initialType = initial?.type ?? 'challenge';
  const [activeType, setActiveType] = useState<SponsorEditableOpportunityType>(initialType);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [challengeValues, setChallengeValues] = useState({
    title: initial?.type === 'challenge' ? initial.data.title : '',
    description: initial?.type === 'challenge' ? initial.data.description : '',
    prize: initial?.type === 'challenge' ? initial.data.prize ?? '' : '',
    value: initial?.type === 'challenge' ? initial.data.value ?? '' : '',
    location: initial?.type === 'challenge' ? initial.data.location ?? '' : '',
    startDate: initial?.type === 'challenge' ? formatDateInput(initial.data.start_date) : '',
    endDate: initial?.type === 'challenge' ? formatDateInput(initial.data.end_date) : '',
    actionLabel: initial?.type === 'challenge' ? initial.data.action_label : DEFAULT_CHALLENGE_CTA,
    participantsLabel: initial?.type === 'challenge' ? initial.data.participants_label : DEFAULT_CHALLENGE_LABEL,
    coverImageUrl: initial?.type === 'challenge' ? initial.data.cover_image_url ?? '' : '',
    tags: initial?.type === 'challenge' ? (initial.data.tags ?? []).join(', ') : '',
  });

  const [eventValues, setEventValues] = useState({
    title: initial?.type === 'event' ? initial.data.title : '',
    description: initial?.type === 'event' ? initial.data.description : '',
    location: initial?.type === 'event' ? initial.data.location ?? '' : '',
    eventDate: initial?.type === 'event' ? formatDateInput(initial.data.event_date) : '',
    eventTime: initial?.type === 'event' ? initial.data.event_time ?? '' : '',
    eventType: initial?.type === 'event' ? initial.data.event_type ?? '' : '',
    attendees: initial?.type === 'event' ? String(initial.data.attendees ?? 0) : '0',
    actionLabel: initial?.type === 'event' ? initial.data.action_label : DEFAULT_EVENT_CTA,
    coverImageUrl: initial?.type === 'event' ? initial.data.cover_image_url ?? '' : '',
    tags: initial?.type === 'event' ? (initial.data.tags ?? []).join(', ') : '',
  });

  const [callValues, setCallValues] = useState({
    title: initial?.type === 'call' ? initial.data.title : '',
    summary: initial?.type === 'call' ? initial.data.summary : '',
    description: initial?.type === 'call' ? initial.data.description : '',
    location: initial?.type === 'call' ? initial.data.location ?? '' : '',
    deadline: initial?.type === 'call' ? formatDateInput(initial.data.deadline) : '',
    reward: initial?.type === 'call' ? initial.data.reward ?? '' : '',
    highlight: initial?.type === 'call' ? initial.data.highlight ?? '' : '',
    participantsLabel: initial?.type === 'call' ? initial.data.participants_label : DEFAULT_CALL_LABEL,
    participantsCount: initial?.type === 'call' ? String(initial.data.participants_count ?? 0) : '0',
    actionLabel: initial?.type === 'call' ? initial.data.action_label : DEFAULT_CALL_CTA,
    coverImageUrl: initial?.type === 'call' ? initial.data.cover_image_url ?? '' : '',
    tags: initial?.type === 'call' ? (initial.data.tags ?? []).join(', ') : '',
  });

  const canChangeType = mode === 'create';

  const coverPreview = useMemo(() => {
    if (activeType === 'challenge') {
      return challengeValues.coverImageUrl;
    }

    if (activeType === 'event') {
      return eventValues.coverImageUrl;
    }

    return callValues.coverImageUrl;
  }, [activeType, challengeValues.coverImageUrl, eventValues.coverImageUrl, callValues.coverImageUrl]);

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    setUploading(true);
    setError(null);

    try {
      const { url } = await uploadFile('sponsors', file, sponsorId);

      if (activeType === 'challenge') {
        setChallengeValues((current) => ({ ...current, coverImageUrl: url }));
      } else if (activeType === 'event') {
        setEventValues((current) => ({ ...current, coverImageUrl: url }));
      } else {
        setCallValues((current) => ({ ...current, coverImageUrl: url }));
      }
    } catch (cause) {
      console.error('Unable to upload sponsor media', cause);
      setError("Impossible de téléverser le média. Réessaie plus tard.");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (activeType === 'challenge') {
        if (!challengeValues.title.trim() || !challengeValues.description.trim()) {
          setError('Le titre et la description du défi sont obligatoires.');
          setSubmitting(false);
          return;
        }

        const payload: CreateSponsorChallengePayload = {
          sponsor_id: sponsorId,
          title: challengeValues.title.trim(),
          description: challengeValues.description.trim(),
          prize: challengeValues.prize.trim() || null,
          value: challengeValues.value.trim() || null,
          location: challengeValues.location.trim() || null,
          cover_image_url: challengeValues.coverImageUrl || null,
          tags: parseTagsInput(challengeValues.tags),
          start_date: toIsoDateTime(challengeValues.startDate),
          end_date: toIsoDateTime(challengeValues.endDate),
          participants_label: challengeValues.participantsLabel.trim() || DEFAULT_CHALLENGE_LABEL,
          action_label: challengeValues.actionLabel.trim() || DEFAULT_CHALLENGE_CTA,
        };

        const record =
          mode === 'create'
            ? await createSponsorChallenge(payload)
            : await updateSponsorChallenge((initial as { type: 'challenge'; data: SponsorChallengeOpportunity }).data.id, payload);

        onSaved('challenge', record);
      } else if (activeType === 'event') {
        if (!eventValues.title.trim() || !eventValues.description.trim()) {
          setError("Le titre et la description de l'événement sont obligatoires.");
          setSubmitting(false);
          return;
        }

        const payload: CreateSponsorEventPayload = {
          sponsor_id: sponsorId,
          title: eventValues.title.trim(),
          description: eventValues.description.trim(),
          event_date: eventValues.eventDate || null,
          event_time: eventValues.eventTime.trim() || null,
          location: eventValues.location.trim() || null,
          event_type: eventValues.eventType.trim() || null,
          attendees: toNumber(eventValues.attendees),
          cover_image_url: eventValues.coverImageUrl || null,
          tags: parseTagsInput(eventValues.tags),
          action_label: eventValues.actionLabel.trim() || DEFAULT_EVENT_CTA,
        };

        const record =
          mode === 'create'
            ? await createSponsorEvent(payload)
            : await updateSponsorEvent((initial as { type: 'event'; data: SponsorEventOpportunity }).data.id, payload);

        onSaved('event', record);
      } else {
        if (!callValues.title.trim() || !callValues.summary.trim() || !callValues.description.trim()) {
          setError("Le titre, l'accroche et la description de l'appel à projet sont obligatoires.");
          setSubmitting(false);
          return;
        }

        const payload: CreateSponsorCallPayload = {
          sponsor_id: sponsorId,
          title: callValues.title.trim(),
          summary: callValues.summary.trim(),
          description: callValues.description.trim(),
          location: callValues.location.trim() || null,
          deadline: callValues.deadline || null,
          reward: callValues.reward.trim() || null,
          highlight: callValues.highlight.trim() || null,
          cover_image_url: callValues.coverImageUrl || null,
          tags: parseTagsInput(callValues.tags),
          participants_label: callValues.participantsLabel.trim() || DEFAULT_CALL_LABEL,
          participants_count: toNumber(callValues.participantsCount),
          action_label: callValues.actionLabel.trim() || DEFAULT_CALL_CTA,
        };

        const record =
          mode === 'create'
            ? await createSponsorCall(payload)
            : await updateSponsorCall((initial as { type: 'call'; data: SponsorCallOpportunity }).data.id, payload);

        onSaved('call', record);
      }
    } catch (cause) {
      console.error('Unable to save sponsor opportunity', cause);
      setError("Impossible d'enregistrer. Vérifie ta connexion ou réessaie plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initial || !onDeleted) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onDeleted(initial.type, initial.data.id);
    } catch (cause) {
      console.error('Unable to delete sponsor opportunity', cause);
      setError("Suppression impossible pour le moment.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-orange-300">
          <FileText size={16} />
          <span>{mode === 'create' ? 'Nouvelle opportunité sponsor' : 'Modifier une opportunité'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {(['challenge', 'event', 'call'] as SponsorEditableOpportunityType[]).map((type) => {
            const isActive = activeType === type;
            return (
              <button
                key={type}
                type="button"
                disabled={!canChangeType}
                onClick={() => canChangeType && setActiveType(type)}
                className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-dark-800 text-gray-300 border-dark-700 hover:border-orange-400'
                } ${canChangeType ? '' : 'opacity-70 cursor-not-allowed'}`}
              >
                {type === 'challenge' ? 'Défi' : type === 'event' ? 'Événement' : 'Appel à projet'}
              </button>
            );
          })}
        </div>
      </div>

      {coverPreview && (
        <div className="overflow-hidden rounded-2xl border border-dark-700">
          <img src={coverPreview} alt="Visuel de couverture" className="h-48 w-full object-cover" />
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-sm text-gray-300">
          <span className="font-semibold text-white">Importer une couverture</span>
          <div className="mt-2 flex flex-col gap-3 rounded-2xl border-2 border-dashed border-dark-700 p-6 text-center">
            <UploadCloud className="mx-auto text-orange-400" size={28} />
            <p className="text-xs text-gray-400">Formats JPG, PNG ou MP4 jusqu'à 50MB</p>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleCoverUpload}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={(event) => (event.currentTarget.previousElementSibling as HTMLInputElement).click()}
              disabled={uploading}
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-orange-400 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Téléversement...
                </>
              ) : (
                <>
                  <ImageIcon size={16} /> Ajouter un média
                </>
              )}
            </button>
          </div>
        </label>

        <label className="block text-sm text-gray-300">
          <span className="font-semibold text-white">Ou URL de couverture</span>
          <input
            type="url"
            value={coverPreview}
            onChange={(event) => {
              if (activeType === 'challenge') {
                setChallengeValues((current) => ({ ...current, coverImageUrl: event.target.value }));
              } else if (activeType === 'event') {
                setEventValues((current) => ({ ...current, coverImageUrl: event.target.value }));
              } else {
                setCallValues((current) => ({ ...current, coverImageUrl: event.target.value }));
              }
            }}
            placeholder="https://..."
            className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </label>
      </div>

      {activeType === 'challenge' && (
        <div className="space-y-4">
          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Titre du défi</span>
            <input
              type="text"
              value={challengeValues.title}
              onChange={(event) => setChallengeValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="Signature Line - Switch Hardflip"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description</span>
            <textarea
              value={challengeValues.description}
              onChange={(event) => setChallengeValues((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Récompense</span>
              <input
                type="text"
                value={challengeValues.prize}
                onChange={(event) => setChallengeValues((current) => ({ ...current, prize: event.target.value }))}
                placeholder="Budget vidéo de 800€ + pack complet"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Mise en avant</span>
              <input
                type="text"
                value={challengeValues.value}
                onChange={(event) => setChallengeValues((current) => ({ ...current, value: event.target.value }))}
                placeholder="Production & visibilité"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><MapPin size={14} /> Localisation</span>
              <input
                type="text"
                value={challengeValues.location}
                onChange={(event) => setChallengeValues((current) => ({ ...current, location: event.target.value }))}
                placeholder="Square Diderot, Paris"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Début</span>
              <input
                type="date"
                value={challengeValues.startDate}
                onChange={(event) => setChallengeValues((current) => ({ ...current, startDate: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Fin</span>
              <input
                type="date"
                value={challengeValues.endDate}
                onChange={(event) => setChallengeValues((current) => ({ ...current, endDate: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Libellé participants</span>
              <input
                type="text"
                value={challengeValues.participantsLabel}
                onChange={(event) =>
                  setChallengeValues((current) => ({ ...current, participantsLabel: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={challengeValues.actionLabel}
                onChange={(event) => setChallengeValues((current) => ({ ...current, actionLabel: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-2"><Tag size={14} /> Tags</span>
            <input
              type="text"
              value={challengeValues.tags}
              onChange={(event) => setChallengeValues((current) => ({ ...current, tags: event.target.value }))}
              placeholder="Street, Video part, Technique"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
        </div>
      )}

      {activeType === 'event' && (
        <div className="space-y-4">
          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Titre de l'événement</span>
            <input
              type="text"
              value={eventValues.title}
              onChange={(event) => setEventValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="Session scouting privée"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description</span>
            <textarea
              value={eventValues.description}
              onChange={(event) => setEventValues((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><MapPin size={14} /> Lieu</span>
              <input
                type="text"
                value={eventValues.location}
                onChange={(event) => setEventValues((current) => ({ ...current, location: event.target.value }))}
                placeholder="Hangar Darwin, Bordeaux"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Date</span>
              <input
                type="date"
                value={eventValues.eventDate}
                onChange={(event) => setEventValues((current) => ({ ...current, eventDate: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Horaire</span>
              <input
                type="text"
                value={eventValues.eventTime}
                onChange={(event) => setEventValues((current) => ({ ...current, eventTime: event.target.value }))}
                placeholder="18h30"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Type d'événement</span>
              <input
                type="text"
                value={eventValues.eventType}
                onChange={(event) => setEventValues((current) => ({ ...current, eventType: event.target.value }))}
                placeholder="Networking"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Places disponibles</span>
              <input
                type="number"
                min={0}
                value={eventValues.attendees}
                onChange={(event) => setEventValues((current) => ({ ...current, attendees: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={eventValues.actionLabel}
                onChange={(event) => setEventValues((current) => ({ ...current, actionLabel: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-2"><Hash size={14} /> Tags</span>
            <input
              type="text"
              value={eventValues.tags}
              onChange={(event) => setEventValues((current) => ({ ...current, tags: event.target.value }))}
              placeholder="Sponsor, Networking"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>
        </div>
      )}

      {activeType === 'call' && (
        <div className="space-y-4">
          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Titre</span>
            <input
              type="text"
              value={callValues.title}
              onChange={(event) => setCallValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="Fond de soutien #BuildYourSpot"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Accroche</span>
            <input
              type="text"
              value={callValues.summary}
              onChange={(event) => setCallValues((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Les sponsors financent trois crews..."
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description détaillée</span>
            <textarea
              value={callValues.description}
              onChange={(event) => setCallValues((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><MapPin size={14} /> Localisation</span>
              <input
                type="text"
                value={callValues.location}
                onChange={(event) => setCallValues((current) => ({ ...current, location: event.target.value }))}
                placeholder="Plateforme Shredloc"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Clôture</span>
              <input
                type="date"
                value={callValues.deadline}
                onChange={(event) => setCallValues((current) => ({ ...current, deadline: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Récompense</span>
              <input
                type="text"
                value={callValues.reward}
                onChange={(event) => setCallValues((current) => ({ ...current, reward: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Mise en avant</span>
              <input
                type="text"
                value={callValues.highlight}
                onChange={(event) => setCallValues((current) => ({ ...current, highlight: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Tags</span>
              <input
                type="text"
                value={callValues.tags}
                onChange={(event) => setCallValues((current) => ({ ...current, tags: event.target.value }))}
                placeholder="DIY, Financement"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Libellé participants</span>
              <input
                type="text"
                value={callValues.participantsLabel}
                onChange={(event) =>
                  setCallValues((current) => ({ ...current, participantsLabel: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Nombre de dossiers</span>
              <input
                type="number"
                min={0}
                value={callValues.participantsCount}
                onChange={(event) => setCallValues((current) => ({ ...current, participantsCount: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={callValues.actionLabel}
                onChange={(event) => setCallValues((current) => ({ ...current, actionLabel: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-dark-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-orange-400"
        >
          Annuler
        </button>
        <div className="flex items-center gap-3">
          {mode === 'edit' && onDeleted && initial && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="rounded-full border border-rose-500/60 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Supprimer
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || uploading}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
            {submitting ? 'Enregistrement...' : mode === 'create' ? 'Publier' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </form>
  );
}
