import { useEffect, useMemo, useState } from 'react';
import { useSponsorContext } from '../../../contexts/SponsorContext';
import {
  DEFAULT_ANALYTICS_PERIODS,
  filterSeriesByPeriod,
  type AnalyticsPeriodFilter,
} from '../../../lib/sponsorAnalyticsInsights';
import AnalyticsFilters, { type AnalyticsSegmentation } from './AnalyticsFilters';
import TrendAreaChart from './TrendAreaChart';
import SegmentedStackedBars from './SegmentedStackedBars';

export default function SponsorAnalyticsSection() {
  const {
    analyticsSeries,
    analyticsBreakdowns,
    analyticsPeriods,
    branding,
    loading,
  } = useSponsorContext();

  const periodOptions = analyticsPeriods.length > 0 ? analyticsPeriods : DEFAULT_ANALYTICS_PERIODS;
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriodFilter>(periodOptions[1] ?? periodOptions[0]);
  const [segmentation, setSegmentation] = useState<AnalyticsSegmentation>('region');

  useEffect(() => {
    if (!selectedPeriod || !periodOptions.find((period) => period.id === selectedPeriod.id)) {
      setSelectedPeriod(periodOptions[0]!);
    }
  }, [periodOptions, selectedPeriod]);

  const filteredSeries = useMemo(() => {
    if (!selectedPeriod) {
      return analyticsSeries;
    }
    return filterSeriesByPeriod(analyticsSeries, selectedPeriod);
  }, [analyticsSeries, selectedPeriod]);

  const stackedSegments = useMemo(() => {
    if (segmentation === 'region') {
      return analyticsBreakdowns.regions;
    }
    return analyticsBreakdowns.hashtags;
  }, [analyticsBreakdowns.hashtags, analyticsBreakdowns.regions, segmentation]);

  const primaryColor = branding?.primary_color ?? '#0ea5e9';
  const secondaryColor = branding?.secondary_color ?? '#f97316';

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Pilotage des performances</h2>
              <p className="text-sm text-slate-400">
                Analyse consolidée des interactions communauté x marque.
              </p>
            </div>
          </div>

          <AnalyticsFilters
            periods={periodOptions}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            segmentation={segmentation}
            onSegmentationChange={setSegmentation}
            disabled={loading}
          />

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <TrendAreaChart
              title="Tendance interactions communauté"
              series={filteredSeries}
              accentColor={primaryColor}
            />
            <SegmentedStackedBars
              title={segmentation === 'region' ? 'Régions qui résonnent' : 'Hashtags performants'}
              segments={stackedSegments}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
