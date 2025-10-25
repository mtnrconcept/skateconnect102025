import type { SponsorAnalyticsAggregate } from '../../../lib/sponsorAnalyticsInsights';

interface SegmentedStackedBarsProps {
  title: string;
  segments: SponsorAnalyticsAggregate[];
  primaryColor: string;
  secondaryColor: string;
}

function formatEngagement(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(1)}%`;
}

export default function SegmentedStackedBars({
  title,
  segments,
  primaryColor,
  secondaryColor,
}: SegmentedStackedBarsProps) {
  const maxTotal = Math.max(
    ...segments.map((segment) => segment.reach + segment.activationCount),
    1,
  );

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="text-xs uppercase tracking-widest text-slate-500">Reach + activations</div>
      </div>

      {segments.length === 0 ? (
        <div className="mt-8 flex h-32 items-center justify-center text-sm text-slate-400">
          Pas encore assez de données segmentées.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {segments.map((segment) => {
            const total = segment.reach + segment.activationCount;
            const reachWidth = (segment.reach / maxTotal) * 100;
            const activationWidth = (segment.activationCount / maxTotal) * 100;

            return (
              <div key={segment.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span className="font-medium text-white">{segment.label}</span>
                  <span className="text-xs text-slate-400">
                    {total.toLocaleString('fr-FR')} interactions • {formatEngagement(segment.engagementRate)}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className="absolute left-0 top-0 h-full"
                    style={{ width: `${reachWidth}%`, background: primaryColor }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full"
                    style={{
                      width: `${Math.min(100, reachWidth + activationWidth)}%`,
                      background: secondaryColor,
                      opacity: 0.6,
                    }}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    Portée :{' '}
                    <span className="text-slate-200">{segment.reach.toLocaleString('fr-FR')}</span>
                  </span>
                  <span>
                    Activations :{' '}
                    <span className="text-slate-200">{segment.activationCount.toLocaleString('fr-FR')}</span>
                  </span>
                  <span>
                    Observations :{' '}
                    <span className="text-slate-200">{segment.occurrences}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: primaryColor }} /> Portée
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: secondaryColor, opacity: 0.65 }}
          />
          Activations
        </div>
      </div>
    </div>
  );
}
