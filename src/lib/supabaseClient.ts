// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __shredloc_supabase__: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __shredloc_supabase_ctor_count__: number | undefined;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const STORAGE_KEY = 'shredloc-auth-v1';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase env manquantes: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

function traceDuplicate() {
  try {
    const err = new Error('Multiple Supabase clients detected');
    // eslint-disable-next-line no-console
    console.warn('[supabase] createClient() supplémentaire détecté — stack ci-dessous:');
    // eslint-disable-next-line no-console
    console.warn(err.stack);
  } catch {}
}

export function getSupabase(): SupabaseClient {
  if (globalThis.__shredloc_supabase__) {
    return globalThis.__shredloc_supabase__;
  }

  // Compteur de constructions — si >1, on log le stack pour trouver l’intrus.
  globalThis.__shredloc_supabase_ctor_count__ =
    (globalThis.__shredloc_supabase_ctor_count__ ?? 0) + 1;
  if (globalThis.__shredloc_supabase_ctor_count__ > 1) {
    traceDuplicate();
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
    },
  });

  globalThis.__shredloc_supabase__ = client;
  return client;
}

export const supabase = getSupabase();
