// src/lib/skate.ts
import { supabase } from './supabaseClient';
import { SUPABASE_URL } from './supabase';
import { withTableFallback } from './postgrest';
import type {
  MatchMode,
  MatchStatus,
  TurnStatus,
  SkateMatchRow,
  SkateTurnRow,
} from '../types';

type TurnIndexRow = Pick<SkateTurnRow, 'turn_index'>;

/* ============================================================================
 * Env & utils
 * ========================================================================== */
const nowIso = () => new Date().toISOString();

function assertNonNull<T>(value: T | null, context: string): T {
  if (value === null || value === undefined) {
    throw new Error(context);
  }
  return value;
}

if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL manquant (env vite) pour appeler gos-match');

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

  const insertMatch = async () => {
    const { data, error } = await supabase.from('skate_matches').insert(row).select('*').single();
    return { data: data ?? null, error };
  };

  const inserted = await withTableFallback<SkateMatchRow | null>(
    insertMatch,
    () => {
      mock.matches.push(row);
      return row;
    }
  );

  return assertNonNull(inserted, 'La création du match a échoué (skate_matches).');
}

export async function startMatch(matchId: string): Promise<SkateMatchRow> {
  const activateMatch = async () => {
    const { data, error } = await supabase
      .from('skate_matches')
      .update({ status: 'active', started_at: nowIso() })
      .eq('id', matchId)
      .select('*')
      .single();
    return { data: data ?? null, error };
  };

  const started = await withTableFallback<SkateMatchRow | null>(
    activateMatch,
    () => {
      const m = mock.matches.find((x) => x.id === matchId);
      if (m) { m.status = 'active'; m.started_at = nowIso(); }
      return m ?? null;
    }
  );

  return assertNonNull(started, 'Impossible de démarrer le match (skate_matches).');
}

export async function createTurn(params: {
  match_id: string;
  proposer: string;
  trick_name?: string;
  difficulty?: number;
  mode: MatchMode;
}): Promise<SkateTurnRow> {
  const fetchLastTurn = async () => {
    const { data, error } = await supabase
      .from('skate_turns')
      .select('turn_index')
      .eq('match_id', params.match_id)
      .order('turn_index', { ascending: false })
      .limit(1);
    return { data: data ?? [], error };
  };

  const lastTurns = await withTableFallback<TurnIndexRow[]>(
    fetchLastTurn,
    () => {
      const sorted = mock.turns
        .filter((t) => t.match_id === params.match_id)
        .sort((a, b) => b.turn_index - a.turn_index);
      return sorted.length ? [{ turn_index: sorted[0].turn_index }] : [];
    }
  );
  const idx = (lastTurns?.[0]?.turn_index ?? -1) + 1;
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

  const insertTurn = async () => {
    const { data, error } = await supabase.from('skate_turns').insert(row).select('*').single();
    return { data: data ?? null, error };
  };

  const inserted = await withTableFallback<SkateTurnRow | null>(
    insertTurn,
    () => {
      mock.turns.push(row);
      return row;
    }
  );

  return assertNonNull(inserted, 'Impossible de créer le tour (skate_turns).');
}

export async function respondTurn(turnId: string, videoUrl: string): Promise<SkateTurnRow> {
  const updateTurn = async () => {
    const { data, error } = await supabase
      .from('skate_turns')
      .update({ video_b_url: videoUrl, status: 'responded' as TurnStatus })
      .eq('id', turnId)
      .select('*')
      .single();
    return { data: data ?? null, error };
  };

  const responded = await withTableFallback<SkateTurnRow | null>(
    updateTurn,
    () => {
      const t = mock.turns.find((x) => x.id === turnId);
      if (t) { t.video_b_url = videoUrl; t.status = 'responded'; }
      return t ?? null;
    }
  );

  return assertNonNull(responded, 'Impossible de mettre à jour le tour (skate_turns).');
}

