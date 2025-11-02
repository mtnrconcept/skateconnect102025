// src/lib/matchRepo.ts
import { supabase } from "@/lib/supabaseClient";
import { maybeSingle } from "@/lib/supaSafe";

export type Side = "A" | "B";
export type Match = {
  id: string;
  rider_a: string;
  rider_b: string;
  turn: Side;
  letters_a: number;
  letters_b: number;
  status: "active" | "ended";
  winner: Side | null;
  created_at: string;
};

export async function getMatchByIdSafe(id: string): Promise<Match | null> {
  return await maybeSingle<Match>(
    supabase.from("gos_match").select("*").eq("id", id)
  );
}

/** Retourne un match actif A↔B ou le crée si absent. */
export async function getOrCreateMatch(riderA: string, riderB: string): Promise<Match> {
  const or = `and(rider_a.eq.${riderA},rider_b.eq.${riderB}),and(rider_a.eq.${riderB},rider_b.eq.${riderA})`;

  const found = await maybeSingle<Match>(
    supabase.from("gos_match").select("*").eq("status", "active").or(or)
  );
  if (found) return found;

  const { data: created, error: e2 } = await supabase
    .from("gos_match")
    .insert({ rider_a: riderA, rider_b: riderB, turn: "A" })
    .select()
    .single();
  if (e2) throw e2;
  return created as Match;
}
