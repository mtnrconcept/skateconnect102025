// POST /turns/{id}/respond { video_url }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LETTERS = ['S','K','A','T','E'] as const;

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

function nextLetters(current: string | null): string {
  const clean = (current ?? '').toUpperCase().replace(/[^SKATE]/g, '');
  const have = new Set(clean.split(''));
  for (const L of LETTERS) { if (!have.has(L)) return (clean + L).slice(0,5); }
  return 'SKATE';
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
    const { video_url } = await req.json().catch(() => ({ video_url: null }));
    if (!video_url) return bad(400, 'video_url required');

    const { data: turn, error: turnErr } = await supabase.from('skate_turns').select('*').eq('id', turnId).single();
    if (turnErr || !turn) return bad(404, 'turn not found');

    const { data: match, error: matchErr } = await supabase.from('skate_matches').select('*').eq('id', turn.match_id).single();
    if (matchErr || !match) return bad(404, 'match not found');

    // Timeout check for remote mode
    const isRemote = match.mode === 'remote';
    let newStatus = 'responded';
    if (isRemote && turn.remote_deadline) {
      const deadline = new Date(turn.remote_deadline).getTime();
      if (Date.now() > deadline) {
        newStatus = 'timeout';
      }
    }

    await supabase.from('skate_turns').update({ video_b_url: video_url, status: newStatus }).eq('id', turnId);

    let letters_a = match.letters_a as string;
    let letters_b = match.letters_b as string;
    let status = match.status as string;
    let winner: string | null = match.winner ?? null;

    if (newStatus === 'timeout') {
      // Respondent failed due to timeout → add letter to respondent
      const respondent = turn.proposer === match.player_a ? match.player_b : match.player_a;
      if (respondent === match.player_a) letters_a = nextLetters(letters_a); else letters_b = nextLetters(letters_b);
      if (letters_a === 'SKATE') { winner = match.player_b; status = 'finished'; }
      if (letters_b === 'SKATE') { winner = match.player_a; status = 'finished'; }
    }

    const { data: updatedMatch, error: updErr } = await supabase
      .from('skate_matches')
      .update({ letters_a, letters_b, status, winner })
      .eq('id', match.id)
      .select('*')
      .single();
    if (updErr) return bad(400, updErr.message);

    return new Response(JSON.stringify({ ok: true, status: newStatus, match: updatedMatch }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
