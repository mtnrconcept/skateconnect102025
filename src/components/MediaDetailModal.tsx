import { useState, useEffect, useCallback } from 'react';
import { X, Heart, Share2, Eye, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LazyImage from './LazyImage';
import CommentSection from './CommentSection';
import type { SpotMedia } from '../types';

interface MediaDetailModalProps {
  media: SpotMedia[];
  initialIndex: number;
  onClose: () => void;
}

interface MediaWithStats extends SpotMedia {
  likes_count: number;
  views_count: number;
  user_liked?: boolean;
}

export default function MediaDetailModal({ media, initialIndex, onClose }: MediaDetailModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentMedia, setCurrentMedia] = useState<MediaWithStats>(media[initialIndex] as MediaWithStats);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showComments, setShowComments] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadMediaStats();
  }, []);

  useEffect(() => {
    setCurrentMedia(media[currentIndex] as MediaWithStats);
    loadMediaStats();
  }, [currentIndex]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadMediaStats = async () => {
    try {
      const mediaItem = media[currentIndex];

      const { data: mediaData, error } = await supabase
        .from('spot_media')
        .select('likes_count, views_count')
        .eq('id', mediaItem.id)
        .single();

      if (error) throw error;

      if (currentUser) {
        const { data: likeData } = await supabase
          .from('spot_media_likes')
          .select('id')
          .eq('media_id', mediaItem.id)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        setCurrentMedia({
          ...mediaItem,
          likes_count: mediaData.likes_count || 0,
          views_count: mediaData.views_count || 0,
          user_liked: !!likeData,
        } as MediaWithStats);
      } else {
        setCurrentMedia({
          ...mediaItem,
          likes_count: mediaData.likes_count || 0,
          views_count: mediaData.views_count || 0,
        } as MediaWithStats);
      }
    } catch (error) {
      console.error('Error loading media stats:', error);
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      alert('Vous devez être connecté pour aimer une photo');
      return;
    }

    try {
      if (currentMedia.user_liked) {
        await supabase
          .from('spot_media_likes')
          .delete()
          .eq('media_id', currentMedia.id)
          .eq('user_id', currentUser.id);

        setCurrentMedia(prev => ({
          ...prev,
          user_liked: false,
          likes_count: Math.max(0, prev.likes_count - 1),
        }));
      } else {
        await supabase
          .from('spot_media_likes')
          .insert({ media_id: currentMedia.id, user_id: currentUser.id });

        setCurrentMedia(prev => ({
          ...prev,
          user_liked: true,
          likes_count: prev.likes_count + 1,
        }));
      }
    } catch (error) {
      console.error('Error liking media:', error);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentMedia.caption || 'Spot SkateConnect',
          text: `Découvrez ce spot sur SkateConnect`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papiers!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setSharing(false);
    }
  };

  const nextMedia = () => {
    if (currentIndex < media.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevMedia = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}m`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') prevMedia();
    if (e.key === 'ArrowRight') nextMedia();
  }, [currentIndex, media.length]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-7xl mx-auto flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-2 hover:bg-opacity-30 transition-all"
        >
          <X size={24} className="text-white" />
        </button>

        {media.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={prevMedia}
                className="absolute left-4 z-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-3 hover:bg-opacity-30 transition-all"
              >
                <ChevronLeft size={28} className="text-white" />
              </button>
            )}

            {currentIndex < media.length - 1 && (
              <button
                onClick={nextMedia}
                className="absolute right-4 z-10 bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-3 hover:bg-opacity-30 transition-all"
              >
                <ChevronRight size={28} className="text-white" />
              </button>
            )}
          </>
        )}

        <div className="flex flex-col lg:flex-row w-full h-full max-h-[90vh] bg-black lg:bg-transparent overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-black relative">
            {currentMedia.media_type === 'video' ? (
              <video
                src={currentMedia.media_url}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <LazyImage
                src={currentMedia.media_url}
                alt={currentMedia.caption || 'Media'}
                className="max-w-full max-h-full object-contain"
              />
            )}

            {media.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black bg-opacity-50 px-3 py-2 rounded-full">
                {media.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex
                        ? 'bg-white w-6'
                        : 'bg-white bg-opacity-50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-full lg:w-96 bg-white flex flex-col max-h-[40vh] lg:max-h-full">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                {currentMedia.user?.avatar_url ? (
                  <img
                    src={currentMedia.user.avatar_url}
                    alt={currentMedia.user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-600 font-semibold">
                      {currentMedia.user?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">
                    {currentMedia.user?.display_name || currentMedia.user?.username || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(currentMedia.created_at)}
                  </p>
                </div>
              </div>

              {currentMedia.caption && (
                <p className="text-slate-700 leading-relaxed mb-3">
                  {currentMedia.caption}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Eye size={16} />
                  <span>{currentMedia.views_count || 0} vues</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart size={16} className={currentMedia.user_liked ? 'fill-red-500 text-red-500' : ''} />
                  <span>{currentMedia.likes_count || 0} j'aime</span>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                onClick={handleLike}
                disabled={!currentUser}
                className={`flex-1 flex items-center justify-center gap-2 py-3 hover:bg-slate-50 transition-colors ${
                  currentMedia.user_liked ? 'text-red-500' : 'text-slate-700'
                }`}
              >
                <Heart
                  size={20}
                  className={currentMedia.user_liked ? 'fill-current' : ''}
                />
                <span className="font-semibold">J'aime</span>
              </button>

              <button
                onClick={() => setShowComments(!showComments)}
                className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-slate-50 transition-colors text-slate-700"
              >
                <MessageCircle size={20} />
                <span className="font-semibold">Commenter</span>
              </button>

              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-slate-50 transition-colors text-slate-700"
              >
                <Share2 size={20} />
                <span className="font-semibold">Partager</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showComments ? (
                <div className="p-4">
                  <CommentSection
                    postId={currentMedia.id}
                    currentUser={currentUser}
                  />
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Cliquez sur "Commenter" pour voir les commentaires</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
