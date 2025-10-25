import { supabase } from './supabase.js';
import type { ChallengeSubmission } from '../types';

type SupabaseClient = typeof supabase;

interface SubmissionPayload {
  challengeId: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption?: string;
}

interface ToggleVoteResult {
  voted: boolean;
  votesCount: number;
}

const PROFILE_FIELDS = 'id, username, display_name, avatar_url';
const CHALLENGE_FIELDS = 'id, title, challenge_type, prize';

export async function fetchChallengeSubmissionsWithClient(
  client: SupabaseClient,
  challengeId: string,
  currentUserId?: string,
): Promise<ChallengeSubmission[]> {
  const { data, error } = await client
    .from('challenge_submissions')
    .select(
      `*,
      user:profiles(${PROFILE_FIELDS}),
      challenge:challenges(${CHALLENGE_FIELDS})`
    )
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const submissions = (data || []) as ChallengeSubmission[];

  if (!currentUserId || submissions.length === 0) {
    return submissions;
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const { data: voteRows, error: votesError } = await client
    .from('challenge_votes')
    .select('submission_id, user_id')
    .in('submission_id', submissionIds);

  if (votesError) {
    console.warn('Unable to load challenge votes metadata:', votesError);
    return submissions;
  }

  const votedSet = new Set(
    (voteRows || [])
      .filter((row) => row.user_id === currentUserId)
      .map((row) => row.submission_id),
  );

  return submissions.map((submission) => ({
    ...submission,
    voted_by_user: votedSet.has(submission.id),
  }));
}

export async function fetchChallengeSubmissions(
  challengeId: string,
  currentUserId?: string,
): Promise<ChallengeSubmission[]> {
  return fetchChallengeSubmissionsWithClient(supabase, challengeId, currentUserId);
}

export async function createChallengeSubmissionWithClient(
  client: SupabaseClient,
  payload: SubmissionPayload,
): Promise<ChallengeSubmission> {
  const { data, error } = await client
    .from('challenge_submissions')
    .insert({
      challenge_id: payload.challengeId,
      user_id: payload.userId,
      media_url: payload.mediaUrl,
      media_type: payload.mediaType,
      caption: payload.caption || '',
    })
    .select(
      `*,
      user:profiles(${PROFILE_FIELDS}),
      challenge:challenges(${CHALLENGE_FIELDS})`
    )
    .single();

  if (error) {
    throw error;
  }

  return data as ChallengeSubmission;
}

export async function createChallengeSubmission(payload: SubmissionPayload): Promise<ChallengeSubmission> {
  return createChallengeSubmissionWithClient(supabase, payload);
}

export async function toggleChallengeVoteWithClient(
  client: SupabaseClient,
  submissionId: string,
  userId: string,
  hasVoted: boolean,
): Promise<ToggleVoteResult> {
  if (hasVoted) {
    const { error } = await client
      .from('challenge_votes')
      .delete()
      .match({ submission_id: submissionId, user_id: userId });

    if (error) {
      throw error;
    }
  } else {
    const { error } = await client
      .from('challenge_votes')
      .insert({ submission_id: submissionId, user_id: userId });

    if (error) {
      throw error;
    }
  }

  const { data, error: countError } = await client
    .from('challenge_submissions')
    .select('votes_count')
    .eq('id', submissionId)
    .single();

  if (countError) {
    throw countError;
  }

  return {
    voted: !hasVoted,
    votesCount: data?.votes_count ?? 0,
  };
}

export async function toggleChallengeVote(
  submissionId: string,
  userId: string,
  hasVoted: boolean,
): Promise<ToggleVoteResult> {
  return toggleChallengeVoteWithClient(supabase, submissionId, userId, hasVoted);
}

export async function fetchSubmissionHistoryWithClient(
  client: SupabaseClient,
  userId: string,
): Promise<ChallengeSubmission[]> {
  const { data, error } = await client
    .from('challenge_submissions')
    .select(
      `*,
      user:profiles(${PROFILE_FIELDS}),
      challenge:challenges(${CHALLENGE_FIELDS})`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as ChallengeSubmission[];
}

export async function fetchSubmissionHistory(userId: string): Promise<ChallengeSubmission[]> {
  return fetchSubmissionHistoryWithClient(supabase, userId);
}
