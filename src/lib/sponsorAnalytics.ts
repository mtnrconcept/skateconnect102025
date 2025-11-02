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
    () =>
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
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return snapshot;
}

export async function fetchCommunityAnalyticsHistory(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot[]> {
  const history = await withTableFallback<CommunityAnalyticsSnapshot[] | null>(
    () =>
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
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (history ?? []) as CommunityAnalyticsSnapshot[];
}

/**
 * Enregistre une estimation de campagne comme point analytics communautaire.
 * Tolère l'absence de table (schéma sponsor non déployé) en no-op.
 */
export async function logCampaignEstimationAsAnalytics(
  sponsorId: string,
  params: {
    reach: number;
    impressions: number;
    clicks: number;
    engagementRate?: number;
    tags?: string[];
    regions?: string[];
    metricDate?: string;
  },
): Promise<void> {
  const engagementRate =
    typeof params.engagementRate === 'number'
      ? params.engagementRate
      : params.impressions > 0
        ? params.clicks / params.impressions
        : 0;

  try {
    const payload = {
      sponsor_id: sponsorId,
      metric_date: params.metricDate ?? new Date().toISOString(),
      reach: Math.max(0, Math.round(params.reach)),
      engagement_rate: Math.max(0, Math.min(1, engagementRate)),
      activation_count: Math.max(0, Math.round(params.clicks)),
      // Champs catégoriels optionnels
      trending_tags: params.tags ?? [],
      top_regions: params.regions ?? [],
    } as const;

    const { error } = await supabase
      .from('sponsor_community_metrics')
      .insert([payload]);

    if (error) {
      if (isSchemaMissing(error)) {
        // Table manquante: on ignore silencieusement
        return;
      }
      // Autres erreurs: on loggent en info pour ne pas casser le flux UI
      console.info('logCampaignEstimationAsAnalytics failed', error);
    }
  } catch (cause) {
    // Réseau ou autre: on reste résilient
    console.info('logCampaignEstimationAsAnalytics threw', cause);
  }
}
