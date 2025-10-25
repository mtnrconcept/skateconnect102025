import { createClient } from '@supabase/supabase-js';

const importMetaEnv = (import.meta as any)?.env;
const processEnv = typeof process !== 'undefined' ? process.env : undefined;

const supabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? processEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey =
  importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? processEnv?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    storage: undefined,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export async function applySupabaseAccessToken(token: string | null) {
  if (!token) {
    await supabase.auth.signOut();
    return;
  }

  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
}
