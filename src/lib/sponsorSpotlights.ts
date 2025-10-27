import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type {
  SponsorSpotlight,
  SponsorSpotlightPerformance,
  SpotlightPerformancePoint,
  SpotlightPerformanceWindow,
} from '../types';

type SpotlightRow = {
  id: string;
  sponsor_id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  call_to_action?: string | null;
  call_to_action_url?: string | null;
  status: SponsorSpotlight['status'];
  start_date?: string | null;
  end_date?: string | null;
  performance?: unknown;
  created_at: string;
  updated_at: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePerformanceWindow(raw: unknown): SpotlightPerformanceWindow {
  if (!raw || typeof raw !== 'object') {
    return { impressions: 0, clicks: 0 };
  }
  const source = raw as Record<string, unknown>;
  return {
    impressions: toNumber(source.impressions ?? source['impressions']),
    clicks: toNumber(source.clicks ?? source['clicks']),
  };
}

function normalizePerformancePoints(raw: unknown): SpotlightPerformancePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const point = item as Record<string, unknown>;
      const date = point.date;
      const dateStr =
        typeof date === 'string'
          ? date
          : date instanceof Date
            ? date.toISOString().slice(0, 10)
            : null;
      if (!dateStr) return null;
      return {
        date: dateStr,
        impressions: toNumber(point.impressions),
        clicks: toNumber(point.clicks),
      } satisfies SpotlightPerformancePoint;
    })
    .filter((value): value is SpotlightPerformancePoint => value !== null);
}

function normalizePerformance(raw: unknown): SponsorSpotlightPerformance | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const totals = source.totals as Record<string, unknown> | undefined;
  const last7 = source.last_7_days ?? source['last7Days'];
  const previous7 = source.previous_7_days ?? source['previous7Days'];
  const daily = source.daily;

  return {
    totals: {
      impressions: toNumber(totals?.impressions),
      clicks: toNumber(totals?.clicks),
      ctr: toNumber(totals?.ctr),
    },
    last7Days: normalizePerformanceWindow(last7),
    previous7Days: normalizePerformanceWindow(previous7),
    daily: normalizePerformancePoints(daily),
  } satisfies SponsorSpotlightPerformance;
}

function normalizeSponsorSpotlight(row: SpotlightRow): SponsorSpotlight {
  return {
    id: row.id,
    sponsor_id: row.sponsor_id,
    title: row.title,
    description: row.description ?? null,
    media_url: row.media_url ?? null,
    call_to_action: row.call_to_action ?? null,
    call_to_action_url: row.call_to_action_url ?? null,
    status: row.status,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    performance: normalizePerformance(row.performance),
    created_at: row.created_at,
    updated_at: row.updated_at,
  } satisfies SponsorSpotlight;
}

export interface SpotlightPayload {
  sponsor_id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  call_to_action?: string | null;
  call_to_action_url?: string | null;
  status?: SponsorSpotlight['status'];
  start_date?: string | null;
  end_date?: string | null;
}

function missingSpotlightTableError(): Error {
  return new Error(
    'La table Supabase "sponsor_spotlights" est introuvable. Exécute les migrations sponsor ou expose la vue adéquate.',
  );
}

function createLocalSpotlightRow(payload: SpotlightPayload): SpotlightRow {
  const now = new Date().toISOString();
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `local-${Math.random().toString(36).slice(2, 11)}`;

  return {
    id: randomId,
    sponsor_id: payload.sponsor_id,
    title: payload.title,
    description: payload.description ?? null,
    media_url: payload.media_url ?? null,
    call_to_action: payload.call_to_action ?? null,
    call_to_action_url: payload.call_to_action_url ?? null,
    status: (payload.status ?? 'draft') as SponsorSpotlight['status'],
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
    performance: null,
    created_at: now,
    updated_at: now,
  } satisfies SpotlightRow;
}

export async function fetchSponsorSpotlights(sponsorId: string): Promise<SponsorSpotlight[]> {
  let schemaMissing = false;

  const rows = await withTableFallback<SpotlightRow[] | null>(
    supabase
      .from('sponsor_spotlights')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('updated_at', { ascending: false }),
    () => {
      schemaMissing = true;
      console.info('sponsor_spotlights table is missing. Returning an empty spotlight list.');
      return [];
    },
    {
      onMissing: () => {
        schemaMissing = true;
      },
    },
  );

  if (schemaMissing) {
    throw missingSpotlightTableError();
  }

  return (rows ?? []).map((row) => normalizeSponsorSpotlight(row));
}

export async function createSponsorSpotlight(payload: SpotlightPayload): Promise<SponsorSpotlight> {
  const row = await withTableFallback<SpotlightRow | null>(
    supabase
      .from('sponsor_spotlights')
      .insert({
        sponsor_id: payload.sponsor_id,
        title: payload.title,
        description: payload.description ?? '',
        media_url: payload.media_url ?? null,
        call_to_action: payload.call_to_action ?? null,
        call_to_action_url: payload.call_to_action_url ?? null,
        status: payload.status ?? 'draft',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
      })
      .select('*')
      .single(),
    () => {
      console.info(
        'sponsor_spotlights table is missing. Creating a local-only spotlight placeholder instead.',
      );
      return createLocalSpotlightRow(payload);
    },
  );

  if (!row) {
    throw new Error('Impossible de créer le Spotlight.');
  }

  return normalizeSponsorSpotlight(row);
}

export async function updateSponsorSpotlight(
  id: string,
  updates: Partial<Omit<SponsorSpotlight, 'id' | 'sponsor_id' | 'created_at'>>,
): Promise<SponsorSpotlight> {
  const { data, error } = await supabase
    .from('sponsor_spotlights')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSpotlightTableError();
    }
    throw error;
  }

  return normalizeSponsorSpotlight(data as SpotlightRow);
}

export async function deleteSponsorSpotlight(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_spotlights').delete().eq('id', id);
  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSpotlightTableError();
    }
    throw error;
  }
}
