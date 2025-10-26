import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MenuSquare,
  UserPlus,
  UserX,
} from 'lucide-react';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorOpportunityOwnerSummary,
  SponsorPlannerStatus,
} from '../../../types';
import {
  getSponsorOpportunityDate,
  SPONSOR_OPPORTUNITY_TYPE_LABELS,
} from '../../../lib/sponsorOpportunities';
import {
  SPONSOR_PLANNER_STATUS_META,
  SPONSOR_PLANNER_STATUS_ORDER,
} from './constants';

interface PlannerOpportunity {
  id: string;
  type: SponsorEditableOpportunityType;
  title: string;
  status: SponsorPlannerStatus;
  owner: SponsorOpportunityOwnerSummary | null | undefined;
  owner_id: string | null;
  description: string;
  date: Date | null;
  record:
    | SponsorChallengeOpportunity
    | SponsorEventOpportunity
    | SponsorCallOpportunity;
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  day: 'numeric',
});

const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type PlannerViewMode = 'board' | 'calendar';

type SponsorPlannerProps = {
  challenges: SponsorChallengeOpportunity[];
  events: SponsorEventOpportunity[];
  calls: SponsorCallOpportunity[];
  currentUserId?: string | null;
  onStatusChange?: (
    type: SponsorEditableOpportunityType,
    id: string,
    status: SponsorPlannerStatus,
  ) => Promise<void>;
  onOwnerChange?: (
    type: SponsorEditableOpportunityType,
    id: string,
    ownerId: string | null,
  ) => Promise<void>;
  readOnly?: boolean;
  loading?: boolean;
};

function getOpportunityDescription(opportunity: PlannerOpportunity): string {
  if (opportunity.type === 'challenge') {
    return opportunity.record.description;
  }
  if (opportunity.type === 'event') {
    return opportunity.record.description;
  }
  return opportunity.record.summary;
}

function getDateLabel(date: Date | null): string {
  if (!date) {
    return 'Non planifié';
  }
  return shortDateFormatter.format(date);
}

function formatRelative(date: Date | null): string | null {
  if (!date) return null;
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (targetDay.getTime() - startOfDay.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';
  if (diffDays > 1) return `Dans ${diffDays} jours`;
  return `Il y a ${Math.abs(diffDays)} jours`;
}

function buildCalendarDays(reference: Date) {
  const firstOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday as first day
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date,
      iso,
      inMonth: date.getMonth() === reference.getMonth(),
    };
  });
}

function PlannerEmptyState({ hasIdeas }: { hasIdeas: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-900/60 p-8 text-center text-slate-400">
      <MenuSquare className="mx-auto mb-4 h-10 w-10 text-slate-600" />
      <p className="text-lg font-semibold text-slate-100">
        {hasIdeas
          ? 'Aucune initiative n\'est planifiée pour l\'instant.'
          : 'Ajoute ta première initiative sponsor pour démarrer le planner.'}
      </p>
      <p className="mt-2 text-sm text-slate-400">
        Utilise le tableau Kanban pour suivre le cycle de vie des défis, événements et appels à projet.
      </p>
    </div>
  );
}

