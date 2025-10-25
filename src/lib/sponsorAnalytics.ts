import { supabase } from './supabase.js';
import type { CommunityAnalyticsSnapshot } from '../types';

export async function fetchLatestCommunityAnalytics(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot | null> {
  const { data, error } = await supabase
    .from('sponsor_community_metrics')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('metric_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CommunityAnalyticsSnapshot | null;
}

export async function fetchCommunityAnalyticsHistory(
  sponsorId: string,
): Promise<CommunityAnalyticsSnapshot[]> {
  const { data, error } = await supabase
    .from('sponsor_community_metrics')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('metric_date', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CommunityAnalyticsSnapshot[];
}
