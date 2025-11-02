import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import ChallengeSubmissionForm from './ChallengeSubmissionForm';
import ChallengeSubmissionGallery, { type SubmissionViewMode } from './ChallengeSubmissionGallery';
import ChallengeSubmissionDetailModal from './ChallengeSubmissionDetailModal';
import { fetchChallengeSubmissions, toggleChallengeVote } from '../../lib/challenges';
import type { Challenge, Profile, ChallengeSubmission } from '../../types';

interface ChallengeSubmissionExperienceProps {
  challenge: Challenge;
  profile: Profile;
  hasJoined: boolean;
  onSubmissionCreated?: (submission: ChallengeSubmission) => void;
  onUserSubmissionChange?: (submission: ChallengeSubmission | null) => void;
}

export default function ChallengeSubmissionExperience({
  challenge,
  profile,
  hasJoined,
  onSubmissionCreated,
  onUserSubmissionChange,
}: ChallengeSubmissionExperienceProps) {
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SubmissionViewMode>('gallery');
  const [selectedSubmission, setSelectedSubmission] = useState<ChallengeSubmission | null>(null);
  const [userSubmission, setUserSubmission] = useState<ChallengeSubmission | null>(null);
  const [votingSubmissionId, setVotingSubmissionId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChallengeSubmissions(challenge.id, profile.id);
      setSubmissions(data);
      const ownSubmission = data.find((item) => item.user_id === profile.id) || null;
      setUserSubmission(ownSubmission);
      onUserSubmissionChange?.(ownSubmission);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de récupérer les participations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [challenge.id, profile.id, onUserSubmissionChange]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const handleSubmissionCreated = (submission: ChallengeSubmission) => {
    setSubmissions((prev: ChallengeSubmission[]) => [submission, ...prev]);
    setUserSubmission(submission);
    setSelectedSubmission(submission);
    onSubmissionCreated?.(submission);
    onUserSubmissionChange?.(submission);
  };

  const handleToggleVote = async (submission: ChallengeSubmission) => {
    if (!profile?.id) {
      setError('Connecte-toi pour voter pour une participation.');
      return;
    }

    try {
      setError(null);
      setVotingSubmissionId(submission.id);
      const result = await toggleChallengeVote(submission.id, profile.id, submission.voted_by_user === true);
      setSubmissions((prev: ChallengeSubmission[]) =>
        prev.map((item) =>
          item.id === submission.id
            ? { ...item, votes_count: result.votesCount, voted_by_user: result.voted }
            : item,
        ),
      );

      setUserSubmission((prev: ChallengeSubmission | null) =>
        prev && prev.id === submission.id
          ? { ...prev, votes_count: result.votesCount, voted_by_user: result.voted }
          : prev,
      );

      setSelectedSubmission((prev: ChallengeSubmission | null) =>
        prev && prev.id === submission.id
          ? { ...prev, votes_count: result.votesCount, voted_by_user: result.voted }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de mettre à jour ton vote';
      setError(message);
    } finally {
      setVotingSubmissionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <ChallengeSubmissionForm
        challengeId={challenge.id}
        profile={profile}
        hasJoined={hasJoined}
        existingSubmission={userSubmission}
        onSubmissionCreated={handleSubmissionCreated}
      />

      <ChallengeSubmissionGallery
        submissions={submissions}
        loading={loading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSelectSubmission={setSelectedSubmission}
        onToggleVote={handleToggleVote}
        votingSubmissionId={votingSubmissionId}
      />

      {selectedSubmission && (
        <ChallengeSubmissionDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onToggleVote={handleToggleVote}
          isVoting={votingSubmissionId === selectedSubmission.id}
        />
      )}
    </div>
  );
}
