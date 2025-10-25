import { createClient } from '@supabase/supabase-js';

const importMetaEnv =
  typeof import.meta !== 'undefined' && 'env' in import.meta
    ? (import.meta as ImportMeta).env
    : undefined;

const processEnv = typeof process !== 'undefined' ? process.env : undefined;

const envSupabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? processEnv?.VITE_SUPABASE_URL;
const envSupabaseAnonKey =
  importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? processEnv?.VITE_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseAnonKey);

const fallbackSupabaseUrl = 'https://stub.supabase.local';
const fallbackSupabaseAnonKey = 'stub-anon-key';

const supabaseUrl = envSupabaseUrl ?? fallbackSupabaseUrl;
const supabaseAnonKey = envSupabaseAnonKey ?? fallbackSupabaseAnonKey;

if (!hasSupabaseConfig) {
  console.warn('Supabase environment variables are missing. Falling back to local-only mode.');
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
  if (!hasSupabaseConfig) {
    return;
  }
  if (!token) {
    await supabase.auth.signOut();
    return;
  }

  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
}

export const isSupabaseConfigured = () => hasSupabaseConfig;
