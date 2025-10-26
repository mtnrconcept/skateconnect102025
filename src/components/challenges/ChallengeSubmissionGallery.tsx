import { useMemo } from 'react';
import { ThumbsUp, Video, History, GalleryHorizontal, Crown, Award } from 'lucide-react';
import type { ChallengeSubmission } from '../../types';

export type SubmissionViewMode = 'gallery' | 'ranking' | 'history';

interface ChallengeSubmissionGalleryProps {
  submissions: ChallengeSubmission[];
  loading?: boolean;
  viewMode: SubmissionViewMode;
  onViewModeChange: (mode: SubmissionViewMode) => void;
  onSelectSubmission: (submission: ChallengeSubmission) => void;
  onToggleVote: (submission: ChallengeSubmission) => void;
  votingSubmissionId?: string | null;
}

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChallengeSubmissionGallery({
  submissions,
  loading = false,
  viewMode,
  onViewModeChange,
  onSelectSubmission,
  onToggleVote,
  votingSubmissionId,
}: ChallengeSubmissionGalleryProps) {
  const sortedSubmissions = useMemo(() => {
    switch (viewMode) {
      case 'ranking':
        return [...submissions].sort((a, b) => {
          if (b.votes_count === a.votes_count) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return (b.votes_count || 0) - (a.votes_count || 0);
        });
      case 'history':
        return [...submissions].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      default:
        return [...submissions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
  }, [submissions, viewMode]);

  const winners = useMemo(() => {
    if (submissions.length === 0) {
      return [];
    }

    const byVotes = [...submissions].sort((a, b) => {
      if ((b.votes_count || 0) === (a.votes_count || 0)) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return (b.votes_count || 0) - (a.votes_count || 0);
    });

    const flagged = byVotes.filter((submission) => submission.is_winner).slice(0, 3);

    if (flagged.length >= 3) {
      return flagged;
    }

    const remainingSlots = 3 - flagged.length;
    const additional = byVotes
      .filter((submission) => !submission.is_winner)
      .sort((a, b) => {
        if ((b.votes_count || 0) === (a.votes_count || 0)) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return (b.votes_count || 0) - (a.votes_count || 0);
      })
      .slice(0, remainingSlots);

    const combined = [...flagged, ...additional];
    return combined.slice(0, Math.min(3, combined.length));
  }, [submissions]);

  const winnerIds = useMemo(() => new Set(winners.map((winner) => winner.id)), [winners]);

  const gallerySubmissions = useMemo(() => {
    if (viewMode !== 'gallery') {
      return sortedSubmissions;
    }

    return sortedSubmissions.filter((submission) => !winnerIds.has(submission.id));
  }, [sortedSubmissions, winnerIds, viewMode]);

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <div className="text-center py-10 text-gray-400 border border-dashed border-dark-600 rounded-xl">
        <p className="text-lg text-white mb-2">Pas encore de participation</p>
        <p className="text-sm">Sois le premier à poster ton run pour inspirer la communauté.</p>
      </div>
    );
  };

  const handleVote = (
    submission: ChallengeSubmission,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    onToggleVote(submission);
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => onViewModeChange('gallery')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
            viewMode === 'gallery'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          <GalleryHorizontal size={16} />
          Galerie
        </button>
        <button
          onClick={() => onViewModeChange('ranking')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
            viewMode === 'ranking'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          <Crown size={16} />
          Classement
        </button>
        <button
          onClick={() => onViewModeChange('history')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
            viewMode === 'history'
              ? 'bg-orange-500 text-white'
              : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
          }`}
        >
          <History size={16} />
          Historique
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 rounded-xl bg-dark-700 animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        renderEmptyState()
      ) : viewMode === 'gallery' ? (
        <div className="space-y-6">
          {winners.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-white mb-3">
                <Award size={18} className="text-orange-400" />
                <h3 className="text-lg font-semibold">Top 3 des participations</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {winners.map((submission, index) => {
                  const voted = submission.voted_by_user === true;
                  const isVoting = votingSubmissionId === submission.id;
                  const medal = ['🥇', '🥈', '🥉'][index] ?? '⭐';
                  const accentColor =
                    index === 0
                      ? 'from-amber-500/40 to-yellow-500/10 border-amber-500/40'
                      : index === 1
                        ? 'from-slate-300/30 to-slate-500/10 border-slate-400/40'
                        : 'from-orange-400/30 to-red-400/10 border-orange-400/40';

                  return (
                    <div
                      key={submission.id}
                      className={`relative rounded-2xl border bg-gradient-to-br ${accentColor} overflow-hidden cursor-pointer transition-transform hover:-translate-y-1`}
                      onClick={() => onSelectSubmission(submission)}
                    >
                      <div className="absolute top-3 right-3 text-3xl drop-shadow-lg">{medal}</div>
                      <div className="relative h-44 bg-black/40">
                        {submission.media_type === 'video' ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Video size={36} className="text-white/80" />
                          </div>
                        ) : (
                          <img
                            src={submission.media_url}
                            alt={submission.caption || 'submission'}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-4 space-y-2 bg-black/40 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
                          <span>#{index + 1}</span>
                          <span className="flex items-center gap-1 font-semibold">
                            <ThumbsUp size={14} className={voted ? 'text-emerald-300' : 'text-white'} />
                            {submission.votes_count}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {submission.user?.display_name || submission.user?.username || 'Rider mystère'}
                        </p>
                        <p className="text-xs text-gray-200 line-clamp-2">
                          {submission.caption || 'Pas de description'}
                        </p>
                        <button
                          onClick={(event) => handleVote(submission, event)}
                          disabled={isVoting}
                          className={`w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-1.5 transition-colors ${
                            voted
                              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                              : 'bg-orange-500/90 text-white hover:bg-orange-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <ThumbsUp size={16} className={voted ? 'text-emerald-200' : 'text-white'} />
                          <span>{voted ? 'Retirer mon vote' : 'Voter'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gallerySubmissions.map((submission) => {
              const voted = submission.voted_by_user === true;
              const isVoting = votingSubmissionId === submission.id;
              return (
                <div
                  key={submission.id}
                className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden hover:border-dark-500 transition-colors cursor-pointer"
                onClick={() => onSelectSubmission(submission)}
              >
                <div className="relative h-48 bg-black/40">
                  {submission.media_type === 'video' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Video size={36} className="text-white/80" />
                    </div>
                  ) : (
                    <img
                      src={submission.media_url}
                      alt={submission.caption || 'submission'}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded-full text-xs text-white flex items-center gap-2">
                    <ThumbsUp size={14} className={voted ? 'text-emerald-300' : 'text-white'} />
                    <span>{submission.votes_count}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {submission.user?.display_name || submission.user?.username || 'Rider mystère'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(submission.created_at)}</p>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{submission.caption || 'Pas de description'}</p>
                  <button
                    onClick={(event) => handleVote(submission, event)}
                    disabled={isVoting}
                    className={`w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-1.5 transition-colors ${
                      voted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsUp size={16} className={voted ? 'text-emerald-300' : 'text-white'} />
                    <span>{voted ? 'Retirer mon vote' : 'Voter'}</span>
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      ) : viewMode === 'ranking' ? (
        <div className="space-y-3">
          {sortedSubmissions.map((submission, index) => {
            const voted = submission.voted_by_user === true;
            const isVoting = votingSubmissionId === submission.id;
            return (
              <div
                key={submission.id}
                className="flex items-center gap-4 bg-dark-900 border border-dark-700 rounded-xl p-3"
              >
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-dark-700 text-white font-semibold">
                  #{index + 1}
                </div>
                <div className="flex-1 cursor-pointer" onClick={() => onSelectSubmission(submission)}>
                  <p className="text-sm font-semibold text-white">
                    {submission.user?.display_name || submission.user?.username || 'Rider mystère'}
                  </p>
                  <p className="text-xs text-gray-400">{submission.caption || 'Pas de description'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-white font-semibold">
                    <ThumbsUp size={16} className={voted ? 'text-emerald-300' : 'text-white'} />
                    <span>{submission.votes_count}</span>
                  </div>
                  <button
                    onClick={(event) => handleVote(submission, event)}
                    disabled={isVoting}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      voted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {voted ? 'Je retire' : 'Je vote'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-dark-700" />
          <div className="space-y-6">
            {sortedSubmissions.map((submission) => {
              const voted = submission.voted_by_user === true;
              const isVoting = votingSubmissionId === submission.id;
              return (
                <div key={submission.id} className="relative pl-6">
                  <div className="absolute left-[-13px] top-2 w-3 h-3 rounded-full bg-orange-500" />
                  <div
                    className="bg-dark-900 border border-dark-700 rounded-xl p-3 cursor-pointer hover:border-dark-500 transition-colors"
                    onClick={() => onSelectSubmission(submission)}
                  >
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{formatDate(submission.created_at)}</span>
                      <span className="flex items-center gap-1 text-white font-semibold">
                        <ThumbsUp size={16} className={voted ? 'text-emerald-300' : 'text-white'} />
                        {submission.votes_count}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      {submission.user?.display_name || submission.user?.username || 'Rider mystère'}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">{submission.caption || 'Pas de description'}</p>
                    <button
                      onClick={(event) => handleVote(submission, event)}
                      disabled={isVoting}
                      className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        voted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <ThumbsUp size={14} className={voted ? 'text-emerald-300' : 'text-white'} />
                      {voted ? 'Retirer mon vote' : 'Voter'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
