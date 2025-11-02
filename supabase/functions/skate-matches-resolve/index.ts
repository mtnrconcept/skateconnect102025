// POST /matches/{id}/resolve — recompute end-of-match and finalize
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

    let status = match.status as string;
    let winner = match.winner as string | null;
    if (match.letters_a === 'SKATE') { winner = match.player_b; status = 'finished'; }
    if (match.letters_b === 'SKATE') { winner = match.player_a; status = 'finished'; }

    const { data: updated, error } = await supabase
      .from('skate_matches')
      .update({ status, winner, finished_at: status === 'finished' ? new Date().toISOString() : match.finished_at })
      .eq('id', match.id)
      .select('*')
      .single();
    if (error) return bad(400, error.message);

    // TODO: reward XP/ELO/coins based on difficulty/rounds

    return new Response(JSON.stringify({ ok: true, match: updated }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
