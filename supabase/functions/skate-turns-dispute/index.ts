// POST /turns/{id}/dispute  — mark turn as disputed and allow community voting
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
    const turnId = parts[parts.length - 2] === 'id' ? parts[parts.length - 1] : parts[parts.length - 1];

    const { data: turn, error: turnErr } = await supabase.from('skate_turns').select('*').eq('id', turnId).single();
    if (turnErr || !turn) return bad(404, 'turn not found');

    // Mark disputed
    await supabase.from('skate_turns').update({ status: 'disputed' }).eq('id', turnId);
    // The community voting will insert rows into turn_reviews with decision valid|invalid
    return new Response(JSON.stringify({ ok: true, disputed: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
