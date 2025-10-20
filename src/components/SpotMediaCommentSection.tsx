import { useState, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SpotMediaComment, Profile } from '../types';

interface SpotMediaCommentSectionProps {
  mediaId: string;
  currentUser: Profile | null;
  showAll?: boolean;
  onCommentCountChange?: (count: number) => void;
}

export default function SpotMediaCommentSection({
  mediaId,
  currentUser,
  showAll = false,
  onCommentCountChange
}: SpotMediaCommentSectionProps) {
  const [comments, setComments] = useState<SpotMediaComment[]>([]);
  const [displayedComments, setDisplayedComments] = useState<SpotMediaComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAllComments, setShowAllComments] = useState(showAll);

  const INITIAL_DISPLAY_COUNT = 3;

  useEffect(() => {
    loadComments();
  }, [mediaId]);

  useEffect(() => {
    updateDisplayedComments();
  }, [comments, showAllComments]);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('spot_media_comments')
        .select('*, user:profiles(*)')
        .eq('media_id', mediaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
      onCommentCountChange?.(data?.length || 0);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDisplayedComments = () => {
    if (showAllComments || comments.length <= INITIAL_DISPLAY_COUNT) {
      setDisplayedComments(comments);
    } else {
      setDisplayedComments(comments.slice(0, INITIAL_DISPLAY_COUNT));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('spot_media_comments')
        .insert({
          media_id: mediaId,
          user_id: currentUser.id,
          content: newComment,
        })
        .select('*, user:profiles(*)')
        .single();

      if (error) throw error;

      const updatedComments = [...comments, data];
      setComments(updatedComments);
      setNewComment('');
      onCommentCountChange?.(updatedComments.length);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Échec de la publication du commentaire');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return;

    try {
      const { error } = await supabase
        .from('spot_media_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      const updatedComments = comments.filter((c) => c.id !== commentId);
      setComments(updatedComments);
      onCommentCountChange?.(updatedComments.length);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Échec de la suppression du commentaire');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  if (loading) {
    return <div className="text-center py-4 text-slate-500">Chargement des commentaires...</div>;
  }

  const hasMoreComments = comments.length > INITIAL_DISPLAY_COUNT && !showAllComments;

  return (
    <div className="space-y-4">
      {displayedComments.length > 0 && (
        <div className="space-y-3">
          {displayedComments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {comment.user?.avatar_url ? (
                <img
                  src={comment.user.avatar_url}
                  alt={comment.user.display_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {comment.user?.display_name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="bg-slate-100 rounded-2xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-800">
                      {comment.user?.display_name}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-slate-700 text-sm break-words">{comment.content}</p>
                </div>

                {currentUser?.id === comment.user_id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="mt-1 text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}

          {hasMoreComments && (
            <button
              onClick={() => setShowAllComments(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Voir plus de commentaires ({comments.length - INITIAL_DISPLAY_COUNT} de plus)
            </button>
          )}
        </div>
      )}

      {currentUser && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          {currentUser.avatar_url ? (
            <img
              src={currentUser.avatar_url}
              alt={currentUser.display_name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {currentUser.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Écrire un commentaire..."
              className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
