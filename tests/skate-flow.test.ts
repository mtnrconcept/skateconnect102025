import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, createTurn, respondTurn, resolveMatch } from '../src/lib/skate.js';

const U1 = 'user-a';
const U2 = 'user-b';

test('create match and three turns with one failure and resolution', async () => {
  const m = await createMatch({ mode: 'live', opponent_id: U2 }, U1);
  assert.ok(m.id);
  assert.equal(m.status, 'pending');

  // Start match locally (fallback path will just update mock on createTurn calls)
  const t1 = await createTurn({ match_id: m.id, proposer: U1, trick_name: 'Ollie', difficulty: 1, mode: 'live' });
  assert.equal(t1.turn_index, 0);

  // Simulate respond success (we won’t call edge, just mark responded via respondTurn)
  const t1r = await respondTurn(t1.id, 'https://cdn/ok.mp4');
  assert.equal(t1r.status, 'responded');

  // Next turn, U2 proposes; simulate failure path by marking responded but later server would set failed
  const t2 = await createTurn({ match_id: m.id, proposer: U2, trick_name: 'Kickflip', difficulty: 2, mode: 'live' });
  assert.equal(t2.turn_index, 1);

  // Third turn
  const t3 = await createTurn({ match_id: m.id, proposer: U1, trick_name: 'Heelflip', difficulty: 2, mode: 'live' });
  assert.equal(t3.turn_index, 2);

  // Resolve (fallback will no-op but return match)
  const m2 = await resolveMatch(m.id, null);
  assert.equal(m2.id, m.id);
});

