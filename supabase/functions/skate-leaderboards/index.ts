// GET /leaderboards?scope=global|country:XX&limit=50
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'global';
    const limit = Number(url.searchParams.get('limit') || '50');
    const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    let query = supabase.from('rider_profiles').select('user_id, handle, country, elo, xp').order('elo', { ascending: false }).limit(limit);
    if (scope.startsWith('country:')) {
      const cc = scope.split(':')[1];
      query = query.eq('country', cc);
    }
    const { data, error } = await query;
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, scope, items: data || [] }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
