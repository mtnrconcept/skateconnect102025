// src/lib/supaSafe.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Helper universel : tu lui passes un "query builder" (ex: supabase.from(...).select(...).eq(...))
 * et il renvoie 0/1 ligne en tolérant PGRST116 (0 row) sans faire hurler TypeScript.
 *
 * Usage:
 *   const row = await maybeSingle<MyType>(
 *     supabase.from("table").select("*").eq("id", someId)
 *   );
 */
export async function maybeSingle<T>(qb: any): Promise<T | null> {
  const { data, error } = await qb.limit(1).maybeSingle();
  if (error && error.code !== "PGRST116") throw error; // 0 ligne -> OK, on retourne null
  return (data as T) ?? null;
}
