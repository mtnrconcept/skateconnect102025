import { useState, useEffect, useCallback } from 'react';
import { Star, Loader2, Trash2 } from 'lucide-react';
import { deleteSpotRating, fetchUserSpotRating, saveSpotRating } from '../lib/spotRatingsApi.ts';
import { MAX_RATING_COMMENT_LENGTH } from '../lib/ratings';

interface SpotRatingFormProps {
  spotId: string;
  currentUser: { id: string } | null;
  onRatingSaved?: () => Promise<void> | void;
}

export default function SpotRatingForm({ spotId, currentUser, onRatingSaved }: SpotRatingFormProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRatingId, setExistingRatingId] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedRating(0);
    setComment('');
    setExistingRatingId(null);
  };

  const loadExistingRating = useCallback(async () => {
    if (!currentUser?.id) {
      resetForm();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rating = await fetchUserSpotRating(spotId, currentUser.id);

      if (rating) {
        setExistingRatingId(rating.id);
        setSelectedRating(rating.rating);
        setComment(rating.comment ?? '');
      } else {
        resetForm();
      }
    } catch (err) {
      console.error('Error loading rating:', err);
      setError('Impossible de charger votre note pour le moment.');
    } finally {
      setIsLoading(false);
    }
  }, [spotId, currentUser?.id]);

  useEffect(() => {
    loadExistingRating();
  }, [loadExistingRating]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser?.id) {
      setError('Connectez-vous pour noter ce spot.');
      return;
    }

    if (selectedRating < 1 || selectedRating > 5) {
      setError('Choisissez une note entre 1 et 5 étoiles.');
      return;
    }

    if (comment.length > MAX_RATING_COMMENT_LENGTH) {
      setError(`Le commentaire doit contenir au maximum ${MAX_RATING_COMMENT_LENGTH} caractères.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await saveSpotRating({
        spotId,
        userId: currentUser.id,
        rating: selectedRating,
        comment: comment.trim() ? comment.trim() : null,
        existingRatingId,
      });

      await loadExistingRating();

      if (onRatingSaved) {
        await onRatingSaved();
      }
    } catch (err) {
      console.error('Error saving rating:', err);
      setError('Impossible d\'enregistrer votre note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRatingId) return;
    if (!confirm('Supprimer votre avis ?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteSpotRating(existingRatingId);

      resetForm();

      if (onRatingSaved) {
        await onRatingSaved();
      }
    } catch (err) {
      console.error('Error deleting rating:', err);
      setError('Impossible de supprimer votre avis pour le moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 rounded-lg p-4 w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              {existingRatingId ? 'Modifier ma note' : 'Noter ce spot'}
            </h4>
            {isLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedRating(value)}
                className="transition-transform hover:scale-105"
                aria-label={`Donner ${value} étoile${value > 1 ? 's' : ''}`}
              >
                <Star
                  size={24}
                  className={
                    value <= selectedRating ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' : 'text-slate-300'
                  }
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor={`spot-rating-comment-${spotId}`} className="block text-sm font-medium text-slate-600 mb-1">
            Votre ressenti (optionnel)
          </label>
          <textarea
            id={`spot-rating-comment-${spotId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={MAX_RATING_COMMENT_LENGTH}
            rows={3}
            placeholder="Un spot fluide, un coping affûté... Racontez en quelques mots !"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!currentUser || isSubmitting}
          />
          <div className="mt-1 text-right text-xs text-slate-400">
            {comment.length}/{MAX_RATING_COMMENT_LENGTH} caractères
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!currentUser ? (
          <p className="text-sm text-slate-500">
            Connectez-vous pour noter et partager votre ressenti sur ce spot.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {existingRatingId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || selectedRating === 0}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {existingRatingId ? 'Mettre à jour' : 'Publier ma note'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
