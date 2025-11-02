// POST /turns/{id}/validate
// Body: { decision: 'valid'|'invalid' }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

const LETTERS = ['S', 'K', 'A', 'T', 'E'] as const;
function nextLetters(current: string | null): string {
  const clean = (current ?? '').toUpperCase().replace(/[^SKATE]/g, '');
  const have = new Set(clean.split(''));
  for (const L of LETTERS) {
    if (!have.has(L)) return (clean + L).slice(0, 5);
  }
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

    const { decision } = await req.json().catch(() => ({ decision: null }));
    if (decision !== 'valid' && decision !== 'invalid') return bad(400, 'decision must be valid|invalid');

    const { data: turn, error: turnErr } = await supabase.from('skate_turns').select('*').eq('id', turnId).single();
    if (turnErr || !turn) return bad(404, 'turn not found');

    const { data: match, error: matchErr } = await supabase.from('skate_matches').select('*').eq('id', turn.match_id).single();
    if (matchErr || !match) return bad(404, 'match not found');

    // Update turn status
    const newTurnStatus = decision === 'valid' ? 'validated' : 'failed';
    await supabase.from('skate_turns').update({ status: newTurnStatus }).eq('id', turnId);

    // If failed, assign letter to respondent (the other player)
    let letters_a = match.letters_a as string;
    let letters_b = match.letters_b as string;

    if (newTurnStatus === 'failed') {
      const respondent = turn.proposer === match.player_a ? match.player_b : match.player_a;
      if (respondent === match.player_a) {
        letters_a = nextLetters(letters_a);
      } else {
        letters_b = nextLetters(letters_b);
      }
    }

    // Determine winner if any
    let winner: string | null = match.winner ?? null;
    let status = match.status as string;
    if (letters_a === 'SKATE') { winner = match.player_b; status = 'finished'; }
    if (letters_b === 'SKATE') { winner = match.player_a; status = 'finished'; }

    const { data: updatedMatch, error: updErr } = await supabase
      .from('skate_matches')
      .update({ letters_a, letters_b, winner, status })
      .eq('id', match.id)
      .select('*')
      .single();
    if (updErr) return bad(400, updErr.message);

    return new Response(JSON.stringify({ ok: true, turn: { ...turn, status: newTurnStatus }, match: updatedMatch }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return bad(500, e?.message ?? 'internal error');
  }
});
