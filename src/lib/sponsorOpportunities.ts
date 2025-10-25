import type { PostgrestError } from '@supabase/supabase-js';
import { withTableFallback } from './postgrest.js';
import { supabase } from './supabase.js';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorNewsItem,
  SponsorOpportunityRecord,
  SponsorOpportunityType,
  SponsorProfileSummary,
} from '../types';

export type SponsorOpportunityStatus =
  | 'upcoming'
  | 'active'
  | 'closing-soon'
  | 'completed'
  | 'published';

export type SponsorOpportunityDateFilter = 'all' | 'soon' | 'month' | 'past';

export interface SponsorOpportunityCollections {
  challenges: SponsorChallengeOpportunity[];
  events: SponsorEventOpportunity[];
  calls: SponsorCallOpportunity[];
  news: SponsorNewsItem[];
}

export interface FetchSponsorOpportunitiesOptions {
  sponsorId?: string | null;
  includeNews?: boolean;
}

interface FetchSponsorEntityOptions {
  sponsorId?: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const SPONSOR_OPPORTUNITY_TYPE_LABELS: Record<SponsorOpportunityType, string> = {
  challenge: 'Défi',
  event: 'Événement',
  call: 'Appel à projet',
  news: 'Actualité',
};

export const SPONSOR_OPPORTUNITY_TYPE_FILTERS: Array<{
  value: SponsorOpportunityType | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Tout' },
  { value: 'challenge', label: 'Défis' },
  { value: 'event', label: 'Événements' },
  { value: 'call', label: 'Appels à projet' },
  { value: 'news', label: 'Actu sponsors' },
];

export const SPONSOR_OPPORTUNITY_DATE_FILTERS: Array<{
  value: SponsorOpportunityDateFilter;
  label: string;
}> = [
  { value: 'all', label: 'Toutes les dates' },
  { value: 'soon', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois-ci' },
  { value: 'past', label: 'Événements passés' },
];

export const SPONSOR_OPPORTUNITY_STATUS_ORDER: SponsorOpportunityStatus[] = [
  'upcoming',
  'active',
  'closing-soon',
  'completed',
  'published',
];

export const SPONSOR_OPPORTUNITY_STATUS_META: Record<
  SponsorOpportunityStatus,
  { label: string; description?: string; badgeClass: string }
> = {
  upcoming: {
    label: 'À venir',
    description: 'Le programme démarre bientôt.',
    badgeClass: 'bg-sky-900/60 text-sky-100 border border-sky-500/40',
  },
  active: {
    label: 'Actif',
    description: 'Opportunité ouverte aux riders.',
    badgeClass: 'bg-emerald-900/70 text-emerald-100 border border-emerald-500/50',
  },
  'closing-soon': {
    label: 'Clôture imminente',
    description: 'Moins de 7 jours restants.',
    badgeClass: 'bg-amber-900/70 text-amber-100 border border-amber-500/50',
  },
  completed: {
    label: 'Terminé',
    description: 'Opportunité clôturée.',
    badgeClass: 'bg-slate-900/70 text-slate-200 border border-slate-600/70',
  },
  published: {
    label: 'Publié',
    description: 'Annonce sponsor visible publiquement.',
    badgeClass: 'bg-indigo-900/70 text-indigo-100 border border-indigo-500/40',
  },
};

export const emptySponsorOpportunityCollections = (): SponsorOpportunityCollections => ({
  challenges: [],
  events: [],
  calls: [],
  news: [],
});

export const matchesOpportunityDateFilter = (
  date: Date | null,
  filter: SponsorOpportunityDateFilter,
  referenceDate: Date = new Date(),
): boolean => {
  if (!date || filter === 'all') {
    return true;
  }

  const diff = date.getTime() - referenceDate.getTime();

  switch (filter) {
    case 'soon':
      return diff >= 0 && diff <= SEVEN_DAYS_MS;
    case 'month':
      return diff >= 0 && diff <= THIRTY_DAYS_MS;
    case 'past':
      return diff < 0;
    default:
      return true;
  }
};

const sponsorProfileSelection = 'id, username, display_name, sponsor_branding';

type RawSponsorRow = Record<string, unknown>;

const normaliseTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string');
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const mapSponsorProfile = (row: { sponsor?: SponsorProfileSummary | null }): SponsorProfileSummary | null => {
  if (!row?.sponsor) {
    return null;
  }

  return {
    id: row.sponsor.id,
    username: row.sponsor.username,
    display_name: row.sponsor.display_name,
    sponsor_branding: row.sponsor.sponsor_branding ?? null,
  };
};

const mapSponsorChallenge = (row: RawSponsorRow): SponsorChallengeOpportunity => ({
  id: row.id as string,
  sponsor_id: row.sponsor_id as string,
  title: row.title as string,
  description: row.description as string,
  prize: (row.prize as string | null | undefined) ?? null,
  value: (row.value as string | null | undefined) ?? null,
  location: (row.location as string | null | undefined) ?? null,
  cover_image_url: (row.cover_image_url as string | null | undefined) ?? null,
  tags: normaliseTags(row.tags),
  start_date: (row.start_date as string | null | undefined) ?? null,
  end_date: (row.end_date as string | null | undefined) ?? null,
  participants_count: typeof row.participants_count === 'number' ? (row.participants_count as number) : 0,
  participants_label: (row.participants_label as string | undefined) ?? 'Crews inscrites',
  action_label: (row.action_label as string | undefined) ?? 'Voir le défi',
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
  sponsor: mapSponsorProfile(row as { sponsor?: SponsorProfileSummary | null }),
});

const mapSponsorEvent = (row: RawSponsorRow): SponsorEventOpportunity => ({
  id: row.id as string,
  sponsor_id: row.sponsor_id as string,
  title: row.title as string,
  description: row.description as string,
  event_date: (row.event_date as string | null | undefined) ?? null,
  event_time: (row.event_time as string | null | undefined) ?? null,
  location: (row.location as string | null | undefined) ?? null,
  event_type: (row.event_type as string | null | undefined) ?? null,
  attendees: typeof row.attendees === 'number' ? (row.attendees as number) : 0,
  cover_image_url: (row.cover_image_url as string | null | undefined) ?? null,
  tags: normaliseTags(row.tags),
  action_label: (row.action_label as string | undefined) ?? 'Réserver',
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
  sponsor: mapSponsorProfile(row as { sponsor?: SponsorProfileSummary | null }),
});

const mapSponsorCall = (row: RawSponsorRow): SponsorCallOpportunity => ({
  id: row.id as string,
  sponsor_id: row.sponsor_id as string,
  title: row.title as string,
  summary: row.summary as string,
  description: row.description as string,
  location: (row.location as string | null | undefined) ?? null,
  deadline: (row.deadline as string | null | undefined) ?? null,
  reward: (row.reward as string | null | undefined) ?? null,
  highlight: (row.highlight as string | null | undefined) ?? null,
  cover_image_url: (row.cover_image_url as string | null | undefined) ?? null,
  tags: normaliseTags(row.tags),
  participants_label: (row.participants_label as string | undefined) ?? 'Candidatures',
  participants_count: typeof row.participants_count === 'number' ? (row.participants_count as number) : 0,
  action_label: (row.action_label as string | undefined) ?? 'Déposer un projet',
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
  sponsor: mapSponsorProfile(row as { sponsor?: SponsorProfileSummary | null }),
});

const mapSponsorNews = (row: RawSponsorRow): SponsorNewsItem => ({
  id: row.id as string,
  sponsor_id: row.sponsor_id as string,
  title: row.title as string,
  summary: row.summary as string,
  body: row.body as string,
  location: (row.location as string | null | undefined) ?? null,
  published_at: (row.published_at as string | null | undefined) ?? null,
  highlight: (row.highlight as string | null | undefined) ?? null,
  cover_image_url: (row.cover_image_url as string | null | undefined) ?? null,
  tags: normaliseTags(row.tags),
  action_label: (row.action_label as string | undefined) ?? 'En savoir plus',
  participants_label: (row.participants_label as string | undefined) ?? 'Lecteurs',
  participants_count: typeof row.participants_count === 'number' ? (row.participants_count as number) : 0,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
  sponsor: mapSponsorProfile(row as { sponsor?: SponsorProfileSummary | null }),
});

export const mapSponsorOpportunityToRecord = (
  row: RawSponsorRow,
  type: SponsorOpportunityRecord['type'],
): SponsorOpportunityRecord => {
  switch (type) {
    case 'challenge':
      return { type, record: mapSponsorChallenge(row) };
    case 'event':
      return { type, record: mapSponsorEvent(row) };
    case 'call':
      return { type, record: mapSponsorCall(row) };
    case 'news':
    default:
      return { type: 'news', record: mapSponsorNews(row) };
  }
};

const getRangeStatus = (
  start: Date | null,
  end: Date | null,
  referenceDate: Date,
): SponsorOpportunityStatus => {
  if (start && start.getTime() > referenceDate.getTime()) {
    return 'upcoming';
  }

  if (!end) {
    return 'active';
  }

  const diff = end.getTime() - referenceDate.getTime();

  if (diff < 0) {
    return 'completed';
  }

  if (diff <= SEVEN_DAYS_MS) {
    return 'closing-soon';
  }

  return 'active';
};

export const getSponsorOpportunityDate = (
  opportunity: SponsorOpportunityRecord,
): Date | null => {
  switch (opportunity.type) {
    case 'challenge':
      return parseDate(opportunity.record.end_date ?? opportunity.record.start_date);
    case 'event':
      return parseDate(opportunity.record.event_date);
    case 'call':
      return parseDate(opportunity.record.deadline);
    case 'news':
      return parseDate(opportunity.record.published_at ?? opportunity.record.created_at);
    default:
      return null;
  }
};

export const getSponsorOpportunityStatus = (
  opportunity: SponsorOpportunityRecord,
  referenceDate: Date = new Date(),
): SponsorOpportunityStatus => {
  switch (opportunity.type) {
    case 'challenge': {
      const { start_date: startDate, end_date: endDate } = opportunity.record;
      return getRangeStatus(parseDate(startDate), parseDate(endDate), referenceDate);
    }
    case 'event': {
      const eventDate = parseDate(opportunity.record.event_date);
      return getRangeStatus(eventDate, eventDate, referenceDate);
    }
    case 'call': {
      const deadline = parseDate(opportunity.record.deadline);
      if (!deadline) {
        return 'active';
      }
      const diff = deadline.getTime() - referenceDate.getTime();
      if (diff < 0) {
        return 'completed';
      }
      if (diff <= SEVEN_DAYS_MS) {
        return 'closing-soon';
      }
      return 'active';
    }
    case 'news':
    default:
      return 'published';
  }
};

export const toOpportunityRecords = (
  collections: SponsorOpportunityCollections,
  options: { includeNews?: boolean } = {},
): SponsorOpportunityRecord[] => {
  const includeNews = options.includeNews ?? true;

  const records: SponsorOpportunityRecord[] = [
    ...collections.challenges.map((record) => ({ type: 'challenge', record })),
    ...collections.events.map((record) => ({ type: 'event', record })),
    ...collections.calls.map((record) => ({ type: 'call', record })),
  ];

  if (includeNews) {
    records.push(...collections.news.map((record) => ({ type: 'news', record })));
  }

  return records;
};

function logMissingTable(table: string, error: PostgrestError) {
  const hint = error.hint ? ` hint=${error.hint}` : '';
  console.info(
    `[sponsorOpportunities] ${table} table is missing (PGRST205). Returning an empty list.${hint}`,
  );
}

async function fetchWithSponsorFallback<T>(
  table: string,
  request: PromiseLike<{ data: T; error: PostgrestError | null }>,
  fallback: () => Promise<T> | T,
): Promise<T> {
  return withTableFallback(request, fallback, {
    onMissing: (error) => logMissingTable(table, error),
  });
}

export interface CreateSponsorChallengePayload {
  sponsor_id: string;
  title: string;
  description: string;
  prize?: string | null;
  value?: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  tags?: string[];
  start_date?: string | null;
  end_date?: string | null;
  participants_label?: string;
  action_label?: string;
}

export type UpdateSponsorChallengePayload = Omit<CreateSponsorChallengePayload, 'sponsor_id'>;

export interface CreateSponsorEventPayload {
  sponsor_id: string;
  title: string;
  description: string;
  event_date?: string | null;
  event_time?: string | null;
  location?: string | null;
  event_type?: string | null;
  attendees?: number;
  cover_image_url?: string | null;
  tags?: string[];
  action_label?: string;
}

export type UpdateSponsorEventPayload = Omit<CreateSponsorEventPayload, 'sponsor_id'>;

export interface CreateSponsorCallPayload {
  sponsor_id: string;
  title: string;
  summary: string;
  description: string;
  location?: string | null;
  deadline?: string | null;
  reward?: string | null;
  highlight?: string | null;
  cover_image_url?: string | null;
  tags?: string[];
  participants_label?: string;
  participants_count?: number;
  action_label?: string;
}

export type UpdateSponsorCallPayload = Omit<CreateSponsorCallPayload, 'sponsor_id'>;

const withDefaultTags = <T extends { tags?: string[] }>(payload: T): T => ({
  ...payload,
  tags: payload.tags ?? [],
});

export async function fetchSponsorChallenges(
  options: FetchSponsorEntityOptions = {},
): Promise<SponsorChallengeOpportunity[]> {
  const { sponsorId } = options;
  const rows = await fetchWithSponsorFallback<RawSponsorRow[] | null>(
    'sponsor_challenges',
    (() => {
      const query = supabase
        .from('sponsor_challenges')
        .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
        .order('end_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (sponsorId) {
        query.eq('sponsor_id', sponsorId);
      }

      return query;
    })(),
    () => [] as RawSponsorRow[],
  );

  return (rows ?? []).map(mapSponsorChallenge);
}

export async function fetchSponsorEvents(
  options: FetchSponsorEntityOptions = {},
): Promise<SponsorEventOpportunity[]> {
  const { sponsorId } = options;
  const rows = await fetchWithSponsorFallback<RawSponsorRow[] | null>(
    'sponsor_events',
    (() => {
      const query = supabase
        .from('sponsor_events')
        .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (sponsorId) {
        query.eq('sponsor_id', sponsorId);
      }

      return query;
    })(),
    () => [] as RawSponsorRow[],
  );

  return (rows ?? []).map(mapSponsorEvent);
}

export async function fetchSponsorCalls(
  options: FetchSponsorEntityOptions = {},
): Promise<SponsorCallOpportunity[]> {
  const { sponsorId } = options;
  const rows = await fetchWithSponsorFallback<RawSponsorRow[] | null>(
    'sponsor_calls',
    (() => {
      const query = supabase
        .from('sponsor_calls')
        .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (sponsorId) {
        query.eq('sponsor_id', sponsorId);
      }

      return query;
    })(),
    () => [] as RawSponsorRow[],
  );

  return (rows ?? []).map(mapSponsorCall);
}

export async function fetchSponsorNews(
  options: FetchSponsorEntityOptions = {},
): Promise<SponsorNewsItem[]> {
  const { sponsorId } = options;
  const rows = await fetchWithSponsorFallback<RawSponsorRow[] | null>(
    'sponsor_news',
    (() => {
      const query = supabase
        .from('sponsor_news')
        .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
        .order('published_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });

      if (sponsorId) {
        query.eq('sponsor_id', sponsorId);
      }

      return query;
    })(),
    () => [] as RawSponsorRow[],
  );

  return (rows ?? []).map(mapSponsorNews);
}

export async function fetchSponsorOpportunityCollections(
  options: FetchSponsorOpportunitiesOptions = {},
): Promise<SponsorOpportunityCollections> {
  const { sponsorId, includeNews = true } = options;

  const [challenges, events, calls, news] = await Promise.all([
    fetchSponsorChallenges({ sponsorId }),
    fetchSponsorEvents({ sponsorId }),
    fetchSponsorCalls({ sponsorId }),
    includeNews ? fetchSponsorNews({ sponsorId }) : Promise.resolve<SponsorNewsItem[]>([]),
  ]);

  return {
    challenges,
    events,
    calls,
    news,
  };
}

export async function createSponsorChallenge(
  payload: CreateSponsorChallengePayload,
): Promise<SponsorChallengeOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_challenges')
    .insert(withDefaultTags(payload))
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorChallenge(data);
}

export async function updateSponsorChallenge(
  id: string,
  payload: UpdateSponsorChallengePayload,
): Promise<SponsorChallengeOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_challenges')
    .update(withDefaultTags(payload))
    .eq('id', id)
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorChallenge(data);
}

export async function deleteSponsorChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_challenges').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function createSponsorEvent(payload: CreateSponsorEventPayload): Promise<SponsorEventOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_events')
    .insert(withDefaultTags(payload))
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorEvent(data);
}

export async function updateSponsorEvent(
  id: string,
  payload: UpdateSponsorEventPayload,
): Promise<SponsorEventOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_events')
    .update(withDefaultTags(payload))
    .eq('id', id)
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorEvent(data);
}

export async function deleteSponsorEvent(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_events').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function createSponsorCall(payload: CreateSponsorCallPayload): Promise<SponsorCallOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_calls')
    .insert(withDefaultTags(payload))
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorCall(data);
}

export async function updateSponsorCall(
  id: string,
  payload: UpdateSponsorCallPayload,
): Promise<SponsorCallOpportunity> {
  const { data, error } = await supabase
    .from('sponsor_calls')
    .update(withDefaultTags(payload))
    .eq('id', id)
    .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
    .single();

  if (error) {
    throw error;
  }

  return mapSponsorCall(data);
}

export async function deleteSponsorCall(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_calls').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export const isEditableSponsorOpportunity = (
  record: SponsorOpportunityRecord,
): record is Extract<SponsorOpportunityRecord, { type: SponsorEditableOpportunityType }> =>
  record.type === 'challenge' || record.type === 'event' || record.type === 'call';
