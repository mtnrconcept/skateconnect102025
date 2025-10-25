import { createClient } from '@supabase/supabase-js';

const importMetaEnv = (import.meta as any)?.env;
const processEnv = typeof process !== 'undefined' ? process.env : undefined;

const supabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? processEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey =
  importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? processEnv?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
