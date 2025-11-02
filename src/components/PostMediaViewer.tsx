import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle } from 'lucide-react';
import CommentSection from './CommentSection';
import { getUserDisplayName, getUserInitial } from '../lib/userUtils';
import type { Post, Profile } from '../types';

interface PostMediaViewerProps {
  posts: (Post & { isFake?: boolean })[];
  initialPostIndex: number;
  initialMediaIndex?: number;
  onClose: () => void;
  onLike: (postId: string) => void;
  currentUser: Profile | null;
  onCommentCountChange: (postId: string, count: number) => void;
  fallbackUser?: Profile | null;
  onProfileClick?: (profileId: string, options?: { isFake?: boolean }) => void;
}

const isVideoUrl = (url: string) => {
  try {
    const cleanUrl = new URL(url, 'http://localhost').pathname || url;
    return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(cleanUrl);
  } catch {
    return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(url);
  }
};

export default function PostMediaViewer({
  posts,
  initialPostIndex,
  initialMediaIndex = 0,
  onClose,
  onLike,
  currentUser,
  onCommentCountChange,
  fallbackUser = null,
  onProfileClick,
}: PostMediaViewerProps) {
  const [currentPostIndex, setCurrentPostIndex] = useState(initialPostIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(initialMediaIndex);
  const [showComments, setShowComments] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [allowVideo, setAllowVideo] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setCurrentPostIndex(initialPostIndex);
    setCurrentMediaIndex(initialMediaIndex);
    setMediaError(false);
    setAllowVideo(true);
  }, [initialPostIndex, initialMediaIndex]);

  

  useEffect(() => {
    if (currentPostIndex >= posts.length) {
      setCurrentPostIndex(posts.length - 1);
      setCurrentMediaIndex(0);
    }
  }, [posts.length, currentPostIndex]);

  const currentPost = useMemo(() => posts[currentPostIndex], [posts, currentPostIndex]);
  const currentMediaUrl = currentPost?.media_urls?.[currentMediaIndex] || '';
  const currentMediaIsVideo = currentMediaUrl ? isVideoUrl(currentMediaUrl) : currentPost?.post_type === 'video';
  const postAuthor = currentPost?.user || fallbackUser;


  // Preflight check for video URLs to avoid 416 logs from media element
  useEffect(() => {
    let cancelled = false;
    if (!currentMediaUrl) return;
    if (!currentMediaIsVideo) {
      setAllowVideo(true);
      return;
    }
    setAllowVideo(false);
    setMediaError(false);
    fetch(currentMediaUrl, { method: 'GET', headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
      .then((res) => {
        if (cancelled) return;
        if (res.ok || res.status === 206) {
          setAllowVideo(true);
        } else {
          setMediaError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setMediaError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentMediaUrl, currentMediaIsVideo]);
  const authorId = postAuthor?.id || currentPost?.user_id;
  const isFakePost = Boolean((currentPost as Post & { isFake?: boolean })?.isFake);

  const handleAuthorClick = () => {
    if (!onProfileClick || !authorId) {
      return;
    }
    onProfileClick(authorId, { isFake: isFakePost });
  };

  const handleNext = () => {
    if (!currentPost) return;

    const totalMedia = currentPost.media_urls?.length || 0;
    if (currentMediaIndex < totalMedia - 1) {
      setCurrentMediaIndex((prev) => prev + 1);
      return;
    }

    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex((prev) => prev + 1);
      setCurrentMediaIndex(0);
    }
  };

  const handlePrev = () => {
    if (!currentPost) return;

    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((prev) => prev - 1);
      return;
    }

    if (currentPostIndex > 0) {
      const prevIndex = currentPostIndex - 1;
      const prevPost = posts[prevIndex];
      const prevMediaLength = prevPost.media_urls?.length || 1;
      setCurrentPostIndex(prevIndex);
      setCurrentMediaIndex(prevMediaLength - 1);
    }
  };

  if (!currentPost) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center px-4 md:px-12" onClick={onClose}>
      <div
        className="relative max-w-6xl w-full h-full max-h-[90vh] bg-dark-900 rounded-2xl overflow-hidden flex flex-col md:flex-row border border-dark-700"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-dark-800 text-white p-2 rounded-full hover:bg-dark-700 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative flex-1 bg-black flex items-center justify-center">
          {currentMediaUrl && !mediaError ? (
            currentMediaIsVideo ? (
              allowVideo ? (
                <video
                  key={currentMediaUrl}
                  src={currentMediaUrl}
                  controls
                  autoPlay
                  playsInline
                  onError={() => setMediaError(true)}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-gray-400">MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia indisponible</div>
              )
            ) : (
              <img
                src={currentMediaUrl}
                alt={currentPost.content || 'Story media'}
                onError={() => setMediaError(true)}
                className="max-h-full max-w-full object-contain"
              />
            )
          ) : (
            <div className="text-gray-400">Aucun mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia disponible</div>
          )}

          {(posts.length > 1 || (currentPost.media_urls?.length || 0) > 1) && (
            <div className="absolute inset-x-0 top-4 flex justify-center gap-2">
              {currentPost.media_urls?.map((_, index) => (
                <span
                  key={`media-${index}`}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    index === currentMediaIndex ? 'bg-white w-12' : 'bg-white/40 w-6'
                  }`}
                />
              ))}
            </div>
          )}

          {currentPostIndex > 0 || currentMediaIndex > 0 ? (
            <button
              onClick={handlePrev}
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 bg-dark-800/70 text-white p-3 rounded-full hover:bg-dark-700 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}

          {(currentPost.media_urls?.length || 0) - 1 > currentMediaIndex || currentPostIndex < posts.length - 1 ? (
            <button
              onClick={handleNext}
              className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 bg-dark-800/70 text-white p-3 rounded-full hover:bg-dark-700 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          ) : null}
        </div>

        <div className="w-full md:w-96 bg-dark-800 flex flex-col border-l border-dark-700">
          <div className="p-4 border-b border-dark-700">
            <div className="flex items-center gap-3 mb-3">
              {onProfileClick && authorId ? (
                <button
                  type="button"
                  onClick={handleAuthorClick}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  aria-label={`Voir le profil de ${getUserDisplayName(postAuthor)}`}>
                  {postAuthor?.avatar_url ? (
                    <img
                      src={postAuthor.avatar_url}
                      alt={getUserDisplayName(postAuthor)}
                      className="w-12 h-12 rounded-full object-cover border-2 border-orange-500"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg font-semibold">
                      {getUserInitial(postAuthor)}
                    </div>
                  )}
                </button>
              ) : postAuthor?.avatar_url ? (
                <img
                  src={postAuthor.avatar_url}
                  alt={getUserDisplayName(postAuthor)}
                  className="w-12 h-12 rounded-full object-cover border-2 border-orange-500"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg font-semibold">
                  {getUserInitial(postAuthor)}
                </div>
              )}

              <div className="flex-1">
                {onProfileClick && authorId ? (
                  <button
                    type="button"
                    onClick={handleAuthorClick}
                    className="text-left text-white font-semibold leading-tight hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    {getUserDisplayName(postAuthor)}
                  </button>
                ) : (
                  <p className="text-white font-semibold leading-tight">{getUserDisplayName(postAuthor)}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(currentPost.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>

            {currentPost.content && (
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {currentPost.content}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 px-4 py-3 border-b border-dark-700">
            <button
              onClick={() => onLike(currentPost.id)}
              className={`flex items-center gap-2 text-sm transition-colors ${
                currentPost.liked_by_user ? 'text-orange-500' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Heart size={20} className={currentPost.liked_by_user ? 'fill-current' : ''} />
              <span>{currentPost.likes_count || 0}</span>
            </button>
            <button
              onClick={() => setShowComments((prev) => !prev)}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <MessageCircle size={20} />
              <span>{currentPost.comments_count || 0}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {showComments ? (
              <CommentSection
                postId={currentPost.id}
                currentUser={currentUser}
                showAll
                onCommentCountChange={(count) => onCommentCountChange(currentPost.id, count)}
                onProfileClick={(profileId) => onProfileClick?.(profileId)}
              />
            ) : (
              <div className="text-center text-gray-500 text-sm">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Ouvrez les commentaires pour participer ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  la discussion</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


