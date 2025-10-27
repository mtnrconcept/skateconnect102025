import { MapPin, Star, Route } from 'lucide-react';
import type { Spot } from '../types';

interface ScrollableSpotListProps {
  spots: Spot[];
  visibleCount?: number;
  onLoadMore?: () => void;
  onSpotClick?: (spot: Spot) => void;
  coverPhotos?: Record<string, string>;
  loadMoreLabel?: string;
  hasMore?: boolean;
  onRouteRequest?: (spot: Spot) => void;
}

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

export default function ScrollableSpotList({
  spots,
  visibleCount,
  onLoadMore,
  onSpotClick,
  coverPhotos,
  loadMoreLabel = 'Afficher plus',
  hasMore = false,
  onRouteRequest,
}: ScrollableSpotListProps) {
  const visibleSpots = typeof visibleCount === 'number' ? spots.slice(0, visibleCount) : spots;

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="list">
          {visibleSpots.map((spot) => {
            const coverPhotoUrl = coverPhotos?.[spot.id];
            const extendedSpot = spot as Spot & { rating?: number; mediaUrl?: string; media_url?: string };
            const mediaUrl = coverPhotoUrl ?? extendedSpot.mediaUrl ?? extendedSpot.media_url;
            const ratingSource = extendedSpot.rating ?? spot.difficulty ?? 0;
            const rating = Math.max(0, Math.min(5, ratingSource));

            return (
              <div
                key={spot.id}
                role="listitem"
                className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-dark-700/80 bg-dark-800/70 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-orange-900/20"
              >
                <div className="absolute inset-0">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={spot.name}
                      className="h-full w-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900 text-xs uppercase tracking-widest text-gray-500">
                      Aucun média
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900/90 via-dark-900/30 to-transparent transition-opacity duration-500 group-hover:from-dark-900/95 group-hover:via-dark-900/50" />
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSpotClick?.(spot)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSpotClick?.(spot);
                    }
                  }}
                  className="absolute inset-0 flex cursor-pointer flex-col justify-between p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <div className="flex items-start justify-between text-xs font-semibold uppercase tracking-wide text-white">
                    <span className="rounded-full bg-orange-500/90 px-3 py-1 text-[11px]">
                      {getSpotTypeLabel(spot.spot_type)}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-dark-900/80 px-3 py-1 text-amber-300">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={starIndex}
                          size={14}
                          className={starIndex < rating ? 'fill-amber-300 text-amber-300' : 'text-dark-500'}
                        />
                      ))}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <h3 className="truncate text-lg font-semibold text-white" title={spot.name}>
                          {spot.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-200">
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="mt-0.5 text-orange-400" />
                            <span className="truncate leading-snug" title={spot.address || 'Adresse non spécifiée'}>
                              {spot.address || 'Adresse non spécifiée'}
                            </span>
                          </div>
                          {onRouteRequest && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRouteRequest(spot);
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-dark-900/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-100 transition-colors hover:border-orange-400 hover:bg-orange-500/20"
                            >
                              <Route size={12} className="text-orange-300" />
                              Itinéraire
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-100">
                      Voir sur la carte
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasMore && onLoadMore && (
        <div className="border-t border-dark-800/70 bg-dark-900/90 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-orange-900/30 transition-transform hover:-translate-y-0.5 hover:shadow-xl"
          >
            {loadMoreLabel}
          </button>
        </div>
      )}
    </div>
  );
}
