import { supabase } from "@/lib/supabaseClient";

export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) await supabase.auth.signInAnonymously();
}
