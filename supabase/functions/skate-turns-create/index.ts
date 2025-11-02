// POST /matches/{id}/turns { proposer, trick_name?, difficulty? }
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
    const body = await req.json().catch(() => ({}));
    const proposer = body.proposer as string | undefined;
    const trick_name = body.trick_name as string | undefined;
    const difficulty = body.difficulty as number | undefined;
    if (!proposer) return bad(400, 'proposer is required');

    const { data: match, error: mErr } = await supabase.from('skate_matches').select('*').eq('id', matchId).single();
    if (mErr || !match) return bad(404, 'match not found');

    const { count } = await supabase.from('skate_turns').select('id', { count: 'exact', head: true }).eq('match_id', matchId);
    const turn_index = (count ?? 0);
    const remote_deadline = match.mode === 'remote' ? new Date(Date.now() + 24*3600*1000).toISOString() : null;

    const insert = {
      match_id: matchId,
      turn_index,
      proposer,
      trick_name: trick_name ?? null,
      difficulty: typeof difficulty === 'number' ? difficulty : null,
      status: 'proposed',
      remote_deadline,
    };

    const { data: turn, error: tErr } = await supabase.from('skate_turns').insert(insert as any).select('*').single();
    if (tErr) return bad(400, tErr.message);

    return new Response(JSON.stringify({ ok: true, turn }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
