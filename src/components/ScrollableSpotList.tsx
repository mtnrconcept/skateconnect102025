import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Spot } from '../types';

interface ScrollableSpotListProps {
  spots: Spot[];
  visibleCount: number;
  onLoadMore: () => void;
  onSpotClick?: (spot: Spot) => void;
  coverPhotos?: Record<string, string>;
  loadMoreLabel?: string;
  hasMore: boolean;
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
  hasMore,
}: ScrollableSpotListProps) {
  const descriptionRefs = useRef(new Map<string, HTMLParagraphElement>());
  const descriptionObservers = useRef(new Map<string, ResizeObserver>());
  const [overflowingDescriptions, setOverflowingDescriptions] = useState<Record<string, boolean>>({});

  const updateOverflowingDescriptions = useCallback(() => {
    const refMap = descriptionRefs.current;
    const next: Record<string, boolean> = {};

    refMap.forEach((node, spotId) => {
      if (!node) return;
      const isOverflowing = node.scrollHeight > node.clientHeight + 1;
      if (isOverflowing) {
        next[spotId] = true;
      }
    });

    setOverflowingDescriptions((previous) => {
      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);

      if (previousKeys.length === nextKeys.length) {
        const isSame = previousKeys.every((key) => previous[key] === next[key]);
        if (isSame) return previous;
      }

      return next;
    });
  }, []);

  const registerDescriptionRef = useCallback(
    (spotId: string, node: HTMLParagraphElement | null) => {
      const refMap = descriptionRefs.current;
      const observerMap = descriptionObservers.current;

      const previousNode = refMap.get(spotId);
      const existingObserver = observerMap.get(spotId);

      if (!node) {
        if (existingObserver) {
          existingObserver.disconnect();
          observerMap.delete(spotId);
        }
        refMap.delete(spotId);
        updateOverflowingDescriptions();
        return;
      }

      refMap.set(spotId, node);

      if (previousNode !== node) {
        if (existingObserver) {
          existingObserver.disconnect();
          observerMap.delete(spotId);
        }

        if (typeof ResizeObserver !== 'undefined') {
          const observer = new ResizeObserver(() => {
            updateOverflowingDescriptions();
          });
          observer.observe(node);
          observerMap.set(spotId, observer);
        }
      }

      updateOverflowingDescriptions();
    },
    [updateOverflowingDescriptions]
  );

  useEffect(() => {
    return () => {
      descriptionObservers.current.forEach((observer) => observer.disconnect());
      descriptionObservers.current.clear();
      descriptionRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      updateOverflowingDescriptions();
    });
    return () => cancelAnimationFrame(id);
  }, [visibleCount, spots, updateOverflowingDescriptions]);

  const visibleSpots = spots.slice(0, visibleCount);

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="grid grid-cols-1 gap-4" role="list">
          {visibleSpots.map((spot) => {
            const coverPhotoUrl = coverPhotos?.[spot.id];
            const extendedSpot = spot as Spot & { rating?: number; mediaUrl?: string; media_url?: string; difficulty?: number };
            const mediaUrl = coverPhotoUrl ?? extendedSpot.mediaUrl ?? extendedSpot.media_url;
            const rating = Math.max(0, Math.min(5, extendedSpot.rating ?? extendedSpot.difficulty ?? 0));
            const hasOverflowingDescription = Boolean(overflowingDescriptions[spot.id]);

            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => onSpotClick?.(spot)}
                className="group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-dark-700/80 bg-dark-800/70 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-orange-900/20"
                role="listitem"
              >
                <div className="relative flex-[1] overflow-hidden">
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

                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-dark-900/90 via-dark-900/20 to-transparent transition-opacity duration-500 ease-in-out group-hover:opacity-100" />

                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="rounded-full bg-orange-500/90 px-3 py-1 text-xs font-semibold uppercase text-white">
                      {getSpotTypeLabel((spot as any).spot_type)}
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

                <div className="flex min-h-0 flex-[2] flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">{spot.name}</h3>
                    {(spot as any).creator?.username && (
                      <span className="rounded-full border border-dark-600 bg-dark-900/70 px-3 py-1 text-xs text-gray-300">
                        @{(spot as any).creator?.username}
                      </span>
                    )}
                  </div>

                  {spot.description && (
                    <div className="flex flex-col gap-2 overflow-hidden">
                      <p
                        ref={(node) => registerDescriptionRef(spot.id, node)}
                        className="spot-card-description text-sm text-gray-200"
                      >
                        {spot.description}
                      </p>
                      <span
                        aria-hidden={!hasOverflowingDescription}
                        className={
                          hasOverflowingDescription
                            ? 'text-xs font-semibold uppercase tracking-widest text-orange-300'
                            : 'invisible text-xs font-semibold uppercase tracking-widest text-orange-300'
                        }
                      >
                        Afficher plus
                      </span>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs text-gray-200">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-orange-400" />
                      <span className="max-w-[12rem] truncate sm:max-w-[10rem] xl:max-w-none">
                        {spot.address || 'Adresse non spécifiée'}
                      </span>
                    </div>
                    <span className="rounded-full border border-orange-500/40 bg-orange-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-100">
                      Voir sur la carte
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {hasMore && (
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
