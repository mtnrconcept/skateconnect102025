import { useMemo } from 'react';
import type { SponsorAnalyticsSeriesPoint } from '../../../lib/sponsorAnalyticsInsights';

interface TrendAreaChartProps {
  title: string;
  series: SponsorAnalyticsSeriesPoint[];
  accentColor: string;
}

interface ChartScales {
  maxValue: number;
  areaPath: string;
  activationPath: string;
  points: { x: number; y: number; label: string }[];
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PADDING_X = 32;
const PADDING_Y = 24;

function formatDateLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function computeScales(series: SponsorAnalyticsSeriesPoint[]): ChartScales | null {
  if (series.length === 0) {
    return null;
  }

  const maxMetric = Math.max(
    ...series.map((point) => Math.max(point.reach, point.activationCount)),
    1,
  );

  const horizontalSpace = CHART_WIDTH - PADDING_X * 2;
  const verticalSpace = CHART_HEIGHT - PADDING_Y * 2;

  const points = series.map((point, index) => {
    const ratio = series.length === 1 ? 0 : index / (series.length - 1);
    const x = PADDING_X + ratio * horizontalSpace;
    const y = CHART_HEIGHT - PADDING_Y - (point.reach / maxMetric) * verticalSpace;
    return { x, y, label: formatDateLabel(point.date) };
  });

  const areaPath = [
    `M ${PADDING_X} ${CHART_HEIGHT - PADDING_Y}`,
    ...points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    `L ${PADDING_X + horizontalSpace} ${CHART_HEIGHT - PADDING_Y}`,
    'Z',
  ].join(' ');

  const activationPath = series
    .map((point, index) => {
      const ratio = series.length === 1 ? 0 : index / (series.length - 1);
      const x = PADDING_X + ratio * horizontalSpace;
      const y =
        CHART_HEIGHT - PADDING_Y - (point.activationCount / maxMetric) * verticalSpace;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return {
    maxValue: maxMetric,
    areaPath,
    activationPath,
    points,
  };
}

export default function TrendAreaChart({ title, series, accentColor }: TrendAreaChartProps) {
  const scales = useMemo(() => computeScales(series), [series]);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Portée vs activations
          </p>
        </div>
        {scales && (
          <div className="text-right text-sm text-slate-400">
            <p>
              Max portée :{' '}
              <span className="font-semibold text-slate-200">
                {Math.round(scales.maxValue).toLocaleString('fr-FR')}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {scales ? (
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full">
            <defs>
              <linearGradient id="reach-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.45" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            <path d={scales.areaPath} fill="url(#reach-gradient)" stroke="none" />

            <path
              d={scales.activationPath}
              fill="none"
              stroke="#f97316"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {scales.points.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={3.5}
                  fill={accentColor}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
                <text
                  x={point.x}
                  y={CHART_HEIGHT - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#94a3b8"
                >
                  {point.label}
                </text>
              </g>
            ))}

            <line
              x1={PADDING_X}
              x2={CHART_WIDTH - PADDING_X}
              y1={CHART_HEIGHT - PADDING_Y}
              y2={CHART_HEIGHT - PADDING_Y}
              stroke="#1f2937"
              strokeWidth={1}
            />
          </svg>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            Aucun historique suffisant pour afficher la tendance.
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} /> Portée
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> Activations
        </div>
      </div>
    </div>
  );
}
