import type { AnalyticsPeriodFilter } from '../../../lib/sponsorAnalyticsInsights';

type AnalyticsSegmentation = 'region' | 'hashtag';

interface AnalyticsFiltersProps {
  periods: AnalyticsPeriodFilter[];
  selectedPeriod: AnalyticsPeriodFilter;
  onPeriodChange: (period: AnalyticsPeriodFilter) => void;
  segmentation: AnalyticsSegmentation;
  onSegmentationChange: (segmentation: AnalyticsSegmentation) => void;
  disabled?: boolean;
}

export default function AnalyticsFilters({
  periods,
  selectedPeriod,
  onPeriodChange,
  segmentation,
  onSegmentationChange,
  disabled = false,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2 text-sm">
        {periods.map((period) => {
          const isActive = period.id === selectedPeriod.id;
          return (
            <button
              type="button"
              key={period.id}
              className={`rounded-full border px-4 py-2 transition ${
                isActive
                  ? 'border-sky-400/60 bg-sky-500/10 text-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.25)]'
                  : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
              disabled={disabled}
              onClick={() => onPeriodChange(period)}
            >
              {period.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
        Segment
        <div className="inline-flex rounded-full border border-slate-700/60 bg-slate-900/60 p-1 text-slate-300">
          <button
            type="button"
            onClick={() => onSegmentationChange('region')}
            disabled={disabled}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              segmentation === 'region'
                ? 'rounded-full bg-sky-500/20 text-sky-100 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                : 'rounded-full hover:text-white'
            }`}
          >
            Régions
          </button>
          <button
            type="button"
            onClick={() => onSegmentationChange('hashtag')}
            disabled={disabled}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              segmentation === 'hashtag'
                ? 'rounded-full bg-sky-500/20 text-sky-100 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                : 'rounded-full hover:text-white'
            }`}
          >
            Hashtags
          </button>
        </div>
      </div>
    </div>
  );
}

export type { AnalyticsSegmentation };
