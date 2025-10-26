import { supabase } from './supabase.js';
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

const COLUMN_FALLBACKS: Array<{ column: SpotRatingsColumn; selectFragment: string }> = [
  { column: 'comment', selectFragment: 'comment' },
  { column: 'review', selectFragment: 'review:review' },
  { column: 'text', selectFragment: 'text:text' },
];

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
  let lastError: unknown;

  for (const fallback of COLUMN_FALLBACKS) {
    try {
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
        if (isColumnMissingError(error, fallback.column)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      const rows = (data ?? []) as SpotRatingRow[];
      const ratings = rows.map((row) => normalizeRatingRow(row, fallback.column));

      return {
        ratings,
        total: typeof count === 'number' ? count : null,
      };
    } catch (error) {
      if (isColumnMissingError(error, fallback.column)) {
        lastError = error;
        continue;
      }
      lastError = error;
      break;
    }
  }

  throw lastError ?? new Error('Unable to load spot ratings');
}
