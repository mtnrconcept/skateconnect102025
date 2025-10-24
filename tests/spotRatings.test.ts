import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRatingChange,
  buildSummaryFromSpot,
  emptyRatingDistribution,
  SpotRatingSummary,
} from '../src/lib/ratings.js';

const createSummary = (overrides: Partial<SpotRatingSummary> = {}): SpotRatingSummary => ({
  average: overrides.average ?? 0,
  count: overrides.count ?? 0,
  distribution: overrides.distribution ?? { ...emptyRatingDistribution },
});

test('création de note incrémente la distribution et la moyenne', () => {
  const initialSummary = createSummary();
  const updated = applyRatingChange(initialSummary, { type: 'create', rating: 4 });

  assert.equal(updated.count, 1);
  assert.equal(updated.distribution[4], 1);
  assert.equal(updated.average, 4);
});

test('mise à jour de note déplace correctement les compteurs', () => {
  const initial = createSummary({
    count: 2,
    distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 0 },
    average: 3.5,
  });

  const updated = applyRatingChange(initial, {
    type: 'update',
    rating: 5,
    previousRating: 3,
  });

  assert.equal(updated.distribution[3], 0);
  assert.equal(updated.distribution[5], 1);
  assert.equal(updated.count, 2);
  assert.equal(updated.average, 4.5);
});

test('agrégat à partir du spot reconstruit une moyenne cohérente', () => {
  const summary = buildSummaryFromSpot({
    rating_distribution: {
      1: 1,
      2: 0,
      3: 2,
      4: 3,
      5: 4,
    },
    rating_count: null,
    rating_average: null,
  });

  assert.equal(summary.count, 10);
  assert.equal(summary.average, 3.9);
});
