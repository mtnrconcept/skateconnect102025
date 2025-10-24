import type { Spot, SpotRating, RatingDistribution, RatingBucket } from '../types';

export const emptyRatingDistribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

export interface SpotRatingSummary {
  average: number;
  count: number;
  distribution: RatingDistribution;
}

export interface RatingMutation {
  type: 'create' | 'update' | 'delete';
  rating: RatingBucket;
  previousRating?: RatingBucket;
}

export const MAX_RATING_COMMENT_LENGTH = 280;

export function normalizeRatingDistribution(
  distribution?: Partial<Record<string | number, number>> | null
): RatingDistribution {
  const result: RatingDistribution = { ...emptyRatingDistribution };

  if (!distribution) {
    return result;
  }

  const buckets: RatingBucket[] = [1, 2, 3, 4, 5];

  buckets.forEach((bucketKey) => {
    const directValue = distribution[bucketKey];
    const stringValue = distribution[String(bucketKey)];
    const value = typeof directValue === 'number' ? directValue : typeof stringValue === 'number' ? stringValue : 0;

    result[bucketKey] = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
  });

  return result;
}

export function calculateAverageFromDistribution(distribution: RatingDistribution): number {
  const counts = Object.values(distribution);
  const totalCount = counts.reduce((acc, value) => acc + value, 0);

  if (totalCount === 0) {
    return 0;
  }

  const weightedSum = (Object.entries(distribution) as Array<[string, number]>).reduce((acc, [bucket, value]) => {
    return acc + Number(bucket) * value;
  }, 0);

  const average = weightedSum / totalCount;
  return Math.round((average + Number.EPSILON) * 100) / 100;
}

export function buildSummaryFromSpot(spot: Partial<Spot> | null | undefined): SpotRatingSummary {
  const distribution = normalizeRatingDistribution(spot?.rating_distribution ?? null);
  const providedCount = typeof spot?.rating_count === 'number' ? spot.rating_count : Number(spot?.rating_count ?? 0);
  const computedCount = Object.values(distribution).reduce((acc, value) => acc + value, 0);
  const count = providedCount > 0 ? providedCount : computedCount;

  let average = typeof spot?.rating_average === 'number' ? spot.rating_average : null;
  if (average === null || !Number.isFinite(average)) {
    average = calculateAverageFromDistribution(distribution);
  }

  return {
    average: Math.round((Number(average) + Number.EPSILON) * 100) / 100,
    count,
    distribution,
  };
}

export function applyRatingChange(
  summary: SpotRatingSummary,
  mutation: RatingMutation
): SpotRatingSummary {
  const distribution: RatingDistribution = { ...summary.distribution };

  switch (mutation.type) {
    case 'create': {
      distribution[mutation.rating] = (distribution[mutation.rating] ?? 0) + 1;
      break;
    }
    case 'update': {
      if (mutation.previousRating) {
        distribution[mutation.previousRating] = Math.max(0, (distribution[mutation.previousRating] ?? 0) - 1);
      }
      distribution[mutation.rating] = (distribution[mutation.rating] ?? 0) + 1;
      break;
    }
    case 'delete': {
      distribution[mutation.rating] = Math.max(0, (distribution[mutation.rating] ?? 0) - 1);
      break;
    }
    default:
      break;
  }

  const nextCount = Object.values(distribution).reduce((acc, value) => acc + value, 0);
  const nextAverage = calculateAverageFromDistribution(distribution);

  return {
    average: nextAverage,
    count: nextCount,
    distribution,
  };
}

export function ratingToStars(rating: number): Array<boolean> {
  return Array.from({ length: 5 }, (_, index) => index < rating);
}

export function toSpotRatingSummary(ratings: SpotRating[]): SpotRatingSummary {
  return ratings.reduce(
    (acc, rating) => applyRatingChange(acc, { type: 'create', rating: rating.rating as RatingBucket }),
    { average: 0, count: 0, distribution: { ...emptyRatingDistribution } }
  );
}
