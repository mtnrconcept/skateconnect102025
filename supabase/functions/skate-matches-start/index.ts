// POST /matches/{id}/start
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return bad(405, 'Method Not Allowed');
    const auth = req.headers.get('authorization') ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) return bad(401, 'Missing/invalid Authorization');
    const supabase = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return bad(401, 'Invalid user session');

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const matchId = parts[parts.length - 2] === 'id' ? parts[parts.length - 1] : parts[parts.length - 1];

    const { data: match, error: mErr } = await supabase.from('skate_matches').select('*').eq('id', matchId).single();
    if (mErr || !match) return bad(404, 'match not found');

    if (match.status !== 'pending') return bad(400, 'match not pending');
    if (userData.user.id !== match.player_a && userData.user.id !== match.player_b) return bad(403, 'not a participant');

    const { data: updated, error } = await supabase
      .from('skate_matches')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', matchId)
      .select('*')
      .single();
    if (error) return bad(400, error.message);
    return new Response(JSON.stringify({ ok: true, match: updated }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
