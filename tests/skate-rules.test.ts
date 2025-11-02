import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLetters, isFinished } from '../src/lib/skate.js';

test('nextLetters progresses S→K→A→T→E', () => {
  assert.equal(nextLetters(''), 'S');
  assert.equal(nextLetters('S'), 'SK');
  assert.equal(nextLetters('SK'), 'SKA');
  assert.equal(nextLetters('SKA'), 'SKAT');
  assert.equal(nextLetters('SKAT'), 'SKATE');
  assert.equal(nextLetters('SKATE'), 'SKATE');
});

test('isFinished detects SKATE', () => {
  assert.equal(isFinished('SKATE'), true);
  assert.equal(isFinished('SKAT'), false);
});

