// src/lib/gosMatchApi.ts
import { supabase } from "@/lib/supabaseClient";

export type Side = "A" | "B";
export type MatchStatus = "pending" | "active" | "ended" | "cancelled";

export interface GosMatch {
  id: string;
  rider_a: string;
  rider_b: string;
  turn: Side;
  letters_a: number;
  letters_b: number;
  status: MatchStatus;
  winner: Side | null;
  created_at: string;
  accepted_at?: string | null;
  starts_at?: string | null;
  countdown_s?: number | null;
}

type InvokeResult<T> = { data: T | null; error: string | null };

async function invoke<T = any>(body: Record<string, any>): Promise<InvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke("gos-match", { body });
  if (error) return { data: null, error: error.message ?? "invoke failed" };
  return { data: data as T, error: null };
}

/** A défie B → création match (status: pending). Retourne { match }. */
export async function createChallenge(opponentId: string, inviterName?: string) {
  return invoke<{ match: GosMatch }>({ action: "create", opponent_id: opponentId, inviter_name: inviterName ?? null });
}

/** B accepte → passe en active + écrit starts_at & countdown_s. Retourne { match }. */
export async function acceptChallenge(matchId: string, countdownSeconds?: number) {
  return invoke<{ match: GosMatch }>({ action: "accept", match_id: matchId, countdown_s: countdownSeconds });
}

/** B refuse → status: cancelled. Retourne { match }. */
export async function declineChallenge(matchId: string) {
  return invoke<{ match: GosMatch }>({ action: "decline", match_id: matchId });
}

/** Fail sur son set → switch de tour, message système côté edge. Retourne { match }. */
export async function setFail(matchId: string) {
  return invoke<{ match: GosMatch }>({ action: "set_fail", match_id: matchId });
}

/** Donne une lettre au côté "side" (auto-fin si atteint). Retourne { match }. */
export async function addLetter(matchId: string, side: Side, lettersSet = "SHRED") {
  return invoke<{ match: GosMatch }>({ action: "add_letter", match_id: matchId, side, letters_set: lettersSet });
}

/** Chat (text/event) – pousse dans gos_chat_message via edge (RLS safe) */
export async function postChat(matchId: string, kind: "text" | "event" | "system", text: string, payload?: any) {
  return invoke<{ message: any }>({ action: "chat", match_id: matchId, kind, text, payload: payload ?? null });
}
