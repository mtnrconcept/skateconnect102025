import type { SkateMatchRow, SkateTurnRow } from '../../types';

interface Props {
  match: SkateMatchRow;
  turns: SkateTurnRow[];
  onRematch?: () => void;
}

export default function Results({ match, turns, onRematch }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <h3 className="text-white text-xl font-semibold mb-2">Résultats</h3>
        <p className="text-gray-300">Vainqueur: <span className="font-semibold">{match.winner ?? '—'}</span></p>
        <p className="text-gray-400">A: {match.letters_a || '—'} | B: {match.letters_b || '—'}</p>
      </div>
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <h4 className="text-white font-semibold mb-3">Récapitulatif des tours</h4>
        <ol className="space-y-2">
          {turns.map(t => (
            <li key={t.id} className="flex items-center justify-between bg-dark-900 border border-dark-700 rounded px-3 py-2">
              <div className="text-white">#{t.turn_index + 1} {t.trick_name || 'Trick'}</div>
              <div className="text-gray-300 text-sm">{t.status}</div>
            </li>
          ))}
        </ol>
      </div>
      {onRematch && (
        <button onClick={onRematch} className="px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white">Revanche</button>
      )}
    </div>
  );
}

