import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCommunityEvents, createCommunityEvent } from '../src/lib/communityEvents.js';
import { supabase } from '../src/lib/supabase.js';

const missingTableError = { code: 'PGRST205', message: 'missing table community_events' } as const;

test('fetchCommunityEvents returns an empty list when the community_events table is missing', async () => {
  const originalFrom = supabase.from;
  (supabase as any).from = (table: string) => {
    if (table === 'community_events') {
      return {
        select: () => ({
          order: async () => ({ data: null, error: missingTableError }),
        }),
      };
    }

    throw new Error(`Unexpected table requested in test: ${table}`);
  };

  try {
    const events = await fetchCommunityEvents();
    assert.deepEqual(events, []);
  } finally {
    (supabase as any).from = originalFrom;
  }
});

test('createCommunityEvent renvoie un message clair quand la table est absente', async () => {
  const originalFrom = supabase.from;
  (supabase as any).from = (table: string) => {
    if (table === 'community_events') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: missingTableError }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table requested in test: ${table}`);
  };

  try {
    await assert.rejects(
      () =>
        createCommunityEvent({
          title: 'Session communautaire',
          description: 'On se retrouve pour shredder le park !',
          date: '2024-05-01',
          time: '10h00 - 12h00',
          location: 'Skatepark République',
          type: 'Contest',
          createdBy: 'user-123',
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          'La table Supabase "community_events" est introuvable. Exécute les migrations communauté ou expose la vue correspondante.',
        );
        return true;
      },
    );
  } finally {
    (supabase as any).from = originalFrom;
  }
});
