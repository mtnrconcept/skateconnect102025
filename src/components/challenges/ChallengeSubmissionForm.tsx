import { useState } from 'react';
import { Loader2, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import MediaUploader from '../MediaUploader';
import { createChallengeSubmission } from '../../lib/challenges';
import type { ChallengeSubmission, Profile } from '../../types';

interface ChallengeSubmissionFormProps {
  challengeId: string;
  profile: Profile;
  hasJoined: boolean;
  existingSubmission?: ChallengeSubmission | null;
  onSubmissionCreated: (submission: ChallengeSubmission) => void;
}

interface UploadState {
  url: string;
  type: 'photo' | 'video';
}

export default function ChallengeSubmissionForm({
  challengeId,
  profile,
  hasJoined,
  existingSubmission,
  onSubmissionCreated,
}: ChallengeSubmissionFormProps) {
  const [caption, setCaption] = useState('');
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setCaption('');
    setUpload(null);
    setSuccess('Ta participation est en ligne !');
  };

  const handleUploadComplete = (url: string, _path: string, mediaType?: 'image' | 'video') => {
    const normalizedType: 'photo' | 'video' = mediaType === 'video' ? 'video' : 'photo';
    setUpload({ url, type: normalizedType });
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!upload) {
      setError('Ajoute une photo ou une vidéo avant de valider.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submission = await createChallengeSubmission({
        challengeId,
        userId: profile.id,
        mediaUrl: upload.url,
        mediaType: upload.type,
        caption,
      });

      onSubmissionCreated(submission);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'enregistrer ta soumission";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasJoined) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 text-gray-400">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-orange-400" size={20} />
          <p>Inscris-toi au challenge pour débloquer la soumission de ton clip.</p>
        </div>
      </div>
    );
  }

  if (existingSubmission) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 size={20} />
          <p>Tu as déjà soumis une participation pour ce challenge.</p>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          Laisse les autres riders voter pour toi ! Tu peux modifier ta légende directement depuis le support Supabase si besoin.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <UploadCloud size={20} className="text-orange-400" />
          <span>Soumets ta participation</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Upload une photo ou une vidéo originale de ta réalisation. Format carré ou vertical recommandé.
        </p>
      </div>

      <MediaUploader
        bucket="challenges"
        path={`challenge-${challengeId}/${profile.id}`}
        acceptVideo
        enableCrop
        cropAspectRatio={4 / 5}
        onUploadComplete={handleUploadComplete}
        onUploadStart={() => {
          setUploading(true);
          setSuccess(null);
        }}
        onUploadEnd={() => setUploading(false)}
        onError={(message) => {
          setError(message);
          setUploading(false);
        }}
        className="bg-dark-900 border border-dashed border-dark-600 rounded-lg"
      />

      <div>
        <label htmlFor="submission-caption" className="block text-sm font-medium text-gray-300 mb-2">
          Légende (optionnel)
        </label>
        <textarea
          id="submission-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Donne un contexte ou remercie tes teammates !"
          rows={3}
          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!upload || uploading || submitting}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 transition-colors text-white font-semibold py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
        <span>{submitting ? 'Publication...' : 'Publier ma participation'}</span>
      </button>
    </form>
  );
}
