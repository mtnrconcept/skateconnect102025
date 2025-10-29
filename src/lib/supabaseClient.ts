import { createClient } from '@supabase/supabase-js';

const importMetaEnv =
  typeof import.meta !== 'undefined' && 'env' in import.meta ? (import.meta as ImportMeta).env : undefined;
const processEnv = typeof process !== 'undefined' ? process.env : undefined;

const envSupabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? processEnv?.VITE_SUPABASE_URL;
const envSupabaseAnonKey = importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? processEnv?.VITE_SUPABASE_ANON_KEY;

if (!envSupabaseUrl || !envSupabaseAnonKey) {
  console.warn(
    'SupabaseClient: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Falling back to local stub configuration.',
  );
}

const fallbackUrl = 'https://stub.supabase.local';
const fallbackAnonKey = 'stub-anon-key';

export const supabaseClient = createClient(envSupabaseUrl ?? fallbackUrl, envSupabaseAnonKey ?? fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
