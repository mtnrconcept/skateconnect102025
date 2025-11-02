import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  MapPin,
  PenSquare,
  Plus,
  RefreshCw,
  Tag as TagIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useSponsorContext } from '../../../contexts/SponsorContext';
import SponsorPostForm from '../SponsorPostForm';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorOpportunityRecord,
} from '../../../types';
import {
  SPONSOR_OPPORTUNITY_DATE_FILTERS,
  SPONSOR_OPPORTUNITY_STATUS_META,
  SPONSOR_OPPORTUNITY_STATUS_ORDER,
  SPONSOR_OPPORTUNITY_TYPE_FILTERS,
  SPONSOR_OPPORTUNITY_TYPE_LABELS,
  getSponsorOpportunityDate,
  getSponsorOpportunityStatus,
  matchesOpportunityDateFilter,
  toOpportunityRecords,
  type SponsorOpportunityDateFilter,
  type SponsorOpportunityStatus,
} from '../../../lib/sponsorOpportunities';

const boardStatuses = SPONSOR_OPPORTUNITY_STATUS_ORDER.filter((status) => status !== 'published');

const STATUS_FILTER_OPTIONS: Array<{ value: SponsorOpportunityStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  ...boardStatuses.map((status) => ({
    value: status,
    label: SPONSOR_OPPORTUNITY_STATUS_META[status].label,
  })),
];

const TYPE_FILTER_OPTIONS = SPONSOR_OPPORTUNITY_TYPE_FILTERS.filter(
  (filter) => filter.value === 'all' || filter.value !== 'news',
);

const formatRelativeDate = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
  }

  if (diffDays > 0) {
    return diffDays === 1 ? 'Dans 1 jour' : `Dans ${diffDays} jours`;
  }

  const absDays = Math.abs(diffDays);
  return absDays === 1 ? 'Il y a 1 jour' : `Il y a ${absDays} jours`;
};

const formatDateLabel = (record: SponsorOpportunityRecord): string => {
  const formatter = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
        })
      : null;

  switch (record.type) {
    case 'challenge':
      return record.record.end_date
        ? `Clôture ${formatter(record.record.end_date)}`
        : 'Défi en cours';
    case 'event':
      return record.record.event_date
        ? `${formatter(record.record.event_date)}${
            record.record.event_time ? ` · ${record.record.event_time}` : ''
          }`
        : 'Date à confirmer';
    case 'call':
      return record.record.deadline
        ? `Clôture ${formatter(record.record.deadline)}`
        : 'Candidatures en continu';
    case 'news':
    default:
      return record.record.published_at
        ? `Publié le ${formatter(record.record.published_at)}`
        : 'Annonce sponsor';
  }
};

const getSponsorDisplayName = (
  record: SponsorOpportunityRecord,
): string => {
  const sponsor = record.record.sponsor;
  if (!sponsor) {
    return 'Sponsor partenaire';
  }
  return (
    sponsor.sponsor_branding?.brand_name ??
    sponsor.display_name ??
    sponsor.username ??
    'Sponsor partenaire'
  );
};

const getOpportunityDescription = (record: SponsorOpportunityRecord): string => {
  switch (record.type) {
    case 'challenge':
      return record.record.description;
    case 'event':
      return record.record.description;
    case 'call':
      return record.record.summary || record.record.description;
    case 'news':
    default:
      return record.record.summary;
  }
};

const getOpportunityLocation = (record: SponsorOpportunityRecord): string => {
  switch (record.type) {
    case 'challenge':
      return record.record.location ?? 'Lieu à définir';
    case 'event':
      return record.record.location ?? 'Lieu à définir';
    case 'call':
      return record.record.location ?? 'En ligne';
    case 'news':
    default:
      return record.record.location ?? 'Annonce';
  }
};

const getParticipantsLabel = (record: SponsorOpportunityRecord): string => {
  switch (record.type) {
    case 'challenge':
      return record.record.participants_label || 'Crews inscrites';
    case 'event':
      return 'Participants';
    case 'call':
      return record.record.participants_label || 'Candidatures';
    case 'news':
    default:
      return record.record.participants_label || 'Audience';
  }
};

const getParticipantsCount = (record: SponsorOpportunityRecord): number => {
  switch (record.type) {
    case 'challenge':
      return record.record.participants_count;
    case 'event':
      return record.record.attendees;
    case 'call':
      return record.record.participants_count ?? 0;
    case 'news':
    default:
      return record.record.participants_count ?? 0;
  }
};

interface FlattenedOpportunity {
  record: SponsorOpportunityRecord;
  status: SponsorOpportunityStatus;
  date: Date | null;
}

