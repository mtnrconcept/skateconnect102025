import { useMemo, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { getUserDisplayName, getUserInitial } from '../lib/userUtils';
import type { Profile, Comment } from '../types';
import type { FakeProfileDetails } from '../data/fakeFeed';

interface FakeComment extends Comment {
  user: (Profile | FakeProfileDetails) & { id: string };
}

interface FakeCommentSectionProps {
  comments: FakeComment[];
  currentUser: Profile | null;
  onAddComment: (content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

const INITIAL_DISPLAY_COUNT = 3;

export default function FakeCommentSection({
  comments,
  currentUser,
  onAddComment,
  onDeleteComment,
}: FakeCommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [showAll, setShowAll] = useState(false);

  const displayedComments = useMemo(() => {
    if (showAll || comments.length <= INITIAL_DISPLAY_COUNT) {
      return comments;
    }
    return comments.slice(0, INITIAL_DISPLAY_COUNT);
  }, [comments, showAll]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !newComment.trim()) {
      return;
    }

    onAddComment(newComment.trim());
    setNewComment('');
    if (!showAll && comments.length + 1 > INITIAL_DISPLAY_COUNT) {
      setShowAll(true);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {displayedComments.map((comment) => {
          const user = comment.user;
          const canDelete = currentUser?.id === comment.user_id;
          return (
            <div key={comment.id} className="flex gap-3">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={getUserDisplayName(user)}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-orange-400/60"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-200 text-sm font-semibold flex-shrink-0">
                  {getUserInitial(user)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="bg-dark-700/60 rounded-2xl px-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-white">{getUserDisplayName(user)}</span>
                    <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-200 break-words leading-relaxed">{comment.content}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteComment(comment.id)}
                    className="mt-1 text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!showAll && comments.length > INITIAL_DISPLAY_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Voir tous les commentaires ({comments.length})
          </button>
        )}
      </div>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="flex gap-3">
          {currentUser.avatar_url ? (
            <img
              src={currentUser.avatar_url}
              alt={getUserDisplayName(currentUser)}
              className="w-8 h-8 rounded-full object-cover border border-orange-400/60"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-200 text-sm font-semibold">
              {getUserInitial(currentUser)}
            </div>
          )}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder="Répondre..."
              className="flex-1 px-4 py-2 rounded-full bg-dark-700/80 border border-dark-600 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-400">Connectez-vous pour commenter ce post.</p>
      )}
    </div>
  );
}