export default function SponsorPlanner({
  challenges,
  events,
  calls,
  currentUserId,
  onStatusChange,
  onOwnerChange,
  readOnly = false,
  loading = false,
}: SponsorPlannerProps) {
  const [viewMode, setViewMode] = useState<PlannerViewMode>('board');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const opportunities = useMemo<PlannerOpportunity[]>(
    () => [
      ...challenges.map((record) => ({
        id: record.id,
        type: 'challenge' as const,
        title: record.title,
        status: record.status,
        owner: record.owner,
        owner_id: record.owner_id,
        description: record.description,
        date: getSponsorOpportunityDate({ type: 'challenge', record }),
        record,
      })),
      ...events.map((record) => ({
        id: record.id,
        type: 'event' as const,
        title: record.title,
        status: record.status,
        owner: record.owner,
        owner_id: record.owner_id,
        description: record.description,
        date: getSponsorOpportunityDate({ type: 'event', record }),
        record,
      })),
      ...calls.map((record) => ({
        id: record.id,
        type: 'call' as const,
        title: record.title,
        status: record.status,
        owner: record.owner,
        owner_id: record.owner_id,
        description: record.summary,
        date: getSponsorOpportunityDate({ type: 'call', record }),
        record,
      })),
    ],
    [calls, challenges, events],
  );

  const opportunitiesByStatus = useMemo(
    () =>
      SPONSOR_PLANNER_STATUS_ORDER.map((status) => ({
        status,
        meta: SPONSOR_PLANNER_STATUS_META[status],
        items: opportunities.filter((item) => item.status === status),
      })),
    [opportunities],
  );

  const datedOpportunities = useMemo(() => {
    const map = new Map<string, PlannerOpportunity[]>();
    opportunities.forEach((opportunity) => {
      if (!opportunity.date) {
        return;
      }
      const key = opportunity.date.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(opportunity);
    });
    return map;
  }, [opportunities]);

  const undatedOpportunities = useMemo(
    () => opportunities.filter((opportunity) => !opportunity.date),
    [opportunities],
  );

  const hasOpportunities = opportunities.length > 0;

  const handleStatusChange = async (
    item: PlannerOpportunity,
    status: SponsorPlannerStatus,
  ) => {
    if (readOnly || !onStatusChange || status === item.status) {
      return;
    }

    const key = `${item.type}:${item.id}:status`;
    setPending((current) => ({ ...current, [key]: true }));

    try {
      await onStatusChange(item.type, item.id, status);
    } finally {
      setPending((current) => ({ ...current, [key]: false }));
    }
  };

  const handleAssign = async (item: PlannerOpportunity, ownerId: string | null) => {
    if (readOnly || !onOwnerChange) {
      return;
    }
    if (ownerId === item.owner_id) {
      return;
    }

    const key = `${item.type}:${item.id}:owner`;
    setPending((current) => ({ ...current, [key]: true }));
    try {
      await onOwnerChange(item.type, item.id, ownerId);
    } finally {
      setPending((current) => ({ ...current, [key]: false }));
    }
  };

  const boardContent = (
    <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {opportunitiesByStatus.map((column) => (
        <div
          key={column.status}
          className="flex h-full flex-col rounded-xl border border-slate-800/70 bg-slate-950/60"
        >
          <div className="border-b border-slate-800/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {column.meta.label}
                </p>
                <p className="text-[11px] text-slate-500">{column.meta.description}</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {column.items.length}
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {column.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800/70 p-4 text-center text-xs text-slate-500">
                Rien pour le moment
              </div>
            ) : (
              column.items.map((item) => {
                const statusKey = `${item.type}:${item.id}:status`;
                const ownerKey = `${item.type}:${item.id}:owner`;
                const dateLabel = getDateLabel(item.date);
                const relative = formatRelative(item.date);
                const statusPending = pending[statusKey];
                const ownerPending = pending[ownerKey];
                const ownerLabel = item.owner?.display_name ?? item.owner?.username ?? 'Non assigné';
                const canAssignSelf = !readOnly && !!currentUserId;

                return (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-lg border border-slate-800/80 bg-slate-900/70 p-4 shadow-sm shadow-slate-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {SPONSOR_OPPORTUNITY_TYPE_LABELS[item.type]}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <p className="font-medium text-slate-200">{dateLabel}</p>
                        {relative && <p>{relative}</p>}
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {getOpportunityDescription(item)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1 text-[11px] text-slate-300">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {dateLabel}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1 text-[11px] text-slate-300">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {SPONSOR_PLANNER_STATUS_META[item.status].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        <p className="font-medium text-slate-200">{ownerLabel}</p>
                        <p>Responsable</p>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-2 text-xs">
                          <label className="sr-only" htmlFor={`status-${item.id}`}>
                            Statut
                          </label>
                          <select
                            id={`status-${item.id}`}
                            className="rounded-md border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-200 focus:border-sky-500 focus:outline-none"
                            value={item.status}
                            disabled={statusPending}
                            onChange={(event) =>
                              void handleStatusChange(item, event.target.value as SponsorPlannerStatus)
                            }
                          >
                            {SPONSOR_PLANNER_STATUS_ORDER.map((status) => (
                              <option key={status} value={status}>
                                {SPONSOR_PLANNER_STATUS_META[status].label}
                              </option>
                            ))}
                          </select>
                          {canAssignSelf && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200 hover:border-sky-500 hover:text-sky-200"
                              onClick={() => void handleAssign(item, currentUserId)}
                              disabled={ownerPending || item.owner_id === currentUserId}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Moi
                            </button>
                          )}
                          {onOwnerChange && item.owner_id && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-rose-800/70 bg-rose-950/60 px-2 py-1 text-[11px] text-rose-200 hover:border-rose-600"
                              onClick={() => void handleAssign(item, null)}
                              disabled={ownerPending}
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Retirer
                            </button>
                          )}
                          {(statusPending || ownerPending) && (
                            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  const calendarContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold capitalize text-slate-100">
            {monthFormatter.format(currentMonth)}
          </p>
          <p className="text-sm text-slate-400">Vue calendrier des initiatives planifiées.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-slate-300 hover:border-sky-500 hover:text-sky-200"
            onClick={() =>
              setCurrentMonth((previous) =>
                new Date(previous.getFullYear(), previous.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-2 text-slate-300 hover:border-sky-500 hover:text-sky-200"
            onClick={() =>
              setCurrentMonth((previous) =>
                new Date(previous.getFullYear(), previous.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold uppercase text-slate-500">
            {day}
          </div>
        ))}
        {calendarDays.map(({ date, iso, inMonth }) => {
          const itemsForDay = datedOpportunities.get(iso) ?? [];
          const isToday = new Date().toISOString().slice(0, 10) === iso;
          return (
            <div
              key={iso}
              className={`min-h-[120px] rounded-lg border p-2 text-xs transition-colors ${
                inMonth
                  ? 'border-slate-800/70 bg-slate-950/60'
                  : 'border-slate-900/40 bg-slate-950/40 text-slate-600'
              } ${isToday ? 'border-sky-500/60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isToday ? 'text-sky-200' : 'text-slate-300'}`}>
                  {dayFormatter.format(date)}
                </span>
                {itemsForDay.length > 0 && (
                  <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">
                    {itemsForDay.length}
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {itemsForDay.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-800/60 bg-slate-900/70 px-2 py-1"
                  >
                    <p className="truncate text-[11px] font-medium text-slate-100">
                      {item.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {SPONSOR_OPPORTUNITY_TYPE_LABELS[item.type]} ·{' '}
                      {SPONSOR_PLANNER_STATUS_META[item.status].label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {undatedOpportunities.length > 0 && (
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-slate-200">Sans date</p>
          <p className="text-xs text-slate-500">
            Ces initiatives n'ont pas encore de date cible. Pense à les planifier.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {undatedOpportunities.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800/70 bg-slate-900/70 p-3">
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="text-[11px] text-slate-400">
                  {SPONSOR_OPPORTUNITY_TYPE_LABELS[item.type]} ·{' '}
                  {SPONSOR_PLANNER_STATUS_META[item.status].label}
                </p>
                <p className="mt-2 text-xs text-slate-400">{getOpportunityDescription(item)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Planner sponsors</h2>
          <p className="text-sm text-slate-400">
            Coordonne défis, événements et appels à projet dans une vue Kanban ou calendrier.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 p-1 text-xs text-slate-300">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-md px-3 py-1 transition ${
              viewMode === 'board' ? 'bg-slate-800/80 text-slate-100' : 'hover:text-sky-200'
            }`}
            onClick={() => setViewMode('board')}
          >
            <MenuSquare className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-md px-3 py-1 transition ${
              viewMode === 'calendar' ? 'bg-slate-800/80 text-slate-100' : 'hover:text-sky-200'
            }`}
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendrier
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-800/70 bg-slate-950/70 p-12 text-slate-300">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Chargement du planner...
        </div>
      ) : !hasOpportunities ? (
        <PlannerEmptyState hasIdeas={false} />
      ) : viewMode === 'board' ? (
        boardContent
      ) : (
        calendarContent
      )}
    </section>
  );
}
