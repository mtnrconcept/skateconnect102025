import type { CommunityAnalyticsSnapshot } from '../types/index.js';

export interface SponsorAnalyticsSeriesPoint {
  date: string;
  reach: number;
  activationCount: number;
  engagementRate: number;
}

export interface SponsorAnalyticsAggregate {
  key: string;
  label: string;
  reach: number;
  activationCount: number;
  engagementRate: number;
  occurrences: number;
}

export interface SponsorAnalyticsBreakdowns {
  periods: SponsorAnalyticsAggregate[];
  regions: SponsorAnalyticsAggregate[];
  hashtags: SponsorAnalyticsAggregate[];
}

export interface SponsorAnalyticsInsights {
  series: SponsorAnalyticsSeriesPoint[];
  breakdowns: SponsorAnalyticsBreakdowns;
}

export interface AnalyticsPeriodFilter {
  id: '7d' | '30d' | '90d' | 'all';
  label: string;
  days: number | null;
}

export const DEFAULT_ANALYTICS_PERIODS: AnalyticsPeriodFilter[] = [
  { id: '7d', label: '7 jours', days: 7 },
  { id: '30d', label: '30 jours', days: 30 },
  { id: '90d', label: '90 jours', days: 90 },
  { id: 'all', label: 'Historique complet', days: null },
];

export function buildSponsorAnalyticsSeries(
  history: CommunityAnalyticsSnapshot[],
): SponsorAnalyticsSeriesPoint[] {
  if (!history.length) {
    return [];
  }

  return history
    .slice()
    .sort(
      (a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime(),
    )
    .map((snapshot) => ({
      date: snapshot.metric_date,
      reach: snapshot.reach,
      activationCount: snapshot.activation_count,
      engagementRate: snapshot.engagement_rate,
    }));
}

function aggregateSnapshots(
  snapshots: CommunityAnalyticsSnapshot[],
): Omit<SponsorAnalyticsAggregate, 'key' | 'label'> {
  if (!snapshots.length) {
    return {
      reach: 0,
      activationCount: 0,
      engagementRate: 0,
      occurrences: 0,
    };
  }

  const totals = snapshots.reduce(
    (acc, snapshot) => {
      acc.reach += snapshot.reach;
      acc.activationCount += snapshot.activation_count;
      acc.engagementRate += snapshot.engagement_rate;
      acc.occurrences += 1;
      return acc;
    },
    { reach: 0, activationCount: 0, engagementRate: 0, occurrences: 0 },
  );

  return {
    reach: totals.reach,
    activationCount: totals.activationCount,
    engagementRate: totals.occurrences > 0 ? totals.engagementRate / totals.occurrences : 0,
    occurrences: totals.occurrences,
  };
}

function buildPeriodBreakdown(
  history: CommunityAnalyticsSnapshot[],
): SponsorAnalyticsAggregate[] {
  if (!history.length) {
    return [];
  }

  const latestDate = history
    .slice()
    .sort((a, b) => new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime())[0]!
    .metric_date;
  const latestTimestamp = new Date(latestDate).getTime();

  return DEFAULT_ANALYTICS_PERIODS.map((period) => {
    const threshold =
      period.days === null ? Number.NEGATIVE_INFINITY : latestTimestamp - period.days * 24 * 60 * 60 * 1000;

    const snapshots = history.filter(
      (snapshot) => new Date(snapshot.metric_date).getTime() >= threshold,
    );

    return {
      key: period.id,
      label: period.label,
      ...aggregateSnapshots(snapshots),
    };
  });
}

function buildCategoricalBreakdown(
  history: CommunityAnalyticsSnapshot[],
  selector: (snapshot: CommunityAnalyticsSnapshot) => string[],
): SponsorAnalyticsAggregate[] {
  if (!history.length) {
    return [];
  }

  const buckets = new Map<string, CommunityAnalyticsSnapshot[]>();

  history.forEach((snapshot) => {
    const entries = selector(snapshot);
    entries
      .filter(Boolean)
      .forEach((value) => {
        const key = value.toLowerCase();
        const current = buckets.get(key) ?? [];
        current.push(snapshot);
        buckets.set(key, current);
      });
  });

  return Array.from(buckets.entries())
    .map(([key, snapshots]) => ({
      key,
      label: key,
      ...aggregateSnapshots(snapshots),
    }))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 8);
}

export function buildSponsorAnalyticsInsights(
  history: CommunityAnalyticsSnapshot[],
): SponsorAnalyticsInsights {
  if (!history.length) {
    return {
      series: [],
      breakdowns: { periods: [], regions: [], hashtags: [] },
    };
  }

  return {
    series: buildSponsorAnalyticsSeries(history),
    breakdowns: {
      periods: buildPeriodBreakdown(history),
      regions: buildCategoricalBreakdown(history, (snapshot) => snapshot.top_regions),
      hashtags: buildCategoricalBreakdown(history, (snapshot) => snapshot.trending_tags),
    },
  };
}

export function filterSeriesByPeriod(
  series: SponsorAnalyticsSeriesPoint[],
  period: AnalyticsPeriodFilter,
): SponsorAnalyticsSeriesPoint[] {
  if (!series.length) {
    return [];
  }

  if (period.days === null) {
    return series;
  }

  const lastPoint = series[series.length - 1]!;
  const threshold = new Date(lastPoint.date).getTime() - period.days * 24 * 60 * 60 * 1000;

  return series.filter((point) => new Date(point.date).getTime() >= threshold);
}