type ViewMode = 'kanban' | 'list';

type FormState =
  | { mode: 'create'; type: SponsorEditableOpportunityType }
  | { mode: 'edit'; type: 'challenge'; record: SponsorChallengeOpportunity }
  | { mode: 'edit'; type: 'event'; record: SponsorEventOpportunity }
  | { mode: 'edit'; type: 'call'; record: SponsorCallOpportunity }
  | null;

export default function SponsorOpportunitiesView() {
  const {
    permissions,
    sponsorId,
    opportunities,
    refreshOpportunities,
    upsertOpportunity,
    deleteOpportunity,
  } = useSponsorContext();
  const canManageOpportunities = permissions.canManageOpportunities;
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<SponsorOpportunityRecord['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SponsorOpportunityStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<SponsorOpportunityDateFilter>('all');
  const [formState, setFormState] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const rawRecords = useMemo(
    () =>
      canManageOpportunities
        ? toOpportunityRecords(opportunities, { includeNews: false })
        : [],
    [canManageOpportunities, opportunities],
  );

  const flattened = useMemo<FlattenedOpportunity[]>(
    () =>
      rawRecords
        .filter((record) => record.type !== 'news')
        .map((record) => ({
          record,
          status: getSponsorOpportunityStatus(record),
          date: getSponsorOpportunityDate(record),
        })),
    [rawRecords],
  );

  const filteredItems = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const now = new Date();

    return flattened.filter(({ record, status, date }) => {
      if (typeFilter !== 'all' && record.type !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (!matchesOpportunityDateFilter(date, dateFilter, now)) {
        return false;
      }

      if (lowerSearch.length > 0) {
        const haystack = [
          record.record.title,
          getOpportunityDescription(record),
          getSponsorDisplayName(record),
          getOpportunityLocation(record),
          ...(Array.isArray(record.record.tags) ? record.record.tags : []),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(lowerSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilter, flattened, searchTerm, statusFilter, typeFilter]);

  const statusBuckets = useMemo(
    () =>
      boardStatuses.map((status) => ({
        status,
        meta: SPONSOR_OPPORTUNITY_STATUS_META[status],
        items: filteredItems.filter((item) => item.status === status),
      })),
    [filteredItems],
  );

  useEffect(() => {
    if (!canManageOpportunities) {
      setFormState(null);
      setDeletingId(null);
      setSearchTerm('');
      setTypeFilter('all');
      setStatusFilter('all');
      setDateFilter('all');
      setViewMode('kanban');
    }
  }, [canManageOpportunities]);

  const totalOpportunities = filteredItems.length;

  const handleCreate = () => {
    setFormState({ mode: 'create', type: 'challenge' });
  };

  const handleEdit = (record: SponsorOpportunityRecord) => {
    if (record.type === 'challenge') {
      setFormState({ mode: 'edit', type: 'challenge', record: record.record });
    } else if (record.type === 'event') {
      setFormState({ mode: 'edit', type: 'event', record: record.record });
    } else if (record.type === 'call') {
      setFormState({ mode: 'edit', type: 'call', record: record.record });
    }
  };

  const handleSaved = (
    type: SponsorEditableOpportunityType,
    record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
  ) => {
    upsertOpportunity(type, record);
    setFormState(null);
  };

  const handleDeleted = async (type: SponsorEditableOpportunityType, id: string) => {
    setDeletingId(id);
    try {
      await deleteOpportunity(type, id);
      setFormState(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManageOpportunities) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-orange-500/40 bg-orange-950/30 p-6 text-orange-100">
          Ta marque n'a pas encore accès à la gestion des opportunités sponsor. Contacte ton
          chargé de compte pour activer le module.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Pilotage campagne</p>
          <h2 className="text-2xl font-semibold text-white mt-1">Opportunités sponsor</h2>
          <p className="text-sm text-slate-400 mt-1">
            Gérez vos défis, événements et appels à projets en harmonie avec la section publique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshOpportunities()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
          >
            <RefreshCw size={16} /> Rafraîchir
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!sponsorId}
            className="inline-flex items-center gap-2 rounded-full border border-orange-500/60 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> Nouvelle opportunité
          </button>
          <div className="inline-flex rounded-full border border-slate-700/60 p-1 bg-slate-900/40">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                viewMode === 'kanban'
                  ? 'bg-slate-800 text-orange-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-orange-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Liste
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Recherche titre, sponsor, localisation, tag..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {totalOpportunities} opportunité{totalOpportunities > 1 ? 's' : ''} affichée{totalOpportunities > 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {TYPE_FILTER_OPTIONS.map((filterItem) => {
            const isActive = typeFilter === filterItem.value;
            return (
              <button
                key={filterItem.value}
                type="button"
                onClick={() => setTypeFilter(filterItem.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-orange-500 text-white border-orange-400'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                {filterItem.label}
              </button>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as SponsorOpportunityStatus | 'all')}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as SponsorOpportunityDateFilter)}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            >
              {SPONSOR_OPPORTUNITY_DATE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setDateFilter('all');
                }}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {viewMode === 'kanban' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusBuckets.map((column) => (
            <div
              key={column.status}
              className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    {column.meta.label}
                  </p>
                  <p className="text-sm text-slate-400">
                    {column.items.length} opportunité{column.items.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {column.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-500 text-center">
                  Aucune opportunité pour ce statut.
                </div>
              ) : (
                column.items.map(({ record, status, date }) => {
                  const statusMeta = SPONSOR_OPPORTUNITY_STATUS_META[status];
                  const typeLabel = SPONSOR_OPPORTUNITY_TYPE_LABELS[record.type];
                  const sponsorName = getSponsorDisplayName(record);
                  const dateLabel = formatDateLabel(record);
                  const relativeDate = formatRelativeDate(date);
                  const participantsLabel = getParticipantsLabel(record);
                  const participantsCount = getParticipantsCount(record);
                  const tags = Array.isArray(record.record.tags) ? record.record.tags : [];

                  return (
                    <article
                      key={record.record.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                              {typeLabel}
                            </span>
                          </div>
                          <p className="text-xs uppercase tracking-widest text-slate-400">{sponsorName}</p>
                          <h3 className="text-base font-semibold text-white">{record.record.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(record)}
                            className="rounded-full border border-slate-700/60 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
                          >
                            <PenSquare size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Supprimer cette opportunité ?')) {
                                return;
                              }
                              void handleDeleted(record.type as SponsorEditableOpportunityType, record.record.id);
                            }}
                            disabled={deletingId === record.record.id}
                            className="rounded-full border border-slate-700/60 p-2 text-slate-300 hover:border-orange-500 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {getOpportunityDescription(record)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} className="text-orange-400" />
                          {dateLabel}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} className="text-orange-400" />
                          {getOpportunityLocation(record)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={14} className="text-orange-400" />
                          {participantsLabel}: {participantsCount}
                        </span>
                        {relativeDate && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={14} className="text-orange-400" />
                            {relativeDate}
                          </span>
                        )}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300"
                            >
                              <TagIcon size={14} className="text-orange-400" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titre</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="px-4 py-3 text-left font-semibold">Sponsor</th>
                <th className="px-4 py-3 text-left font-semibold">Dates</th>
                <th className="px-4 py-3 text-left font-semibold">Participants</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    Aucune opportunité ne correspond à vos filtres.
                  </td>
                </tr>
              ) : (
                filteredItems.map(({ record, status, date }) => {
                  const statusMeta = SPONSOR_OPPORTUNITY_STATUS_META[status];
                  const typeLabel = SPONSOR_OPPORTUNITY_TYPE_LABELS[record.type];
                  const sponsorName = getSponsorDisplayName(record);
                  const dateLabel = formatDateLabel(record);
                  const relativeDate = formatRelativeDate(date);
                  const participantsLabel = getParticipantsLabel(record);
                  const participantsCount = getParticipantsCount(record);

                  return (
                    <tr key={record.record.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{record.record.title}</div>
                        <div className="text-xs text-slate-400">{getOpportunityDescription(record)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{typeLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{sponsorName}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <div>{dateLabel}</div>
                        {relativeDate && <div className="text-xs text-slate-500">{relativeDate}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {participantsLabel}
                        <div className="text-xs text-slate-500">{participantsCount}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(record)}
                            className="rounded-full border border-slate-700/60 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
                          >
                            <PenSquare size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Supprimer cette opportunité ?')) {
                                return;
                              }
                              void handleDeleted(record.type as SponsorEditableOpportunityType, record.record.id);
                            }}
                            disabled={deletingId === record.record.id}
                            className="rounded-full border border-slate-700/60 p-2 text-slate-300 hover:border-orange-500 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {formState && sponsorId && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {formState.mode === 'create' ? 'Nouvelle opportunité' : 'Modifier une opportunité'}
            </h3>
            <button
              type="button"
              onClick={() => setFormState(null)}
              className="rounded-full border border-slate-700/60 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <SponsorPostForm
            sponsorId={sponsorId}
            mode={formState.mode}
            initial={formState.mode === 'edit' ? formState : undefined}
            onCancel={() => setFormState(null)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        </div>
      )}
    </div>
  );
}