export async function resolveMatch(matchId: string, winnerId: string | null): Promise<SkateMatchRow> {
  const patch: Partial<SkateMatchRow> = {
    status: 'finished' as MatchStatus,
    finished_at: nowIso(),
    winner: winnerId,
  };
  const finalizeMatch = async () => {
    const { data, error } = await supabase
      .from('skate_matches')
      .update(patch)
      .eq('id', matchId)
      .select('*')
      .single();
    return { data: data ?? null, error };
  };

  const resolved = await withTableFallback<SkateMatchRow | null>(
    finalizeMatch,
    () => {
      const m = mock.matches.find((x) => x.id === matchId);
      if (m) { m.status = 'finished'; m.finished_at = nowIso(); m.winner = winnerId; }
      return m ?? null;
    }
  );

  return assertNonNull(resolved, 'Impossible de clôturer le match (skate_matches).');
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
 * Edge Function gos-match — fetch direct (récupère body d'erreur) + apikey
 * ========================================================================== */
function logGosError(context: string, status: number, detail: string, payload?: Record<string, unknown>) {
  const safePayload = payload ? JSON.parse(JSON.stringify(payload)) : undefined;
  // eslint-disable-next-line no-console
  console.error(`[gos-match] ${context} -> ${status} ${detail}`, safePayload);
}

async function invokeGOS<T>(payload: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const endpoint = `${SUPABASE_URL}/functions/v1/gos-match`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* texte brut */
    }

    if (!res.ok) {
      const detail = json?.error ?? json?.message ?? (text || res.statusText || 'Edge Function error');
      try {
        logGosError((payload?.['action'] as string) || 'unknown', res.status, String(detail), payload);
      } catch {}
      throw new Error(`gos-match ${res.status}: ${detail}`);
    }

    return json as T;
  } catch (browserError) {
    if (typeof window !== 'undefined') {
      throw browserError instanceof Error ? browserError : new Error('Edge Function invocation failed');
    }

    const { data, error } = await supabase.functions.invoke<T>('gos-match', {
      body: payload,
    });
    if (error) {
      throw Object.assign(new Error(error.message ?? 'Edge Function error'), error);
    }
    return data as T;
  }
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
 * S'assure qu'un gos_match possède un skate_match_id exploitable côté UI.
 * - Si déjà présent: le retourne
 * - Sinon: crée un skate_matches local, l'attache côté Edge, et retourne son id
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
  const res = await invokeGOS<{ match: { id: string } }>(Object.assign(
    {
      action: 'create',
      opponent_id: opponentId,
      inviter_name: options?.inviterName ?? null,
      skate_match_id: local.id,
    },
    {}
  ));

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

// ✅ FONCTION CORRIGÉE
export async function markGOSMatchActive(
  matchId: string,
  countdownSeconds = 5,
  riderIdOverride?: string,
): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }
  const effectiveRiderId = riderIdOverride ?? session?.user?.id ?? null;

  const { data: gosMatch, error: fetchError } = await supabase
    .from('gos_match')
    .select('id,rider_a,rider_b,status,skate_match_id,accepted_at,starts_at')
    .eq('id', matchId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!gosMatch) {
    throw new Error('Match introuvable');
  }

  if (effectiveRiderId && gosMatch && ![gosMatch.rider_a, gosMatch.rider_b].includes(effectiveRiderId)) {
    console.warn('[gos] Impossible de marquer le match actif: le rider courant ne participe pas au duel');
  }

  if (gosMatch.status === 'ended' || gosMatch.status === 'cancelled') {
    return;
  }

  const acceptedAt = gosMatch.accepted_at ?? nowIso();
  const plannedStart = gosMatch.starts_at ?? new Date(Date.now() + Math.max(0, countdownSeconds) * 1000).toISOString();

  const patch: Record<string, string> = {};
  if (gosMatch.status !== 'active') {
    patch.status = 'active';
  }
  if (!gosMatch.accepted_at) {
    patch.accepted_at = acceptedAt;
  }
  if (!gosMatch.starts_at) {
    patch.starts_at = plannedStart;
  }

  let activationStart = gosMatch.starts_at ?? plannedStart;
  let skateMatchId = (gosMatch.skate_match_id as string | null) ?? null;

  // ✅ CORRECTION : Séparer l'update du select pour éviter l'erreur 400
  if (Object.keys(patch).length > 0) {
    // 1) D'abord faire l'UPDATE sans select
    const { error: updateError } = await supabase
      .from('gos_match')
      .update(patch)
      .eq('id', matchId);

    if (updateError) {
      throw updateError;
    }

    // 2) Ensuite récupérer les données dans une requête séparée
    const { data: refreshedMatch, error: selectError } = await supabase
      .from('gos_match')
      .select('skate_match_id, starts_at')
      .eq('id', matchId)
      .single();

    if (selectError) {
      console.warn('[gos] Unable to refresh match data after update', selectError);
    } else if (refreshedMatch) {
      if (refreshedMatch.skate_match_id) {
        skateMatchId = refreshedMatch.skate_match_id as string;
      }
      activationStart = refreshedMatch.starts_at ?? activationStart;
    }
  }

  // Mise à jour du skate_match si présent
  if (skateMatchId) {
    const { error: skateError } = await supabase
      .from('skate_matches')
      .update({
        status: 'active',
        started_at: activationStart,
      })
      .eq('id', skateMatchId)
      .neq('status', 'finished');

    if (skateError && (skateError as any)?.code !== 'PGRST116') {
      console.warn('[gos] Unable to update skate_matches status', skateError);
    }
  }
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

