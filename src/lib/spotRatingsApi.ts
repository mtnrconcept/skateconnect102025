import { supabase } from './supabase.js';
import { upsertSpotRating } from './edgeSpotRatingFixed';
import { isColumnMissingError } from './supabaseErrors.js';
import type { SpotRating } from '../types/index.js';

type SpotRatingRow = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  review?: string | null;
  text?: string | null;
  created_at: string;
  updated_at: string | null;
  user: SpotRating['user'] | null;
};

type SpotRatingsColumn = 'comment' | 'review' | 'text';

type ColumnFallback = { column: SpotRatingsColumn; selectFragment: string };

interface FetchSpotRatingsRange {
  from: number;
  to: number;
}

interface FetchSpotRatingsResult {
  ratings: SpotRating[];
  total: number | null;
}

const USER_SELECTION = 'id, username, display_name, avatar_url';
const BASE_COLUMNS = 'id, spot_id, user_id, rating, created_at, updated_at';

const COLUMN_FALLBACKS: ColumnFallback[] = [
  { column: 'comment', selectFragment: 'comment' },
  { column: 'review', selectFragment: 'review:review' },
  { column: 'text', selectFragment: 'text:text' },
];

let cachedCommentColumn: SpotRatingsColumn | null = null;
const LOCAL_API = (import.meta as any)?.env?.VITE_LOCAL_BACKEND_URL as string | undefined;

function getColumnCandidates(): ColumnFallback[] {
  if (!cachedCommentColumn) {
    return COLUMN_FALLBACKS;
  }

  return [
    ...COLUMN_FALLBACKS.filter((fallback) => fallback.column === cachedCommentColumn),
    ...COLUMN_FALLBACKS.filter((fallback) => fallback.column !== cachedCommentColumn),
  ];
}

async function withCommentColumn<T>(handler: (fallback: ColumnFallback) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (const fallback of getColumnCandidates()) {
    try {
      const result = await handler(fallback);
      cachedCommentColumn = fallback.column;
      return result;
    } catch (error) {
      if (isColumnMissingError(error, fallback.column)) {
        lastError = error;
        if (cachedCommentColumn === fallback.column) {
          cachedCommentColumn = null;
        }
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error('Unable to resolve spot rating comment column');
}

function normalizeRatingRow(row: SpotRatingRow, column: SpotRatingsColumn): SpotRating {
  const baseComment = (row as Record<string, string | null | undefined>)[column] ?? null;

  return {
    id: row.id,
    spot_id: row.spot_id,
    user_id: row.user_id,
    rating: row.rating,
    comment: baseComment ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    user: row.user ?? undefined,
  };
}

export async function fetchSpotRatingsPage(
  spotId: string,
  range: FetchSpotRatingsRange,
): Promise<FetchSpotRatingsResult> {
  if (LOCAL_API && typeof LOCAL_API === 'string' && LOCAL_API.trim().length > 0) {
    const base = LOCAL_API.replace(/\/$/, '');
    const res = await fetch(`${base}/api/spot_ratings?spot_id=${encodeURIComponent(spotId)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Local ratings fetch failed (${res.status})`);
    const json = await res.json();
    const items: any[] = Array.isArray(json?.items) ? json.items : [];
    const total: number = Number(json?.stats?.count ?? items.length);
    const sliced = items.slice(range.from, range.to + 1);
    const ratings: SpotRating[] = sliced.map((r: any) => ({
      id: `${r.spot_id}:${r.user_id}`,
      spot_id: String(r.spot_id),
      user_id: String(r.user_id),
      rating: Number(r.rating) || 0,
      comment: (r.comment ?? null) as string | null,
      created_at: String(r.created_at ?? new Date().toISOString()),
      updated_at: String(r.updated_at ?? new Date().toISOString()),
    }));
    return { ratings, total };
  }
  return withCommentColumn(async (fallback) => {
    const { data, error, count } = await supabase
      .from('spot_ratings')
      .select(
        `${BASE_COLUMNS}, ${fallback.selectFragment}, user:profiles(${USER_SELECTION})`,
        { count: 'exact' },
      )
      .eq('spot_id', spotId)
      .order('created_at', { ascending: false })
      .range(range.from, range.to);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SpotRatingRow[];
    const ratings = rows.map((row) => normalizeRatingRow(row, fallback.column));

    return {
      ratings,
      total: typeof count === 'number' ? count : null,
    };
  });
}

export async function fetchUserSpotRating(spotId: string, userId: string): Promise<SpotRating | null> {
  if (LOCAL_API && typeof LOCAL_API === 'string' && LOCAL_API.trim().length > 0) {
    const base = LOCAL_API.replace(/\/$/, '');
    const res = await fetch(`${base}/api/spot_ratings?spot_id=${encodeURIComponent(spotId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const items: any[] = Array.isArray(json?.items) ? json.items : [];
    const row = items.find((r) => String(r.user_id) === String(userId));
    if (!row) return null;
    return {
      id: `${row.spot_id}:${row.user_id}`,
      spot_id: String(row.spot_id),
      user_id: String(row.user_id),
      rating: Number(row.rating) || 0,
      comment: (row.comment ?? null) as string | null,
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    } as SpotRating;
  }
  return withCommentColumn(async (fallback) => {
    const { data, error } = await supabase
      .from('spot_ratings')
      .select(`${BASE_COLUMNS}, ${fallback.selectFragment}`)
      .eq('spot_id', spotId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return normalizeRatingRow(data as SpotRatingRow, fallback.column);
  });
}

interface SaveSpotRatingInput {
  spotId: string;
  userId: string;
  rating: number;
  comment: string | null;
  existingRatingId?: string | null;
}

export async function saveSpotRating({
  spotId,
  userId,
  rating,
  comment,
  existingRatingId,
}: SaveSpotRatingInput): Promise<void> {
  // Basculé vers Edge Function: relaie le JWT + RLS
  await upsertSpotRating(spotId, rating, comment ?? undefined);
}

export async function deleteSpotRating(id: string): Promise<void> {
  const { error } = await supabase.from('spot_ratings').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
