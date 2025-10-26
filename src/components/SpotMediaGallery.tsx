import { useState, useEffect, useRef } from 'react';
import { Heart, Eye, Filter, Image as ImageIcon, Video, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import LazyImage from './LazyImage';
import type { SpotMedia } from '../types';

interface SpotMediaGalleryProps {
  spotId: string;
  onMediaClick: (media: SpotMedia, index: number) => void;
  onUploadClick: () => void;
  refreshToken?: number;
}

type FilterType = 'recent' | 'oldest' | 'most_liked' | 'most_viewed' | 'photos' | 'videos';

interface MediaWithStats extends SpotMedia {
  likes_count: number;
  views_count: number;
  comments_count: number;
  user_liked?: boolean;
}

export default function SpotMediaGallery({ spotId, onMediaClick, onUploadClick, refreshToken = 0 }: SpotMediaGalleryProps) {
  const [allMedia, setAllMedia] = useState<MediaWithStats[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaWithStats[]>([]);
  const [displayedMedia, setDisplayedMedia] = useState<MediaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('recent');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    loadMedia();
  }, [spotId, currentUser?.id, refreshToken]);

  useEffect(() => {
    applyFilter();
  }, [allMedia, currentFilter]);

  useEffect(() => {
    loadMoreItems();
  }, [filteredMedia, page]);

  useEffect(() => {
    setupInfiniteScroll();
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadMedia = async () => {
    try {
      setLoading(true);

      const { data: mediaData, error } = await supabase
        .from('spot_media')
        .select(`
          *,
          user:profiles(id, username, display_name, avatar_url)
        `)
        .eq('spot_id', spotId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (currentUser && mediaData) {
        const mediaIds = mediaData.map(m => m.id);
        const { data: likes } = await supabase
          .from('spot_media_likes')
          .select('media_id')
          .eq('user_id', currentUser.id)
          .in('media_id', mediaIds);

        const likedIds = new Set(likes?.map(l => l.media_id) || []);

        const mediaWithLikes = mediaData.map(m => ({
          ...m,
          user_liked: likedIds.has(m.id),
        }));

        setAllMedia(mediaWithLikes as MediaWithStats[]);
      } else {
        setAllMedia((mediaData || []) as MediaWithStats[]);
      }
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...allMedia];

    switch (currentFilter) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most_liked':
        filtered.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        break;
      case 'most_viewed':
        filtered.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
        break;
      case 'photos':
        filtered = filtered.filter(m => m.media_type === 'photo');
        break;
      case 'videos':
        filtered = filtered.filter(m => m.media_type === 'video');
        break;
    }

    setFilteredMedia(filtered);
    setPage(1);
    setDisplayedMedia([]);
    setHasMore(filtered.length > 0);
  };

  const loadMoreItems = () => {
    if (filteredMedia.length === 0) {
      setDisplayedMedia([]);
      setHasMore(false);
      return;
    }

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newItems = filteredMedia.slice(startIndex, endIndex);

    if (page === 1) {
      setDisplayedMedia(newItems);
    } else {
      setDisplayedMedia(prev => [...prev, ...newItems]);
    }

    setHasMore(endIndex < filteredMedia.length);
    setLoadingMore(false);
  };

  const setupInfiniteScroll = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          setPage(prev => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
  };

  const handleLike = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentUser) {
      alert('Vous devez être connecté pour aimer une photo');
      return;
    }

    const mediaItem = allMedia.find(m => m.id === mediaId);
    if (!mediaItem) return;

    try {
      if (mediaItem.user_liked) {
        await supabase
          .from('spot_media_likes')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', currentUser.id);

        setAllMedia(prev => prev.map(m =>
          m.id === mediaId
            ? { ...m, user_liked: false, likes_count: Math.max(0, (m.likes_count || 0) - 1) }
            : m
        ));
      } else {
        await supabase
          .from('spot_media_likes')
          .insert({ media_id: mediaId, user_id: currentUser.id });

        setAllMedia(prev => prev.map(m =>
          m.id === mediaId
            ? { ...m, user_liked: true, likes_count: (m.likes_count || 0) + 1 }
            : m
        ));
      }
    } catch (error) {
      console.error('Error liking media:', error);
    }
  };

  const trackView = async (mediaId: string) => {
    try {
      await supabase
        .from('spot_media_views')
        .insert({
          media_id: mediaId,
          user_id: currentUser?.id || null,
        });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const filters: { value: FilterType; label: string; icon: any }[] = [
    { value: 'recent', label: 'Plus récentes', icon: Clock },
    { value: 'oldest', label: 'Plus anciennes', icon: Clock },
    { value: 'most_liked', label: 'Plus likées', icon: Heart },
    { value: 'most_viewed', label: 'Plus vues', icon: Eye },
    { value: 'photos', label: 'Photos uniquement', icon: ImageIcon },
    { value: 'videos', label: 'Vidéos uniquement', icon: Video },
  ];

  const currentFilterLabel = filters.find(f => f.value === currentFilter)?.label || 'Filtre';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">
          Galerie <span className="text-slate-500">({filteredMedia.length})</span>
        </h3>

        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
          >
            <Filter size={16} />
            {currentFilterLabel}
          </button>

          {showFilterMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-10">
              {filters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setCurrentFilter(filter.value);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors text-left ${
                      currentFilter === filter.value ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-sm">{filter.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : displayedMedia.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-4">
            {currentFilter === 'photos' ? 'Aucune photo' : currentFilter === 'videos' ? 'Aucune vidéo' : 'Aucun média'}
          </p>
          <button
            onClick={onUploadClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter une photo/vidéo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {displayedMedia.map((item, index) => (
              <div
                key={item.id}
                onClick={() => {
                  trackView(item.id);
                  onMediaClick(item, index);
                }}
                className="relative aspect-square bg-slate-900 rounded-lg overflow-hidden cursor-pointer group"
              >
                {item.is_cover_photo && (
                  <div className="absolute top-2 left-2 z-10 rounded-full bg-blue-600 bg-opacity-90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Couverture
                  </div>
                )}
                {item.media_type === 'video' ? (
                  <div className="relative w-full h-full">
                    <video
                      src={item.media_url}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                  </div>
                ) : (
                  <LazyImage
                    src={item.media_url}
                    alt={item.caption || 'Spot media'}
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Eye size={12} />
                      <span>{item.views_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={12} className={item.user_liked ? 'fill-red-500 text-red-500' : ''} />
                      <span>{item.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      <span>{item.comments_count || 0}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleLike(item.id, e)}
                  className="absolute top-2 right-2 p-1.5 bg-white bg-opacity-90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
                >
                  <Heart
                    size={16}
                    className={item.user_liked ? 'fill-red-500 text-red-500' : 'text-slate-600'}
                  />
                </button>

                {item.media_type === 'video' && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-75 rounded text-white text-xs">
                    <Video size={12} className="inline mr-1" />
                    Vidéo
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {loadingMore && (
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="text-sm">Chargement...</span>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-slate-500">
            {displayedMedia.length} sur {filteredMedia.length} médias
          </p>
        </>
      )}
    </div>
  );
}
