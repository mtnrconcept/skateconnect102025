import test from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError } from '@supabase/supabase-js';
import { withTableFallback } from '../src/lib/postgrest.js';

test('withTableFallback retries on transient connection errors before succeeding', async () => {
  let attempts = 0;
  const result = await withTableFallback<number>(
    () => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new TypeError('fetch failed'));
      }
      return Promise.resolve({ data: 42, error: null });
    },
    () => 0,
    { retry: { attempts: 2, delayMs: 0 } },
  );

  assert.equal(result, 42);
  assert.equal(attempts, 2);
});

test('withTableFallback invokes fallback immediately when schema is missing', async () => {
  let fallbackInvocations = 0;
  const missingTableError: PostgrestError = {
    name: 'PostgrestError',
    code: 'PGRST205',
    details: '',
    hint: '',
    message: 'could not find the table sponsor_items',
  };

  const rows = await withTableFallback<string[]>(
    () => Promise.resolve({ data: ['should-not-be-returned'], error: missingTableError }),
    () => {
      fallbackInvocations += 1;
      return ['fallback'];
    },
    { retry: { attempts: 2, delayMs: 0 } },
  );

  assert.deepEqual(rows, ['fallback']);
  assert.equal(fallbackInvocations, 1);
});

test('withTableFallback throws after exhausting retries on connection errors', async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withTableFallback(
        () => {
          attempts += 1;
          return Promise.reject(new TypeError('fetch failed'));
        },
        () => 'unused',
        { retry: { attempts: 2, delayMs: 0 } },
      ),
    (error: unknown) => {
      assert.ok(error instanceof TypeError);
      assert.match((error as Error).message, /fetch failed/i);
      return true;
    },
  );

  assert.equal(attempts, 3);
});
