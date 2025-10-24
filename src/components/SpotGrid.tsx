import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Spot } from '../types';

interface SpotGridProps {
  spots: Spot[];
  initialCount?: number;
  onSpotClick?: (spot: Spot) => void;
  coverPhotos?: Record<string, string>;
}

const DEFAULT_INITIAL_COUNT = 6;
const ANIMATION_DURATION = 500;

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
  const batchSize = Math.max(initialCount, DEFAULT_INITIAL_COUNT);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [nextBatchIndex, setNextBatchIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gridHeight, setGridHeight] = useState<number>(0);
  const rawId = useId();
  const gridId = `spot-grid-${rawId.replace(/:/g, '')}`;
  const currentGridRef = useRef<HTMLDivElement | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const totalBatches = useMemo(() => {
    if (batchSize === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(spots.length / batchSize));
  }, [spots.length, batchSize]);

  const getBatchSpots = useMemo(() => {
    return (batch: number) => {
      if (batchSize <= 0) {
        return [] as (Spot | null)[];
      }

      const start = batch * batchSize;
      const slice = spots.slice(start, start + batchSize);

      if (slice.length === batchSize || spots.length === 0) {
        return slice;
      }

      const filled: (Spot | null)[] = [...slice];
      while (filled.length < batchSize) {
        filled.push(null);
      }

      return filled;
    };
  }, [spots, batchSize]);

  const visibleSpots = useMemo<(Spot | null)[]>(() => getBatchSpots(currentBatchIndex), [getBatchSpots, currentBatchIndex]);

  const upcomingSpots = useMemo<(Spot | null)[]>(
    () => (nextBatchIndex !== null ? getBatchSpots(nextBatchIndex) : []),
    [getBatchSpots, nextBatchIndex],
  );

  const hasMultipleBatches = totalBatches > 1;

  const shouldShowToggle = hasMultipleBatches;

  const handleToggle = () => {
    if (!hasMultipleBatches || isAnimating) {
      return;
    }

    const nextIndex = totalBatches === 0 ? 0 : (currentBatchIndex + 1) % totalBatches;
    setNextBatchIndex(nextIndex);
    setIsAnimating(true);

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setCurrentBatchIndex(nextIndex);
      setIsAnimating(false);
      setNextBatchIndex(null);
      animationTimeoutRef.current = null;
    }, ANIMATION_DURATION);
  };

  const toggleLabel = 'Afficher plus';

  useEffect(() => {
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    setCurrentBatchIndex(0);
    setNextBatchIndex(null);
    setIsAnimating(false);
  }, [spots, batchSize]);

  useEffect(
    () => () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentGrid = currentGridRef.current;
    if (!currentGrid) {
      setGridHeight(0);
      return;
    }

    const updateHeight = () => {
      const { height } = currentGrid.getBoundingClientRect();
      setGridHeight(height);
    };

    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateHeight();
      });

      observer.observe(currentGrid);

      return () => {
        observer.disconnect();
      };
    }

    return undefined;
  }, [visibleSpots]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      if (!currentGridRef.current) {
        return;
      }
      const { height } = currentGridRef.current.getBoundingClientRect();
      setGridHeight(height);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const baseGridClasses = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-transform transition-opacity duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]';
  const currentGridClasses = `${baseGridClasses} ${isAnimating ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`;
  const upcomingGridClasses = `${baseGridClasses} absolute inset-0 ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'} pointer-events-none`;

  const renderSpotCard = (spot: Spot | null, keyPrefix: string, index: number) => {
    const key = `${keyPrefix}-${spot ? spot.id : 'placeholder'}-${index}`;

    if (!spot) {
      return (
        <div
          key={key}
          className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-dark-700/60 bg-dark-800/40 text-left shadow-lg shadow-black/10"
          role="listitem"
          aria-hidden="true"
        >
          <div className="relative w-full overflow-hidden aspect-square">
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900/80 text-gray-500">
              <span className="rounded-full border border-dark-600/70 bg-dark-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Spot à venir
              </span>
              <span className="text-[11px] uppercase tracking-[0.4em] text-gray-500/80">SkateConnect</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 sm:p-5 text-center text-sm text-gray-400">
            <p className="max-w-[14rem] text-xs uppercase tracking-[0.3em] text-gray-500">Bientôt disponible</p>
            <p className="text-[11px] text-gray-500/80">Reste à l’affût pour découvrir ce spot</p>
          </div>
        </div>
      );
    }

    const extendedSpot = spot as Spot & { rating?: number; mediaUrl?: string; media_url?: string };
    const coverPhotoUrl = coverPhotos?.[spot.id];
    const mediaUrl = coverPhotoUrl ?? extendedSpot.mediaUrl ?? extendedSpot.media_url;
    const rating = Math.max(0, Math.min(5, extendedSpot.rating ?? extendedSpot.difficulty ?? 0));

    return (
      <button
        key={key}
        onClick={() => onSpotClick?.(spot)}
        className="group overflow-hidden rounded-2xl border border-dark-700/80 bg-dark-800/70 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-orange-900/20"
        role="listitem"
      >
        <div className="relative w-full overflow-hidden aspect-square">
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
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden px-6 pt-6 pb-28 lg:pb-48">
        <div
          id={gridId}
          className="relative"
          role="list"
          style={gridHeight ? { height: gridHeight } : undefined}
        >
          <div ref={currentGridRef} className={currentGridClasses} data-grid-stage="current">
            {visibleSpots.map((spot, index) => renderSpotCard(spot, 'current', index))}
          </div>

          {nextBatchIndex !== null && upcomingSpots.length > 0 && (
            <div className={upcomingGridClasses} data-grid-stage="upcoming" aria-hidden="true">
              {upcomingSpots.map((spot, index) => renderSpotCard(spot, 'upcoming', index))}
            </div>
          )}
        </div>

        {shouldShowToggle && (
          <>
            <div className="sticky bottom-0 -mx-6 mt-6 bg-gradient-to-t from-dark-900 via-dark-900/95 to-dark-900/20 px-6 pb-4 pt-6 lg:hidden">
              <button
                type="button"
                onClick={handleToggle}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-orange-900/30 transition-transform hover:-translate-y-0.5 hover:shadow-xl"
                aria-controls={gridId}
              >
                {toggleLabel}
              </button>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="hidden lg:fixed lg:bottom-[7.5rem] lg:right-16 lg:z-40 lg:inline-flex lg:min-w-[240px] lg:items-center lg:justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white shadow-lg shadow-orange-900/40 transition-transform hover:-translate-y-1 hover:shadow-xl"
              aria-controls={gridId}
            >
              {toggleLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
