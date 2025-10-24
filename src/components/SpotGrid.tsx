import { useId, useMemo, useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Spot } from '../types';

interface SpotGridProps {
  spots: Spot[];
  initialCount?: number;
  onSpotClick?: (spot: Spot) => void;
  coverPhotos?: Record<string, string>;
}

const DEFAULT_INITIAL_COUNT = 6;

const getSpotTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    street: 'Street',
    skatepark: 'Skatepark',
    bowl: 'Bowl',
    diy: 'DIY',
    transition: 'Transition',
  };

  return labels[type] || type;
};

export default function SpotGrid({
  spots,
  initialCount = DEFAULT_INITIAL_COUNT,
  onSpotClick,
  coverPhotos,
}: SpotGridProps) {
  const [expanded, setExpanded] = useState(false);
  const rawId = useId();
  const gridId = `spot-grid-${rawId.replace(/:/g, '')}`;

  const { visibleSpots, remainingCount } = useMemo(() => {
    if (expanded) {
      return { visibleSpots: spots, remainingCount: Math.max(spots.length - initialCount, 0) };
    }

    return {
      visibleSpots: spots.slice(0, initialCount),
      remainingCount: Math.max(spots.length - initialCount, 0),
    };
  }, [expanded, spots, initialCount]);

  const shouldShowToggle = remainingCount > 0 || expanded;

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const toggleLabel = expanded
    ? 'Afficher moins'
    : `Afficher plus${remainingCount > 0 ? ` (${remainingCount})` : ''}`;

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-y-auto px-6 pt-6 pb-28">
        <div
          id={gridId}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          role="list"
        >
          {visibleSpots.map((spot) => {
            const extendedSpot = spot as Spot & { rating?: number; mediaUrl?: string; media_url?: string };
            const coverPhotoUrl = coverPhotos?.[spot.id];
            const mediaUrl = coverPhotoUrl ?? extendedSpot.mediaUrl ?? extendedSpot.media_url;
            const rating = Math.max(0, Math.min(5, extendedSpot.rating ?? extendedSpot.difficulty ?? 0));

            return (
              <button
                key={spot.id}
                onClick={() => onSpotClick?.(spot)}
                className="group overflow-hidden rounded-2xl border border-dark-700/80 bg-dark-800/70 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-orange-900/20"
                role="listitem"
              >
                <div className="relative h-32 w-full overflow-hidden xl:h-36">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={spot.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 text-xs uppercase tracking-widest text-gray-500">
                      Aucun média
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="rounded-full bg-orange-500/90 px-3 py-1 text-xs font-semibold uppercase text-white">
                      {getSpotTypeLabel(spot.spot_type)}
                    </span>
                  </div>
                  <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-dark-900/80 px-3 py-1 text-xs font-semibold text-amber-300">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        size={14}
                        className={starIndex < rating ? 'fill-amber-300 text-amber-300' : 'text-dark-500'}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">{spot.name}</h3>
                    {spot.creator?.username && (
                      <span className="rounded-full border border-dark-600 bg-dark-900/70 px-3 py-1 text-xs text-gray-400">
                        @{spot.creator?.username}
                      </span>
                    )}
                  </div>
                  {spot.description && <p className="line-clamp-2 text-sm text-gray-300">{spot.description}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin size={14} className="text-orange-400" />
                      <span>{spot.address || 'Adresse non spécifiée'}</span>
                    </div>
                    <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-200">
                      Voir sur la carte
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {shouldShowToggle && (
          <div className="sticky bottom-0 -mx-6 mt-6 bg-gradient-to-t from-dark-900 via-dark-900/95 to-dark-900/20 px-6 pb-4 pt-6">
            <button
              type="button"
              onClick={handleToggle}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-orange-900/30 transition-transform hover:-translate-y-0.5 hover:shadow-xl"
              aria-expanded={expanded}
              aria-controls={gridId}
            >
              {toggleLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
