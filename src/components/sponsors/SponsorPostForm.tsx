import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Calendar,
  Copy,
  FileText,
  FolderOpen,
  Hash,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  MapPin,
  RefreshCcw,
  Sparkles,
  Tag,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorTemplate,
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
import { listStorageFiles, uploadFile } from '../../lib/storage';
import type { StorageObjectInfo } from '../../lib/storage';
import {
  duplicateSponsorTemplate,
  ensureSponsorTemplateShareKey,
  importSponsorTemplate,
  listSponsorTemplates,
  rotateSponsorTemplateShareKey,
} from '../../lib/sponsorTemplates';

const parseTagsInput = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toTagInput = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string').join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
};

const toStringValue = (value: unknown, fallback: string = ''): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return fallback;
};

const toDateValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return formatDateInput(value);
  }

  return '';
};

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
  const [templates, setTemplates] = useState<SponsorTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [hasTemplatePersonalization, setHasTemplatePersonalization] = useState(false);
  const templateApplicationRef = useRef(false);
  const [shareKeyInput, setShareKeyInput] = useState('');
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [shareKeyLoading, setShareKeyLoading] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<StorageObjectInfo[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

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

  useEffect(() => {
    let isActive = true;
    setTemplatesLoading(true);
    setTemplateError(null);

    listSponsorTemplates(sponsorId)
      .then((items) => {
        if (!isActive) {
          return;
        }
        setTemplates(items);
      })
      .catch((cause) => {
        if (!isActive) {
          return;
        }
        console.error('Unable to load sponsor templates', cause);
        setTemplateError('Impossible de charger les templates sponsor pour le moment.');
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setTemplatesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [sponsorId]);

  useEffect(() => {
    if (!showAssetLibrary) {
      return;
    }

    let isActive = true;
    setLibraryLoading(true);
    setLibraryError(null);

    listStorageFiles('sponsors', { path: sponsorId })
      .then((items) => {
        if (!isActive) {
          return;
        }
        setLibraryAssets(items);
      })
      .catch((cause) => {
        if (!isActive) {
          return;
        }
        console.error('Unable to load sponsor asset library', cause);
        setLibraryError('Impossible de charger la médiathèque sponsor.');
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setLibraryLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [showAssetLibrary, sponsorId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [templates],
  );

  const markTemplatePersonalized = useCallback(() => {
    if (templateApplicationRef.current) {
      return;
    }

    if (selectedTemplateId) {
      setHasTemplatePersonalization(true);
    }
  }, [selectedTemplateId]);

  const updateChallengeValues = useCallback(
    (patch: Partial<typeof challengeValues>) => {
      setChallengeValues((current) => ({ ...current, ...patch }));
      markTemplatePersonalized();
    },
    [markTemplatePersonalized],
  );

  const updateEventValues = useCallback(
    (patch: Partial<typeof eventValues>) => {
      setEventValues((current) => ({ ...current, ...patch }));
      markTemplatePersonalized();
    },
    [markTemplatePersonalized],
  );

  const updateCallValues = useCallback(
    (patch: Partial<typeof callValues>) => {
      setCallValues((current) => ({ ...current, ...patch }));
      markTemplatePersonalized();
    },
    [markTemplatePersonalized],
  );

  const upsertTemplate = useCallback((template: SponsorTemplate) => {
    setTemplates((current) => {
      const filtered = current.filter((item) => item.id !== template.id);
      const next = [template, ...filtered];
      return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });
  }, []);

  const applyTemplate = useCallback(
    (template: SponsorTemplate) => {
      templateApplicationRef.current = true;
      setTemplateError(null);

      if (canChangeType) {
        setActiveType(template.type);
      }

      const defaults = (template.default_fields ?? {}) as Record<string, unknown>;
      const fallbackCover =
        template.assets.find((asset) => asset.type === 'image' || asset.type === 'video')?.url ?? '';

      if (template.type === 'challenge') {
        setChallengeValues({
          title: toStringValue(defaults.title),
          description: toStringValue(defaults.description),
          prize: toStringValue(defaults.prize),
          value: toStringValue(defaults.value),
          location: toStringValue(defaults.location),
          startDate: toDateValue(defaults.start_date),
          endDate: toDateValue(defaults.end_date),
          actionLabel: toStringValue(defaults.action_label, DEFAULT_CHALLENGE_CTA),
          participantsLabel: toStringValue(defaults.participants_label, DEFAULT_CHALLENGE_LABEL),
          coverImageUrl: toStringValue(defaults.cover_image_url, fallbackCover),
          tags: toTagInput(defaults.tags),
        });
      } else if (template.type === 'event') {
        setEventValues({
          title: toStringValue(defaults.title),
          description: toStringValue(defaults.description),
          location: toStringValue(defaults.location),
          eventDate: toDateValue(defaults.event_date),
          eventTime: toStringValue(defaults.event_time),
          eventType: toStringValue(defaults.event_type),
          attendees: toStringValue(defaults.attendees, '0'),
          actionLabel: toStringValue(defaults.action_label, DEFAULT_EVENT_CTA),
          coverImageUrl: toStringValue(defaults.cover_image_url, fallbackCover),
          tags: toTagInput(defaults.tags),
        });
      } else {
        setCallValues({
          title: toStringValue(defaults.title),
          summary: toStringValue(defaults.summary),
          description: toStringValue(defaults.description),
          location: toStringValue(defaults.location),
          deadline: toDateValue(defaults.deadline),
          reward: toStringValue(defaults.reward),
          highlight: toStringValue(defaults.highlight),
          participantsLabel: toStringValue(defaults.participants_label, DEFAULT_CALL_LABEL),
          participantsCount: toStringValue(defaults.participants_count, '0'),
          actionLabel: toStringValue(defaults.action_label, DEFAULT_CALL_CTA),
          coverImageUrl: toStringValue(defaults.cover_image_url, fallbackCover),
          tags: toTagInput(defaults.tags),
        });
      }

      setSelectedTemplateId(template.id);
      setHasTemplatePersonalization(false);

      setTimeout(() => {
        templateApplicationRef.current = false;
      }, 0);
    },
    [canChangeType],
  );

  const handleTemplateSelection = useCallback(
    (value: string | null) => {
      if (!value) {
        setTemplateError(null);
        setSelectedTemplateId(null);
        setHasTemplatePersonalization(false);
        return;
      }

      const template = templates.find((item) => item.id === value);
      if (!template) {
        return;
      }

      if (!canChangeType && template.type !== activeType) {
        setTemplateError("Ce template ne correspond pas au type actuel de l'opportunité.");
        return;
      }

      applyTemplate(template);
    },
    [activeType, applyTemplate, canChangeType, templates],
  );

  const handleDuplicateTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      return;
    }

    const defaultName = `${selectedTemplate.name} (copie)`;
    const name = window.prompt('Nom du nouveau template sponsor', defaultName);
    if (!name) {
      return;
    }

    setTemplateError(null);
    setTemplateActionLoading(true);

    try {
      const record = await duplicateSponsorTemplate({
        templateId: selectedTemplate.id,
        sponsorId,
        name,
      });

      upsertTemplate(record);
      setSelectedTemplateId(record.id);
      setHasTemplatePersonalization(false);
    } catch (cause) {
      console.error('Unable to duplicate sponsor template', cause);
      setTemplateError('Impossible de dupliquer ce template pour le moment.');
    } finally {
      setTemplateActionLoading(false);
    }
  }, [selectedTemplate, sponsorId, upsertTemplate]);

  const handleImportTemplate = useCallback(async () => {
    const key = shareKeyInput.trim();
    if (!key) {
      setTemplateError('Renseigne une clé de partage à importer.');
      return;
    }

    setTemplateError(null);
    setImportingTemplate(true);

    try {
      const record = await importSponsorTemplate({
        shareKey: key,
        sponsorId,
      });

      upsertTemplate(record);
      setSelectedTemplateId(record.id);
      setHasTemplatePersonalization(false);
      setShareKeyInput('');
    } catch (cause) {
      console.error('Unable to import sponsor template', cause);
      setTemplateError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Impossible d'importer ce template pour le moment.",
      );
    } finally {
      setImportingTemplate(false);
    }
  }, [shareKeyInput, sponsorId, upsertTemplate]);

  const handleCopyShareKey = useCallback(async (shareKey: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareKey);
      }
    } catch (cause) {
      console.error('Unable to copy sponsor template share key', cause);
    }
  }, []);

  const handleEnsureShareKey = useCallback(async () => {
    if (!selectedTemplate) {
      return;
    }

    setTemplateError(null);
    setShareKeyLoading(true);

    try {
      const shareKey = await ensureSponsorTemplateShareKey(selectedTemplate.id);
      const updatedTemplate: SponsorTemplate = {
        ...selectedTemplate,
        share_key: shareKey,
        updated_at: new Date().toISOString(),
      };
      upsertTemplate(updatedTemplate);
      await handleCopyShareKey(shareKey);
    } catch (cause) {
      console.error('Unable to generate sponsor template share key', cause);
      setTemplateError("Impossible de générer une clé de partage pour ce template.");
    } finally {
      setShareKeyLoading(false);
    }
  }, [handleCopyShareKey, selectedTemplate, upsertTemplate]);

  const handleRotateShareKey = useCallback(async () => {
    if (!selectedTemplate) {
      return;
    }

    setTemplateError(null);
    setShareKeyLoading(true);

    try {
      const shareKey = await rotateSponsorTemplateShareKey(selectedTemplate.id);
      const updatedTemplate: SponsorTemplate = {
        ...selectedTemplate,
        share_key: shareKey,
        updated_at: new Date().toISOString(),
      };
      upsertTemplate(updatedTemplate);
      await handleCopyShareKey(shareKey);
    } catch (cause) {
      console.error('Unable to rotate sponsor template share key', cause);
      setTemplateError('Impossible de régénérer la clé de partage pour ce template.');
    } finally {
      setShareKeyLoading(false);
    }
  }, [handleCopyShareKey, selectedTemplate, upsertTemplate]);

  const handleRefreshTemplates = useCallback(async () => {
    setTemplateError(null);
    setTemplateActionLoading(true);
    setTemplatesLoading(true);

    try {
      const items = await listSponsorTemplates(sponsorId);
      setTemplates(items);
    } catch (cause) {
      console.error('Unable to refresh sponsor templates', cause);
      setTemplateError('Impossible de mettre à jour la liste des templates.');
    } finally {
      setTemplateActionLoading(false);
      setTemplatesLoading(false);
    }
  }, [sponsorId]);

  const handleSelectAsset = useCallback(
    (asset: StorageObjectInfo) => {
      setShowAssetLibrary(false);

      if (activeType === 'challenge') {
        setChallengeValues((current) => ({ ...current, coverImageUrl: asset.url }));
      } else if (activeType === 'event') {
        setEventValues((current) => ({ ...current, coverImageUrl: asset.url }));
      } else {
        setCallValues((current) => ({ ...current, coverImageUrl: asset.url }));
      }

      if (selectedTemplateId) {
        setHasTemplatePersonalization(true);
      }
    },
    [activeType, selectedTemplateId],
  );

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

      if (selectedTemplateId) {
        setHasTemplatePersonalization(true);
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

      <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-300">
              <Layers size={16} />
              <span>Templates sponsor</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Pré-remplis ton opportunité avec un template ou importe une base partagée par un autre sponsor.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTemplateId ?? ''}
              onChange={(event) => handleTemplateSelection(event.target.value || null)}
              disabled={templatesLoading || templateActionLoading}
              className="min-w-[220px] rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {templatesLoading ? 'Chargement des templates...' : 'Sans template (saisie libre)'}
              </option>
              {sortedTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ·
                  {` ${template.type === 'challenge' ? 'Défi' : template.type === 'event' ? 'Événement' : 'Appel à projet'}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRefreshTemplates}
              disabled={templatesLoading || templateActionLoading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-dark-700 text-gray-300 hover:border-orange-400 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {templatesLoading || templateActionLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
            </button>
          </div>
        </div>

        {templateError && <p className="text-xs text-red-400">{templateError}</p>}

        {selectedTemplate && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dark-700 bg-dark-800/60 p-3 text-xs text-gray-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1 text-orange-200">
              <Sparkles size={14} /> {selectedTemplate.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1 capitalize text-gray-200">
              {selectedTemplate.type === 'challenge' ? 'Défi' : selectedTemplate.type === 'event' ? 'Événement' : 'Appel à projet'}
            </span>
            {hasTemplatePersonalization ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-orange-300">
                <Wand2 size={14} /> Personnalisé
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1 text-gray-400">
                <Sparkles size={14} /> Valeurs du template
              </span>
            )}
            {selectedTemplate.share_key && (
              <button
                type="button"
                onClick={() => {
                  void handleCopyShareKey(selectedTemplate.share_key as string);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-dark-600 px-3 py-1 text-gray-200 hover:border-orange-400"
              >
                <Copy size={14} /> {selectedTemplate.share_key}
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDuplicateTemplate}
                disabled={templateActionLoading}
                className="inline-flex items-center gap-2 rounded-full border border-dark-600 px-3 py-1 text-gray-200 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {templateActionLoading ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />} Dupliquer
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={shareKeyInput}
              onChange={(event) => setShareKeyInput(event.target.value)}
              placeholder="Clé de partage (tmpl_...)"
              className="w-full rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={handleImportTemplate}
              disabled={importingTemplate || !shareKeyInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importingTemplate ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} Importer
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEnsureShareKey}
              disabled={!selectedTemplate || shareKeyLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-dark-700 px-3 py-2 text-xs font-medium text-gray-200 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {shareKeyLoading ? <Loader2 className="animate-spin" size={14} /> : <Link2 size={14} />}
              {selectedTemplate?.share_key ? 'Afficher la clé' : 'Générer une clé'}
            </button>
            {selectedTemplate?.share_key && (
              <button
                type="button"
                onClick={handleRotateShareKey}
                disabled={shareKeyLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-dark-700 px-3 py-2 text-xs font-medium text-gray-200 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shareKeyLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />} Nouvelle clé
              </button>
            )}
          </div>
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
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={(event) => (event.currentTarget.parentElement?.previousElementSibling as HTMLInputElement).click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-full border border-orange-400 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
              <button
                type="button"
                onClick={() => setShowAssetLibrary(true)}
                disabled={libraryLoading}
                className="inline-flex items-center gap-2 rounded-full border border-dark-600 px-4 py-2 text-sm font-medium text-gray-200 hover:border-orange-400 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {libraryLoading ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16} />} Médiathèque
              </button>
            </div>
          </div>
        </label>

        <label className="block text-sm text-gray-300">
          <span className="font-semibold text-white">Ou URL de couverture</span>
          <input
            type="url"
            value={coverPreview}
            onChange={(event) => {
              if (activeType === 'challenge') {
                updateChallengeValues({ coverImageUrl: event.target.value });
              } else if (activeType === 'event') {
                updateEventValues({ coverImageUrl: event.target.value });
              } else {
                updateCallValues({ coverImageUrl: event.target.value });
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
              onChange={(event) => updateChallengeValues({ title: event.target.value })}
              placeholder="Signature Line - Switch Hardflip"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description</span>
            <textarea
              value={challengeValues.description}
              onChange={(event) => updateChallengeValues({ description: event.target.value })}
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
                onChange={(event) => updateChallengeValues({ prize: event.target.value })}
                placeholder="Budget vidéo de 800€ + pack complet"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Mise en avant</span>
              <input
                type="text"
                value={challengeValues.value}
                onChange={(event) => updateChallengeValues({ value: event.target.value })}
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
                onChange={(event) => updateChallengeValues({ location: event.target.value })}
                placeholder="Square Diderot, Paris"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Début</span>
              <input
                type="date"
                value={challengeValues.startDate}
                onChange={(event) => updateChallengeValues({ startDate: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Fin</span>
              <input
                type="date"
                value={challengeValues.endDate}
                onChange={(event) => updateChallengeValues({ endDate: event.target.value })}
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
                onChange={(event) => updateChallengeValues({ participantsLabel: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={challengeValues.actionLabel}
                onChange={(event) => updateChallengeValues({ actionLabel: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-2"><Tag size={14} /> Tags</span>
            <input
              type="text"
              value={challengeValues.tags}
              onChange={(event) => updateChallengeValues({ tags: event.target.value })}
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
              onChange={(event) => updateEventValues({ title: event.target.value })}
              placeholder="Session scouting privée"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description</span>
            <textarea
              value={eventValues.description}
              onChange={(event) => updateEventValues({ description: event.target.value })}
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
                onChange={(event) => updateEventValues({ location: event.target.value })}
                placeholder="Hangar Darwin, Bordeaux"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Date</span>
              <input
                type="date"
                value={eventValues.eventDate}
                onChange={(event) => updateEventValues({ eventDate: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Horaire</span>
              <input
                type="text"
                value={eventValues.eventTime}
                onChange={(event) => updateEventValues({ eventTime: event.target.value })}
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
                onChange={(event) => updateEventValues({ eventType: event.target.value })}
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
                onChange={(event) => updateEventValues({ attendees: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={eventValues.actionLabel}
                onChange={(event) => updateEventValues({ actionLabel: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-2"><Hash size={14} /> Tags</span>
            <input
              type="text"
              value={eventValues.tags}
              onChange={(event) => updateEventValues({ tags: event.target.value })}
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
              onChange={(event) => updateCallValues({ title: event.target.value })}
              placeholder="Fond de soutien #BuildYourSpot"
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Accroche</span>
            <input
              type="text"
              value={callValues.summary}
              onChange={(event) => updateCallValues({ summary: event.target.value })}
              placeholder="Les sponsors financent trois crews..."
              className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </label>

          <label className="block text-sm text-gray-300">
            <span className="font-semibold text-white">Description détaillée</span>
            <textarea
              value={callValues.description}
              onChange={(event) => updateCallValues({ description: event.target.value })}
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
                onChange={(event) => updateCallValues({ location: event.target.value })}
                placeholder="Plateforme Shredloc"
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white flex items-center gap-2"><Calendar size={14} /> Clôture</span>
              <input
                type="date"
                value={callValues.deadline}
                onChange={(event) => updateCallValues({ deadline: event.target.value })}
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
                onChange={(event) => updateCallValues({ reward: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Mise en avant</span>
              <input
                type="text"
                value={callValues.highlight}
                onChange={(event) => updateCallValues({ highlight: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">Tags</span>
              <input
                type="text"
                value={callValues.tags}
              onChange={(event) => updateCallValues({ tags: event.target.value })}
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
                  updateCallValues({ participantsLabel: event.target.value })
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
                onChange={(event) => updateCallValues({ participantsCount: event.target.value })}
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </label>
            <label className="block text-sm text-gray-300">
              <span className="font-semibold text-white">CTA</span>
              <input
                type="text"
                value={callValues.actionLabel}
                onChange={(event) => updateCallValues({ actionLabel: event.target.value })}
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

      {showAssetLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
          <div className="relative w-full max-w-4xl rounded-3xl border border-dark-700 bg-dark-900 p-6">
            <button
              type="button"
              onClick={() => setShowAssetLibrary(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-dark-700 text-gray-300 hover:border-orange-400 hover:text-orange-200"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-300">
              <FolderOpen size={18} /> Médiathèque sponsor
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Sélectionne un visuel existant (logos, vidéos, couvertures) depuis le stockage Supabase.
            </p>
            {libraryError && <p className="mt-4 text-sm text-red-400">{libraryError}</p>}
            <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {libraryLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-orange-300" size={24} />
                </div>
              ) : libraryAssets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-dark-700 bg-dark-800/60 p-6 text-center text-sm text-gray-400">
                  Aucun média trouvé dans votre dossier sponsor. Téléverse des assets pour les réutiliser ici.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {libraryAssets.map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className="group overflow-hidden rounded-2xl border border-dark-700 bg-dark-800 text-left transition hover:border-orange-400"
                    >
                      {asset.type === 'image' ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : asset.type === 'video' ? (
                        <video src={asset.url} className="h-40 w-full object-cover" muted loop playsInline />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center bg-dark-900 text-gray-400">
                          <FileText size={28} />
                        </div>
                      )}
                      <div className="space-y-1 px-4 py-3 text-xs text-gray-300">
                        <p className="font-medium text-gray-100">{asset.name}</p>
                        {asset.size && <p>{Math.round(asset.size / 1024)} Ko</p>}
                        {asset.updated_at && (
                          <p className="text-[10px] uppercase tracking-wide text-gray-500">
                            MAJ {new Date(asset.updated_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
