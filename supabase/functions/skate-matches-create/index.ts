// POST /matches { mode, opponent_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return bad(405, 'Method Not Allowed');
    const auth = req.headers.get('authorization') ?? '';
    if (!auth.toLowerCase().startsWith('bearer ')) return bad(401, 'Missing/invalid Authorization');
    const supabase = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return bad(401, 'Invalid user session');

    const { mode, opponent_id } = await req.json().catch(() => ({ mode: null, opponent_id: null }));
    if (mode !== 'live' && mode !== 'remote') return bad(400, 'mode must be live|remote');
    if (!opponent_id) return bad(400, 'opponent_id required');

    const insert = {
      mode,
      player_a: userData.user.id,
      player_b: opponent_id,
      status: 'pending',
    };

    const { data: match, error } = await supabase.from('skate_matches').insert(insert as any).select('*').single();
    if (error) return bad(400, error.message);
    return new Response(JSON.stringify({ ok: true, match }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
