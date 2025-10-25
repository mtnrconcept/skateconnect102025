import { useEffect } from 'react';
import { X, ThumbsUp, Calendar, Trophy } from 'lucide-react';
import type { ChallengeSubmission } from '../../types';

interface ChallengeSubmissionDetailModalProps {
  submission: ChallengeSubmission;
  onClose: () => void;
  onToggleVote: (submission: ChallengeSubmission) => void;
  isVoting?: boolean;
}

const formatDate = (value: string) => {
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChallengeSubmissionDetailModal({
  submission,
  onClose,
  onToggleVote,
  isVoting = false,
}: ChallengeSubmissionDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const voted = submission.voted_by_user === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <X size={22} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="bg-black/40 flex items-center justify-center p-4">
            {submission.media_type === 'video' ? (
              <video
                src={submission.media_url}
                controls
                className="w-full max-h-[70vh] rounded-lg"
              />
            ) : (
              <img
                src={submission.media_url}
                alt={submission.caption || 'Submission media'}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full">
                <Trophy size={14} />
                {submission.challenge?.title || 'Challenge'}
              </span>
              <h2 className="text-xl font-semibold text-white mt-3">
                {submission.user?.display_name || submission.user?.username || 'Rider anonyme'}
              </h2>
            </div>

            <div className="text-sm text-gray-300 bg-dark-800 border border-dark-700 rounded-lg p-3">
              <p className="font-medium text-white">Légende</p>
              <p className="mt-1 whitespace-pre-line">{submission.caption || 'Pas de description'}</p>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>Posté le {formatDate(submission.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-white font-semibold">
                <ThumbsUp size={18} className={voted ? 'text-emerald-400' : 'text-gray-400'} />
                <span>{submission.votes_count}</span>
              </div>
            </div>

            <button
              onClick={() => onToggleVote(submission)}
              disabled={isVoting}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 font-semibold transition-colors ${
                voted
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ThumbsUp size={18} className={voted ? 'text-emerald-300' : 'text-white'} />
              <span>{voted ? 'Retirer mon vote' : 'Voter pour ce rider'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