/* ============================================================================
 * 🏁 Auto-END RULES (demandé) : 
 * 1) statut gos_match -> 'ended' si message "Vainqueur : Rider A/B"
 * 2) statut gos_match -> 'ended' si un rider quitte la salle
 * ========================================================================== */

/** Met fin au match côté gos_match (best-effort côté client). */
export async function endGOSMatch(
  matchId: string,
  opts?: { winner?: 'A' | 'B'; reason?: 'victory' | 'leave' }
): Promise<void> {
  const patch: Record<string, any> = { status: 'ended' };
  if (opts?.winner === 'A' || opts?.winner === 'B') patch.winner = opts.winner;

  const { error } = await supabase
    .from('gos_match')
    .update(patch)
    .eq('id', matchId);

  if (error) {
    console.warn('[gos] endGOSMatch failed', error, { matchId, opts });
  }
}

/** Abonnement Realtime : si un INSERT gos_chat contient "Vainqueur : Rider A/B" -> on termine le match. */
export function subscribeVictoryAutoEnd(matchId: string) {
  const channel = supabase.channel(`gos_chat_victory_${matchId}`).on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'gos_chat', filter: `match_id=eq.${matchId}` },
    async (payload: any) => {
      const text = (payload?.new?.text ?? payload?.new?.content ?? '') as string;
      if (typeof text !== 'string') return;

      if (text.startsWith('Vainqueur : Rider A')) {
        await endGOSMatch(matchId, { winner: 'A', reason: 'victory' });
      } else if (text.startsWith('Vainqueur : Rider B')) {
        await endGOSMatch(matchId, { winner: 'B', reason: 'victory' });
      }
    }
  );

  channel.subscribe();
  return () => supabase.removeChannel(channel);
}

/**
 * Termine le match si le rider QUITTE la room (navigation/fermeture).
 * - Délai 4s pour tolérer un simple refresh ou un switch d’onglet court.
 * - À appeler dans le composant de la room (montage → retour cleanup au démontage).
 */
export function setupEndOnLeave(matchId: string, riderId: string) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  let timeout: number | null = null;
  let ended = false;

  const triggerEnd = async () => {
    if (ended) return;
    ended = true;
    await endGOSMatch(matchId, { reason: 'leave' });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      // L’onglet passe en arrière-plan → on temporise
      timeout = window.setTimeout(triggerEnd, 4000);
    } else {
      // Retour à l’onglet → annule le end planifié
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    }
  };

  const onBeforeUnload = () => {
    // Tentative best-effort avant fermeture
    void endGOSMatch(matchId, { reason: 'leave' });
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onBeforeUnload);

  // Cleanup à appeler lors du démontage du composant room
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (timeout) clearTimeout(timeout);
  };
}
