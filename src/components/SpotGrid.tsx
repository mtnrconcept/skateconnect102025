import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, TransitionEventHandler } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Spot } from '../types';

interface SpotGridProps {
  spots: Spot[];
  initialCount?: number;              // ignoré si < 9 : on force des batches de 9 pour 3×3
  onSpotClick?: (spot: Spot) => void;
  coverPhotos?: Record<string, string>;
}

/** Spéc: 3 × 2 => 6 cartes par “page” */
const PAGE_SIZE = 6;

/** Labels propres pour le badge type de spot */
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
  initialCount = PAGE_SIZE,
  onSpotClick,
  coverPhotos,
}: SpotGridProps) {
  /** Toujours >= 9 pour garantir 3×3 */
  const batchSize = Math.max(initialCount ?? PAGE_SIZE, PAGE_SIZE);

  /** Index de batch courant et batch à venir (pour l’anim) */
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  interface AnimationState {
    nextIndex: number;
    currentSpots: (Spot | null)[];
    nextSpots: (Spot | null)[];
  }

  const [pendingAnimation, setPendingAnimation] = useState<AnimationState | null>(null);
  const pendingAnimationRef = useRef<AnimationState | null>(null);

  /** Slider metrics */
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const sliderInnerRef = useRef<HTMLDivElement | null>(null);
  const [sliderHeight, setSliderHeight] = useState<number | null>(null);
  const [sliderTransform, setSliderTransform] = useState(0);
  const [sliderTransitionEnabled, setSliderTransitionEnabled] = useState(false);

  /** Ids/refs */
  const rawId = useId();
  const gridId = `spot-grid-${rawId.replace(/:/g, '')}`;

  /** Total de batches */
  const totalBatches = useMemo(() => {
    if (batchSize === 0) return 0;
    return Math.max(1, Math.ceil(spots.length / batchSize));
  }, [spots.length, batchSize]);

  /** Helper pour découper un batch complet (rempli avec placeholders null si < batchSize) */
  const getBatchSpots = useMemo(() => {
    return (batch: number) => {
      if (batchSize <= 0) return [] as (Spot | null)[];
      const start = batch * batchSize;
      const slice = spots.slice(start, start + batchSize);

      if (slice.length === batchSize || spots.length === 0) return slice;

      const filled: (Spot | null)[] = [...slice];
      while (filled.length < batchSize) filled.push(null);
      return filled;
    };
  }, [spots, batchSize]);

  /** Collections visibles / à venir */
  const visibleSpots = useMemo<(Spot | null)[]>(
    () => getBatchSpots(currentBatchIndex),
    [getBatchSpots, currentBatchIndex]
  );

  /** Toggle */
  const hasMultipleBatches = totalBatches > 1;
  const shouldShowToggle = hasMultipleBatches;
  const toggleLabel = 'Afficher plus';

  const handleToggle = () => {
    if (!hasMultipleBatches || isAnimating) return;
    const nextIndex = totalBatches === 0 ? 0 : (currentBatchIndex + 1) % totalBatches;
    const nextSpots = getBatchSpots(nextIndex);
    setPendingAnimation({
      nextIndex,
      currentSpots: visibleSpots,
      nextSpots,
    });
    setIsAnimating(true);
  };

  /** Reset propre quand les données changent */
  useEffect(() => {
    setCurrentBatchIndex(0);
    setPendingAnimation(null);
    setIsAnimating(false);
    setSliderTransform(0);
    setSliderTransitionEnabled(false);
  }, [spots, batchSize]);

  useEffect(() => {
    pendingAnimationRef.current = pendingAnimation;
  }, [pendingAnimation]);

  /** Mesure de la page visible */
  const measureCurrentPage = useCallback(() => {
    if (pendingAnimation) return;
    const page = sliderInnerRef.current?.querySelector<HTMLElement>('[data-page]');
    if (!page) return;
    const { height } = page.getBoundingClientRect();
    setSliderHeight(height);
  }, [pendingAnimation]);

  useLayoutEffect(() => {
    measureCurrentPage();
  }, [measureCurrentPage, visibleSpots]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      measureCurrentPage();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureCurrentPage]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    if (!sliderRef.current) return;

    const observer = new ResizeObserver(() => {
      measureCurrentPage();
    });

    observer.observe(sliderRef.current);

    return () => observer.disconnect();
  }, [measureCurrentPage]);

  /** Lance l’animation slide-up */
  useLayoutEffect(() => {
    if (!pendingAnimation) return;

    const inner = sliderInnerRef.current;
    if (!inner) return;

    const pages = inner.querySelectorAll<HTMLElement>('[data-page]');
    const currentPage = pages[0];
    const nextPage = pages[1];

    if (!currentPage || !nextPage) return;

    const currentHeight = currentPage.getBoundingClientRect().height;
    const nextHeight = nextPage.getBoundingClientRect().height;

    setSliderTransitionEnabled(false);
    setSliderTransform(0);
    setSliderHeight(currentHeight);

    requestAnimationFrame(() => {
      setSliderHeight(nextHeight);
      requestAnimationFrame(() => {
        setSliderTransitionEnabled(true);
        setSliderTransform(-currentHeight);
      });
    });
  }, [pendingAnimation]);

  /** Commit lorsque la transition est terminée */
  const handleSliderTransitionEnd: TransitionEventHandler<HTMLDivElement> = (event) => {
    if (event.propertyName !== 'transform') return;
    const payload = pendingAnimationRef.current;
    if (!payload) return;

    setSliderTransitionEnabled(false);
    setSliderTransform(0);
    setPendingAnimation(null);
    setCurrentBatchIndex(payload.nextIndex);
    setIsAnimating(false);
  };

  useEffect(() => {
    if (pendingAnimation) return;
    const id = requestAnimationFrame(() => {
      setSliderTransitionEnabled(true);
    });
    return () => cancelAnimationFrame(id);
  }, [pendingAnimation, currentBatchIndex]);

  const pageClasses = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

  const sliderStyle = sliderHeight !== null ? { height: `${sliderHeight}px` } : undefined;

  const sliderInnerStyle: CSSProperties = {
    transform: `translateY(${sliderTransform}px)`,
    transition: sliderTransitionEnabled ? 'transform .55s cubic-bezier(.22,.61,.36,1)' : 'none',
  };

  const renderPage = (items: (Spot | null)[], key: string) => (
    <div key={key} data-page className={pageClasses}>
      {items.map((spot, index) => renderSpotCard(spot, key, index))}
    </div>
  );

  /** Rendu carte (spot ou placeholder) */
  const renderSpotCard = (spot: Spot | null, keyPrefix: string, index: number) => {
    const key = `${keyPrefix}-${spot ? spot.id : 'placeholder'}-${index}`;

    if (!spot) {
      return (
        <div
          key={key}
          className="flex h-full min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-dashed border-dark-700/60 bg-dark-800/40 text-left shadow-lg shadow-black/10"
          role="listitem"
          aria-hidden="true"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-br from-dark-700 via-dark-800 to-dark-900/80 px-6 text-gray-500">
            <span className="rounded-full border border-dark-600/70 bg-dark-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Spot à venir
            </span>
            <span className="text-[11px] uppercase tracking-[0.4em] text-gray-500/80">SkateConnect</span>
            <p className="max-w-[14rem] text-center text-[11px] text-gray-500/70">
              Bientôt disponible — reste à l’affût pour découvrir ce spot.
            </p>
          </div>
        </div>
      );
    }

    const extendedSpot = spot as Spot & { rating?: number; mediaUrl?: string; media_url?: string; difficulty?: number };
    const coverPhotoUrl = coverPhotos?.[spot.id];
    const mediaUrl = coverPhotoUrl ?? extendedSpot.mediaUrl ?? extendedSpot.media_url;
    const rating = Math.max(0, Math.min(5, extendedSpot.rating ?? extendedSpot.difficulty ?? 0));

    return (
      <button
        key={key}
        onClick={() => onSpotClick?.(spot)}
        className="group relative flex h-full min-h-[320px] w-full flex-col overflow-hidden rounded-2xl border border-dark-700/80 bg-dark-800/70 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-1 hover:border-orange-400/50 hover:shadow-orange-900/20"
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

        <div className="flex flex-[2] flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">{spot.name}</h3>
            {(spot as any).creator?.username && (
              <span className="rounded-full border border-dark-600 bg-dark-900/70 px-3 py-1 text-xs text-gray-300">
                @{(spot as any).creator?.username}
              </span>
            )}
          </div>

          {spot.description && <p className="line-clamp-3 text-sm text-gray-200">{spot.description}</p>}

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
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden px-6 pt-6 pb-28 lg:pb-48">
        <div id={gridId} className="relative h-full" role="list">
          <div
            ref={sliderRef}
            className="relative w-full overflow-hidden transition-[height] duration-300 ease-in-out"
            style={sliderStyle}
          >
            <div
              ref={sliderInnerRef}
              className="relative will-change-transform"
              style={sliderInnerStyle}
              onTransitionEnd={handleSliderTransitionEnd}
            >
              {pendingAnimation ? (
                <div className="grid auto-rows-auto" data-stack>
                  {renderPage(pendingAnimation.currentSpots, `current-${currentBatchIndex}`)}
                  {renderPage(pendingAnimation.nextSpots, `upcoming-${pendingAnimation.nextIndex}`)}
                </div>
              ) : (
                renderPage(visibleSpots, `static-${currentBatchIndex}`)
              )}
            </div>
          </div>
        </div>

        {/* CTA sticky (mobile) + CTA flottant (desktop) */}
        {shouldShowToggle && (
          <>
            <div className="sticky bottom-0 -mx-6 mt-6 bg-gradient-to-t from-dark-900 via-dark-900/95 to-dark-900/20 px-6 pb-4 pt-6 lg:hidden">
              <button
                type="button"
                onClick={handleToggle}
                disabled={isAnimating}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-orange-900/30 transition-transform hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
                aria-controls={gridId}
                aria-expanded={isAnimating ? true : false}
              >
                {toggleLabel}
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggle}
              disabled={isAnimating}
              className="hidden lg:fixed lg:bottom-[7.5rem] lg:right-16 lg:z-40 lg:inline-flex lg:min-w-[240px] lg:items-center lg:justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white shadow-lg shadow-orange-900/40 transition-transform hover:-translate-y-1 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
              aria-controls={gridId}
              aria-expanded={isAnimating ? true : false}
            >
              {toggleLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
