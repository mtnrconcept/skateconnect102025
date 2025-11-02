import { supabase } from './supabase.js';
import type {
  MatchMode,
  MatchStatus,
  TurnStatus,
  SkateMatchRow,
  SkateTurnRow,
} from '../types';

function nowIso() { return new Date().toISOString(); }

export async function createMatch(params: { mode: MatchMode; opponent_id: string }, userId: string): Promise<SkateMatchRow> {
  const row: SkateMatchRow = {
    id: crypto.randomUUID(),
    mode: params.mode,
    player_a: userId,
    player_b: params.opponent_id,
    status: 'pending',
    letters_a: '',
    letters_b: '',
    winner: null,
    created_at: nowIso(),
    started_at: null,
    finished_at: null,
  };

  const { data, error } = await supabase.from('skate_matches').insert(row).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('Failed to create match');
  return data;
}

export async function startMatch(matchId: string): Promise<SkateMatchRow> {
  const { data, error } = await supabase
    .from('skate_matches')
    .update({ status: 'active', started_at: nowIso() })
    .eq('id', matchId)
    .select('*')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Failed to start match');
  return data;
}

export async function createTurn(params: {
  match_id: string;
  proposer: string;
  trick_name?: string;
  difficulty?: number;
  mode: MatchMode;
}): Promise<SkateTurnRow> {
  const { data: lastTurn, error: fetchError } = await supabase
    .from('skate_turns')
    .select('turn_index')
    .eq('match_id', params.match_id)
    .order('turn_index', { ascending: false })
    .limit(1);
  if (fetchError) throw fetchError;
  const idx = (lastTurn?.[0]?.turn_index ?? -1) + 1;
  const row: SkateTurnRow = {
    id: crypto.randomUUID(),
    match_id: params.match_id,
    turn_index: idx,
    proposer: params.proposer,
    trick_name: params.trick_name ?? null,
    difficulty: params.difficulty ?? null,
    video_a_url: null,
    video_b_url: null,
    status: 'proposed',
    remote_deadline: params.mode === 'remote' ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null,
    meta_a: {},
    meta_b: {},
    created_at: nowIso(),
  };

  const { data, error } = await supabase.from('skate_turns').insert(row).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('Failed to create turn');
  return data;
}

export async function respondTurn(turnId: string, videoUrl: string): Promise<SkateTurnRow> {
  const { data, error } = await supabase
    .from('skate_turns')
    .update({ video_b_url: videoUrl, status: 'responded' as TurnStatus })
    .eq('id', turnId)
    .select('*')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Failed to respond to turn');
  return data;
}

export async function resolveMatch(matchId: string, winnerId: string | null): Promise<SkateMatchRow> {
  const patch: Partial<SkateMatchRow> = { status: 'finished' as MatchStatus, finished_at: nowIso(), winner: winnerId };
  const { data, error } = await supabase
    .from('skate_matches')
    .update(patch)
    .eq('id', matchId)
    .select('*')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Failed to resolve match');
  return data;
}

const LETTERS = ['S','K','A','T','E'] as const;
export function nextLetters(current: string): string {
  const clean = (current || '').toUpperCase().replace(/[^SKATE]/g, '');
  const have = new Set(clean.split(''));
  for (const L of LETTERS) {
    if (!have.has(L)) return (clean + L).slice(0,5);
  }
  return 'SKATE';
}

export function isFinished(letters: string): boolean {
  return (letters || '').toUpperCase() === 'SKATE';
}

// Create GOS match (self-referee system)
export async function createGOSMatch(riderA: string, riderB: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('gos_match')
    .insert({
      rider_a: riderA,
      rider_b: riderB,
      turn: 'A',
      letters_a: 0,
      letters_b: 0,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create GOS match');

  // Post initial system message
  await supabase.from('gos_chat_message').insert({
    match_id: data.id,
    sender: null,
    kind: 'system',
    text: 'Match démarré. Rider A commence.',
  });

  return { id: data.id };
}

