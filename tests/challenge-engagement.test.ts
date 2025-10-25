import test from 'node:test';
import assert from 'node:assert/strict';
import { registerForChallengeWithClient } from '../src/lib/engagement.js';
import {
  createChallengeSubmissionWithClient,
  toggleChallengeVoteWithClient,
} from '../src/lib/challenges.js';
import type { ChallengeSubmission } from '../src/types/index.js';

test('registerForChallengeWithClient enregistre un rider via Supabase', async () => {
  const calls: any[] = [];
  const mockClient = {
    from: (table: string) => ({
      upsert: async (payload: unknown, options: unknown) => {
        calls.push({ table, payload, options });
        return { error: null };
      },
    }),
  } as any;

  const result = await registerForChallengeWithClient(mockClient, 'user-1', 'challenge-7');

  assert.equal(result.success, true);
  assert.equal(result.message, 'Inscription confirmée.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.table, 'challenge_participants');
  assert.deepEqual(calls[0]?.payload, { user_id: 'user-1', challenge_id: 'challenge-7' });
});

test('createChallengeSubmissionWithClient retourne la soumission enrichie', async () => {
  const now = new Date().toISOString();
  let lastPayload: any = null;
  const mockClient = {
    from: (table: string) => {
      if (table !== 'challenge_submissions') {
        throw new Error(`Table inattendue: ${table}`);
      }
      return {
        insert: (payload: unknown) => {
          lastPayload = payload;
          const data = {
            id: 'submission-42',
            challenge_id: 'challenge-99',
            user_id: 'user-1',
            media_url: 'https://cdn.test/challenge-99/clip.mp4',
            media_type: 'video',
            caption: 'Un flip dans la descente',
            votes_count: 0,
            is_winner: false,
            created_at: now,
            user: {
              id: 'user-1',
              username: 'flip-master',
              display_name: 'Flip Master',
              avatar_url: null,
              bio: null,
              cover_url: null,
              skill_level: null,
              stance: null,
              role: 'skater',
              created_at: now,
              updated_at: now,
            },
            challenge: {
              id: 'challenge-99',
              created_by: null,
              title: 'Wallride express',
              description: 'Envoie ton plus beau wallride',
              challenge_type: 'community',
              difficulty: 3,
              prize: 'Deck pro modèle',
              start_date: now,
              end_date: now,
              participants_count: 12,
              is_active: true,
              created_at: now,
            },
            voted_by_user: false,
          } as ChallengeSubmission;

          return {
            select: () => ({
              single: async () => ({ data, error: null }),
            }),
          };
        },
      };
    },
  } as any;

  const submission = await createChallengeSubmissionWithClient(mockClient, {
    challengeId: 'challenge-99',
    userId: 'user-1',
    mediaUrl: 'https://cdn.test/challenge-99/clip.mp4',
    mediaType: 'video',
    caption: 'Un flip dans la descente',
  });

  assert.equal(submission.id, 'submission-42');
  assert.equal(submission.media_type, 'video');
  assert.equal(submission.votes_count, 0);
  assert.equal(submission.user?.username, 'flip-master');
  assert.deepEqual(lastPayload, {
    challenge_id: 'challenge-99',
    user_id: 'user-1',
    media_url: 'https://cdn.test/challenge-99/clip.mp4',
    media_type: 'video',
    caption: 'Un flip dans la descente',
  });
});

test('toggleChallengeVoteWithClient incrémente et décrémente les votes', async () => {
  let votesCount = 2;
  const mockClient = {
    from: (table: string) => {
      if (table === 'challenge_votes') {
        return {
          insert: async () => {
            votesCount += 1;
            return { error: null };
          },
          delete: () => ({
            match: async () => {
              votesCount = Math.max(0, votesCount - 1);
              return { error: null };
            },
          }),
        };
      }

      if (table === 'challenge_submissions') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { votes_count: votesCount }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Table inattendue: ${table}`);
    },
  } as any;

  const addResult = await toggleChallengeVoteWithClient(mockClient, 'submission-1', 'user-7', false);
  assert.equal(addResult.voted, true);
  assert.equal(addResult.votesCount, 3);

  const removeResult = await toggleChallengeVoteWithClient(mockClient, 'submission-1', 'user-7', true);
  assert.equal(removeResult.voted, false);
  assert.equal(removeResult.votesCount, 2);
});
