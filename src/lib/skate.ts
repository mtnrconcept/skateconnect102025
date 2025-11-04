// src/lib/skate.ts
import { supabase } from './supabaseClient';
import { withTableFallback } from './postgrest';
import type {
  MatchMode,
  MatchStatus,
  TurnStatus,
  SkateMatchRow,
  SkateTurnRow,
} from '../types';

/* ============================================================================
 * Env & utils
 * ========================================================================== */
const nowIso = () => new Date().toISOString();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant (env vite) pour appeler gos-match');
if (!SUPABASE_ANON_KEY) throw new Error('VITE_SUPABASE_ANON_KEY manquant pour header apikey');

/* ============================================================================
 * MOCKS (fallback dev sans schéma)
 * ========================================================================== */
const mock: { matches: SkateMatchRow[]; turns: SkateTurnRow[] } = { matches: [], turns: [] };

/* ============================================================================
 * CRUD LOCAL (skate_matches / skate_turns)
 * ========================================================================== */
export async function createMatch(
  params: { mode: MatchMode; opponent_id: string },
  userId: string
): Promise<SkateMatchRow> {
  const row: SkateMatchRow = {
    id: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
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

  return withTableFallback(
    supabase.from('skate_matches').insert(row).select('*').single(),
    () => { mock.matches.push(row); return row; }
  );
}

export async function startMatch(matchId: string): Promise<SkateMatchRow> {
  return withTableFallback(
    supabase
      .from('skate_matches')
      .update({ status: 'active', started_at: nowIso() })
      .eq('id', matchId)
      .select('*')
      .single(),
    () => {
      const m = mock.matches.find((x) => x.id === matchId);
      if (m) { m.status = 'active'; m.started_at = nowIso(); }
      return m as SkateMatchRow;
    }
  );
}

export async function createTurn(params: {
  match_id: string;
  proposer: string;
  trick_name?: string;
  difficulty?: number;
  mode: MatchMode;
}): Promise<SkateTurnRow> {
  const idx = mock.turns.filter((t) => t.match_id === params.match_id).length;
  const row: SkateTurnRow = {
    id: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    match_id: params.match_id,
    turn_index: idx,
    proposer: params.proposer,
    trick_name: params.trick_name ?? null,
    difficulty: params.difficulty ?? null,
    video_a_url: null,
    video_b_url: null,
    status: 'proposed',
    remote_deadline: params.mode === 'remote'
      ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      : null,
    meta_a: {},
    meta_b: {},
    created_at: nowIso(),
  };

  return withTableFallback(
    supabase.from('skate_turns').insert(row).select('*').single(),
    () => { mock.turns.push(row); return row; }
  );
}

export async function respondTurn(turnId: string, videoUrl: string): Promise<SkateTurnRow> {
  return withTableFallback(
    supabase
      .from('skate_turns')
      .update({ video_b_url: videoUrl, status: 'responded' as TurnStatus })
      .eq('id', turnId)
      .select('*')
      .single(),
    () => {
      const t = mock.turns.find((x) => x.id === turnId);
      if (t) { t.video_b_url = videoUrl; t.status = 'responded'; }
      return t as SkateTurnRow;
    }
  );
}

export async function resolveMatch(matchId: string, winnerId: string | null): Promise<SkateMatchRow> {
  const patch: Partial<SkateMatchRow> = {
    status: 'finished' as MatchStatus,
    finished_at: nowIso(),
    winner: winnerId,
  };
  return withTableFallback(
    supabase.from('skate_matches').update(patch).eq('id', matchId).select('*').single(),
    () => {
      const m = mock.matches.find((x) => x.id === matchId);
      if (m) { m.status = 'finished'; m.finished_at = nowIso(); m.winner = winnerId; }
      return m as SkateMatchRow;
    }
  );
}

/* ============================================================================
 * Helpers lettres
 * ========================================================================== */
const LETTERS = ['S','K','A','T','E'] as const;
export const nextLetters = (current: string) => {
  const clean = (current || '').toUpperCase().replace(/[^SKATE]/g, '');
  const have = new Set(clean.split(''));
  for (const L of LETTERS) if (!have.has(L)) return (clean + L).slice(0,5);
  return 'SKATE';
};
export const isFinished = (letters: string) => (letters || '').toUpperCase() === 'SKATE';

/* ============================================================================
 * Edge Function gos-match — fetch direct (récupère body d’erreur) + apikey
 * ========================================================================== */
function logGosError(context: string, status: number, detail: string, payload?: Record<string, unknown>) {
  const safePayload = payload ? JSON.parse(JSON.stringify(payload)) : undefined;
  // eslint-disable-next-line no-console
  console.error(`[gos-match] ${context} -> ${status} ${detail}`, safePayload);
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('gos-match 401: no active session token');
  return {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
}

async function invokeGOS<T>(payload: Record<string, unknown>): Promise<T> {
  const headers = await authHeaders();
  const url = `${SUPABASE_URL}/functions/v1/gos-match`;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const text = await res.text();

  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* texte brut */ }

  if (!res.ok) {
    const detail = json?.error ?? json?.message ?? (text || res.statusText || 'Edge Function error');
    try { logGosError((payload?.['action'] as string) || 'unknown', res.status, String(detail), payload); } catch {}
    throw new Error(`gos-match ${res.status}: ${detail}`);
  }
  return json as T;
}

/* ============================================================================
 * Orchestrateur GOS <-> local (garantit skate_match_id)
 * ========================================================================== */
export async function createLocalSkateMatch(opponent_id: string, mode: MatchMode, me: string): Promise<SkateMatchRow> {
  const row: SkateMatchRow = {
    id: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    mode,
    player_a: me,
    player_b: opponent_id,
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
  return data as SkateMatchRow;
}

export async function attachSkateMatchId(gosMatchId: string, skateMatchId: string) {
  await invokeGOS<{ match: unknown }>({
    action: 'attach_skate_match',
    match_id: gosMatchId,
    skate_match_id: skateMatchId,
  });
}

/**
 * S’assure qu’un gos_match possède un skate_match_id exploitable côté UI.
 * - Si déjà présent: le retourne
 * - Sinon: crée un skate_matches local, l’attache côté Edge, et retourne son id
 */
export async function ensureSkateMatchForGOS(gosMatchId: string): Promise<string> {
  const { data: gos, error } = await supabase
    .from('gos_match')
    .select('id, rider_a, rider_b, skate_match_id')
    .eq('id', gosMatchId)
    .single();
  if (error) throw error;

  if (gos.skate_match_id) return gos.skate_match_id as string;

  const { data: { session } } = await supabase.auth.getSession();
  const me = session?.user?.id!;
  const opponent = me === gos.rider_a ? gos.rider_b : gos.rider_a;

  const local = await createLocalSkateMatch(opponent, 'live' as MatchMode, me);
  await attachSkateMatchId(gosMatchId, local.id);
  return local.id;
}

/* ============================================================================
 * API client GOS alignée avec la Function
 * ========================================================================== */
export async function createGOSMatchWithLocal(
  opponentId: string,
  options?: { inviterName?: string; mode?: MatchMode }
): Promise<{ gosMatchId: string; skateMatchId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const me = session?.user?.id;
  if (!me) throw new Error('gos-match 401: utilisateur non authentifié');
  if (!opponentId || opponentId === me) throw new Error('Sélectionne un adversaire valide.');

  // 1) Local
  const local = await createMatch(
    { mode: options?.mode ?? ('live' as MatchMode), opponent_id: opponentId },
    me
  );

  // 2) Edge (transporte skate_match_id)
  const res = await invokeGOS<{ match: { id: string } }>({
    action: 'create',
    opponent_id: opponentId,
    inviter_name: options?.inviterName ?? null,
    skate_match_id: local.id,
  });

  return { gosMatchId: res.match.id, skateMatchId: local.id };
}

export async function createGOSMatch(
  _riderA: string,
  opponentId: string,
  options?: { inviterName?: string }
): Promise<{ id: string }> {
  const out = await createGOSMatchWithLocal(opponentId, { inviterName: options?.inviterName });
  return { id: out.gosMatchId };
}

export async function acceptGOSMatch(matchId: string, countdownSeconds?: number): Promise<void> {
  await invokeGOS<{ match: unknown }>({
    action: 'accept',
    match_id: matchId,
    ...(Number.isFinite(countdownSeconds) ? { countdown_s: Math.floor(Number(countdownSeconds)) } : {}),
  });
}

export async function declineGOSMatch(matchId: string): Promise<void> {
  await invokeGOS<{ match: unknown }>({ action: 'decline', match_id: matchId });
}

export async function gosFailSet(matchId: string): Promise<any> {
  const result = await invokeGOS<{ match: any }>({ action: 'set_fail', match_id: matchId });
  return result.match;
}

export async function gosAddLetter(matchId: string, side: 'A' | 'B', lettersSet?: string): Promise<any> {
  const payload: Record<string, unknown> = { action: 'add_letter', match_id: matchId, side };
  if (lettersSet && lettersSet.trim()) payload.letters_set = lettersSet.trim().toUpperCase();
  const result = await invokeGOS<{ match: any }>(payload);
  return result.match;
}

export async function gosPostChat(
  matchId: string,
  kind: 'text' | 'system' | 'event',
  text: string | null,
  payload?: unknown
): Promise<void> {
  await invokeGOS<{ message: any }>({
    action: 'chat',
    match_id: matchId,
    kind,
    text,
    payload: payload ?? null,
  });
}
