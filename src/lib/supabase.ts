import { createClient } from '@supabase/supabase-js';

const importMetaEnv = (import.meta as any)?.env;
const supabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? process.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? process.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
