import { Trophy, Clock } from 'lucide-react';
import type { ChallengeSubmission } from '../../types';

interface ChallengeSubmissionHistoryProps {
  submissions: ChallengeSubmission[];
  loading?: boolean;
}

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function ChallengeSubmissionHistory({
  submissions,
  loading = false,
}: ChallengeSubmissionHistoryProps) {
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-orange-400" />
        <h3 className="text-lg font-semibold text-white">Historique de tes participations</h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 bg-dark-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-gray-400">
          Tu n'as pas encore participé à un challenge. C'est le moment de montrer ton style !
        </p>
      ) : (
        <ul className="space-y-3">
          {submissions.map((submission) => (
            <li
              key={submission.id}
              className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"
            >
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-white font-semibold">
                    {submission.challenge?.title || 'Challenge mystère'}
                  </p>
                  <p className="text-gray-400 text-xs flex items-center gap-1">
                    <Clock size={14} />
                    {formatDate(submission.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-300">{submission.votes_count} vote(s)</p>
                  {submission.voted_by_user && (
                    <p className="text-xs text-emerald-400">Tu as voté pour toi (respect !)</p>
                  )}
                </div>
              </div>
              {submission.caption && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">{submission.caption}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
