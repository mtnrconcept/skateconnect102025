import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSponsorAnalyticsInsights,
  buildSponsorAnalyticsSeries,
  DEFAULT_ANALYTICS_PERIODS,
  filterSeriesByPeriod,
  type SponsorAnalyticsSeriesPoint,
} from '../src/lib/sponsorAnalyticsInsights.js';
import type { CommunityAnalyticsSnapshot } from '../src/types/index.js';

const history: CommunityAnalyticsSnapshot[] = [
  {
    id: 'a',
    sponsor_id: 'sponsor-1',
    metric_date: '2024-04-15T00:00:00.000Z',
    reach: 1200,
    engagement_rate: 4.5,
    activation_count: 32,
    top_regions: ['Lyon', 'Paris'],
    trending_tags: ['skatepark', 'flow'],
    created_at: '2024-04-15T01:00:00.000Z',
  },
  {
    id: 'b',
    sponsor_id: 'sponsor-1',
    metric_date: '2024-05-01T00:00:00.000Z',
    reach: 1680,
    engagement_rate: 5.2,
    activation_count: 41,
    top_regions: ['Marseille'],
    trending_tags: ['flow', 'girlsride'],
    created_at: '2024-05-01T01:00:00.000Z',
  },
  {
    id: 'c',
    sponsor_id: 'sponsor-1',
    metric_date: '2024-06-12T00:00:00.000Z',
    reach: 2200,
    engagement_rate: 6.1,
    activation_count: 55,
    top_regions: ['Paris', 'Lyon'],
    trending_tags: ['skatepark', 'diy'],
    created_at: '2024-06-12T01:00:00.000Z',
  },
];

test('buildSponsorAnalyticsSeries ordonne la série chronologiquement', () => {
  const series = buildSponsorAnalyticsSeries(history);
  const orderedDates = series.map((point) => point.date);

  assert.deepEqual(orderedDates, [
    '2024-04-15T00:00:00.000Z',
    '2024-05-01T00:00:00.000Z',
    '2024-06-12T00:00:00.000Z',
  ]);
});

test("buildSponsorAnalyticsInsights calcule les totaux par segment d'analytics", () => {
  const insights = buildSponsorAnalyticsInsights(history);

  assert.equal(insights.series.length, 3);
  assert.equal(insights.breakdowns.periods.length, DEFAULT_ANALYTICS_PERIODS.length);
  assert.ok(
    insights.breakdowns.regions.some((segment) => segment.label === 'paris' && segment.reach === 3400),
  );
  assert.ok(
    insights.breakdowns.hashtags.some((segment) => segment.label === 'skatepark' && segment.activationCount === 87),
  );
});

test('filterSeriesByPeriod limite les points selon la fenêtre choisie', () => {
  const series = buildSponsorAnalyticsSeries(history);
  const thirtyDays = DEFAULT_ANALYTICS_PERIODS.find((period) => period.id === '30d')!;

  const filtered = filterSeriesByPeriod(series, thirtyDays);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.date, '2024-06-12T00:00:00.000Z');
});

test('filterSeriesByPeriod conserve toute la série pour le mode historique complet', () => {
  const series: SponsorAnalyticsSeriesPoint[] = buildSponsorAnalyticsSeries(history);
  const allTime = DEFAULT_ANALYTICS_PERIODS.find((period) => period.id === 'all')!;

  const filtered = filterSeriesByPeriod(series, allTime);

  assert.equal(filtered.length, series.length);
});
