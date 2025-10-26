import { useEffect, useMemo } from 'react';
import { X, Calendar, Users, Star, Trophy, Clock } from 'lucide-react';
import ChallengeSubmissionExperience from './ChallengeSubmissionExperience';
import ChallengeSubmissionHistory from './ChallengeSubmissionHistory';
import type { Challenge, ChallengeSubmission, Profile } from '../../types';

interface ChallengeDetailModalProps {
  challenge: Challenge;
  profile: Profile;
  hasJoined: boolean;
  onClose: () => void;
  onSubmissionCreated: (submission: ChallengeSubmission) => void;
  submissionHistory: ChallengeSubmission[];
  historyLoading?: boolean;
  historyError?: string | null;
  onReloadHistory?: () => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function ChallengeDetailModal({
  challenge,
  profile,
  hasJoined,
  onClose,
  onSubmissionCreated,
  submissionHistory,
  historyLoading = false,
  historyError = null,
  onReloadHistory,
}: ChallengeDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const challengeStatus = useMemo(() => {
    const now = new Date();
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);

    if (now < start) {
      return {
        label: 'À venir',
        tone: 'info' as const,
        helper: `Début le ${formatDate(challenge.start_date)}`,
      };
    }

    if (now > end) {
      return {
        label: 'Terminé',
        tone: 'danger' as const,
        helper: `Clôturé le ${formatDate(challenge.end_date)}`,
      };
    }

    const diffDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    return {
      label: 'En cours',
      tone: 'success' as const,
      helper: `${diffDays} jour${diffDays > 1 ? 's' : ''} restant${diffDays > 1 ? 's' : ''}`,
    };
  }, [challenge.start_date, challenge.end_date]);

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>

        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                    <Trophy size={16} className="text-orange-400" />
                    Challenge {challenge.challenge_type}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-2">{challenge.title}</h2>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                    challengeStatus.tone === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : challengeStatus.tone === 'danger'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {challengeStatus.label}
                </div>
              </div>

              <p className="text-gray-300 text-sm leading-relaxed">{challenge.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl p-3">
                  <Calendar size={20} className="text-orange-400" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Période</p>
                    <p className="text-sm text-white font-medium">
                      {formatDate(challenge.start_date)} — {formatDate(challenge.end_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl p-3">
                  <Users size={20} className="text-orange-400" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Participants</p>
                    <p className="text-sm text-white font-medium">
                      {challenge.participants_count} rider{challenge.participants_count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl p-3">
                  <Star size={20} className="text-orange-400" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Difficulté</p>
                    <p className="text-sm text-white font-medium">{'⭐'.repeat(challenge.difficulty)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl p-3">
                  <Clock size={20} className="text-orange-400" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Statut</p>
                    <p className="text-sm text-white font-medium">{challengeStatus.helper}</p>
                  </div>
                </div>
              </div>

              {challenge.prize && (
                <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/10 border border-orange-500/30 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-orange-300 mb-1">Récompense</p>
                  <p className="text-base text-white font-semibold">{challenge.prize}</p>
                </div>
              )}
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trophy size={18} className="text-orange-400" />
                <span>Rappels du challenge</span>
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Partage ton meilleur run sous forme de photo ou de vidéo.</li>
                <li>• Les riders de la communauté votent pour leurs coups de cœur.</li>
                <li>• Les 3 participations les plus votées sont sacrées gagnantes.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
            <ChallengeSubmissionExperience
              challenge={challenge}
              profile={profile}
              hasJoined={hasJoined}
              onSubmissionCreated={onSubmissionCreated}
            />
            <div className="space-y-4">
              {historyError && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl px-3 py-2 text-sm">
                  {historyError}
                  {onReloadHistory && (
                    <button
                      onClick={onReloadHistory}
                      className="ml-3 underline text-red-200 hover:text-red-100"
                    >
                      Réessayer
                    </button>
                  )}
                </div>
              )}
              <ChallengeSubmissionHistory submissions={submissionHistory} loading={historyLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
