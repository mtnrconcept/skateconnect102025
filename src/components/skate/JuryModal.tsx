import type { SkateTurnRow } from '../../types';

interface Props {
  turn: SkateTurnRow;
  onVote: (decision: 'valid' | 'invalid', reason?: string) => void;
  onClose: () => void;
}

export default function JuryModal({ turn, onVote, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-lg">
        <h3 className="text-white text-xl font-semibold mb-2">Jury express</h3>
        <p className="text-gray-300 mb-4">Rejoue les vidéos A/B et rends ton verdict.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-black aspect-video rounded border border-dark-700 text-white/60 flex items-center justify-center">Replay A</div>
          <div className="bg-black aspect-video rounded border border-dark-700 text-white/60 flex items-center justify-center">Replay B</div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="px-4 py-2 rounded border border-dark-600 text-white hover:bg-dark-700" onClick={() => onVote('invalid')}>Invalid</button>
          <button className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => onVote('valid')}>Valid</button>
          <button className="px-4 py-2 rounded bg-dark-700 text-white" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

