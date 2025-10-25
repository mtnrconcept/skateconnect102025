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
  SponsorProfileSummary,
} from '../types';

const sponsorProfileSelection = 'id, username, display_name, sponsor_branding';

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

const mapSponsorChallenge = (row: any): SponsorChallengeOpportunity => ({
  id: row.id,
  sponsor_id: row.sponsor_id,
  title: row.title,
  description: row.description,
  prize: row.prize ?? null,
  value: row.value ?? null,
  location: row.location ?? null,
  cover_image_url: row.cover_image_url ?? null,
  tags: normaliseTags(row.tags),
  start_date: row.start_date ?? null,
  end_date: row.end_date ?? null,
  participants_count: typeof row.participants_count === 'number' ? row.participants_count : 0,
  participants_label: row.participants_label ?? 'Crews inscrites',
  action_label: row.action_label ?? 'Voir le défi',
  created_at: row.created_at,
  updated_at: row.updated_at,
  sponsor: mapSponsorProfile(row),
});

const mapSponsorEvent = (row: any): SponsorEventOpportunity => ({
  id: row.id,
  sponsor_id: row.sponsor_id,
  title: row.title,
  description: row.description,
  event_date: row.event_date ?? null,
  event_time: row.event_time ?? null,
  location: row.location ?? null,
  event_type: row.event_type ?? null,
  attendees: typeof row.attendees === 'number' ? row.attendees : 0,
  cover_image_url: row.cover_image_url ?? null,
  tags: normaliseTags(row.tags),
  action_label: row.action_label ?? 'Réserver',
  created_at: row.created_at,
  updated_at: row.updated_at,
  sponsor: mapSponsorProfile(row),
});

const mapSponsorCall = (row: any): SponsorCallOpportunity => ({
  id: row.id,
  sponsor_id: row.sponsor_id,
  title: row.title,
  summary: row.summary,
  description: row.description,
  location: row.location ?? null,
  deadline: row.deadline ?? null,
  reward: row.reward ?? null,
  highlight: row.highlight ?? null,
  cover_image_url: row.cover_image_url ?? null,
  tags: normaliseTags(row.tags),
  participants_label: row.participants_label ?? 'Candidatures',
  participants_count: typeof row.participants_count === 'number' ? row.participants_count : 0,
  action_label: row.action_label ?? 'Déposer un projet',
  created_at: row.created_at,
  updated_at: row.updated_at,
  sponsor: mapSponsorProfile(row),
});

const mapSponsorNews = (row: any): SponsorNewsItem => ({
  id: row.id,
  sponsor_id: row.sponsor_id,
  title: row.title,
  summary: row.summary,
  body: row.body,
  location: row.location ?? null,
  published_at: row.published_at ?? null,
  highlight: row.highlight ?? null,
  cover_image_url: row.cover_image_url ?? null,
  tags: normaliseTags(row.tags),
  action_label: row.action_label ?? 'En savoir plus',
  participants_label: row.participants_label ?? 'Lecteurs',
  participants_count: typeof row.participants_count === 'number' ? row.participants_count : 0,
  created_at: row.created_at,
  updated_at: row.updated_at,
  sponsor: mapSponsorProfile(row),
});

export const mapSponsorOpportunityToRecord = (row: any, type: SponsorOpportunityRecord['type']): SponsorOpportunityRecord => {
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

export async function fetchSponsorChallenges(): Promise<SponsorChallengeOpportunity[]> {
  const rows = await fetchWithSponsorFallback<any[] | null>(
    'sponsor_challenges',
    supabase
      .from('sponsor_challenges')
      .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
      .order('end_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    () => [] as any[],
  );

  return (rows ?? []).map(mapSponsorChallenge);
}

export async function fetchSponsorEvents(): Promise<SponsorEventOpportunity[]> {
  const rows = await fetchWithSponsorFallback<any[] | null>(
    'sponsor_events',
    supabase
      .from('sponsor_events')
      .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    () => [] as any[],
  );

  return (rows ?? []).map(mapSponsorEvent);
}

export async function fetchSponsorCalls(): Promise<SponsorCallOpportunity[]> {
  const rows = await fetchWithSponsorFallback<any[] | null>(
    'sponsor_calls',
    supabase
      .from('sponsor_calls')
      .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    () => [] as any[],
  );

  return (rows ?? []).map(mapSponsorCall);
}

export async function fetchSponsorNews(): Promise<SponsorNewsItem[]> {
  const rows = await fetchWithSponsorFallback<any[] | null>(
    'sponsor_news',
    supabase
      .from('sponsor_news')
      .select(`*, sponsor:profiles(${sponsorProfileSelection})`)
      .order('published_at', { ascending: false, nullsLast: true })
      .order('created_at', { ascending: false }),
    () => [] as any[],
  );

  return (rows ?? []).map(mapSponsorNews);
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
