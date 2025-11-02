import { useEffect, useState } from 'react';
import type { SkateMatchRow, SkateTurnRow } from '../../types';
import { supabase } from '../../lib/supabase.js';
import { useCountdown } from '../../hooks/skate';

interface Props { matchId: string }

export default function MatchRoomRemote({ matchId }: Props) {
  const [match, setMatch] = useState<SkateMatchRow | null>(null);
  const [turns, setTurns] = useState<SkateTurnRow[]>([]);
  const deadline = turns.find(t => t.status === 'proposed' || t.status === 'responded')?.remote_deadline ?? null;
  const { secondsLeft } = useCountdown(deadline);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: m } = await supabase.from('skate_matches').select('*').eq('id', matchId).single();
      const { data: t } = await supabase.from('skate_turns').select('*').eq('match_id', matchId).order('turn_index');
      if (mounted) { setMatch((m as any) || null); setTurns(((t as any) || []) as SkateTurnRow[]); }
    })();
    return () => { mounted = false; };
  }, [matchId]);

  if (!match) return <div className="text-gray-400">Chargement du match…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-dark-800 border border-dark-700 rounded-lg p-4">
        <div className="text-white font-semibold">A: {match.letters_a || '—'}</div>
        <div className="text-white font-semibold">B: {match.letters_b || '—'}</div>
        <div className="text-orange-300">{deadline ? `⏱ ${Math.max(0, secondsLeft)}s` : '—'}</div>
      </div>
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
        <h4 className="text-white font-semibold mb-2">Timeline</h4>
        <ol className="space-y-2">
          {turns.map(t => (
            <li key={t.id} className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded px-3 py-2">
              <div className="text-white">#{t.turn_index + 1} {t.trick_name || 'Trick'}</div>
              <div className="text-gray-300 text-sm">{t.status}</div>
            </li>
          ))}
          {turns.length === 0 && <li className="text-gray-400">Aucun tour pour l’instant.</li>}
        </ol>
      </div>
    </div>
  );
}

