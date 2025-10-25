import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type { CommunityAnalyticsSnapshot } from '../types';

function createFallbackSnapshot(
  sponsorId: string,
  likesCount: number,
  commentsCount: number,
): CommunityAnalyticsSnapshot {
  const now = new Date().toISOString();
  const totalInteractions = likesCount + commentsCount;
  const engagementRate = totalInteractions > 0 ? Math.min(1, totalInteractions / 100) : 0;

  return {
    id: `fallback-${sponsorId}`,
    sponsor_id: sponsorId,
    metric_date: now,
    reach: likesCount,
    engagement_rate: engagementRate,
    activation_count: commentsCount,
    top_regions: [],
    trending_tags: [],
    created_at: now,
  };
}

async function buildCommunityAnalyticsFallback(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot | null> {
  try {
    const [likesResult, commentsResult] = await Promise.all([
      supabase
        .from('spot_likes')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('spot_comments')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const likes = !likesResult.error
      ? likesResult.data ?? []
      : isSchemaMissing(likesResult.error)
        ? []
        : (() => {
            throw likesResult.error;
          })();

    const comments = !commentsResult.error
      ? commentsResult.data ?? []
      : isSchemaMissing(commentsResult.error)
        ? []
        : (() => {
            throw commentsResult.error;
          })();

    if (likes.length === 0 && comments.length === 0) {
      return createFallbackSnapshot(sponsorId, 0, 0);
    }

    return createFallbackSnapshot(sponsorId, likes.length, comments.length);
  } catch (cause) {
    console.info('Unable to synthesise community analytics fallback', cause);
    return createFallbackSnapshot(sponsorId, 0, 0);
  }
}

export async function fetchLatestCommunityAnalytics(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot | null> {
  const snapshot = await withTableFallback<CommunityAnalyticsSnapshot | null>(
    supabase
      .from('sponsor_community_metrics')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('metric_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    () => buildCommunityAnalyticsFallback(sponsorId),
    {
      onMissing: () => {
        console.info(
          'sponsor_community_metrics table is missing. Returning synthesised analytics data instead.',
        );
      },
    },
  );

  return snapshot;
}

export async function fetchCommunityAnalyticsHistory(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot[]> {
  const history = await withTableFallback<CommunityAnalyticsSnapshot[] | null>(
    supabase
      .from('sponsor_community_metrics')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('metric_date', { ascending: false }),
    async () => {
      const fallback = await buildCommunityAnalyticsFallback(sponsorId);
      return fallback ? [fallback] : [];
    },
    {
      onMissing: () => {
        console.info('sponsor_community_metrics table is missing. Returning fallback history.');
      },
    },
  );

  return (history ?? []) as CommunityAnalyticsSnapshot[];
}
