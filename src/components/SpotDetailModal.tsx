import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Star, Users, Upload, Heart, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LazyImage from './LazyImage';
import SpotMediaGallery from './SpotMediaGallery';
import MediaDetailModal from './MediaDetailModal';
import SpotCommentSection from './SpotCommentSection';
import SpotRatingForm from './SpotRatingForm';
import { buildSummaryFromSpot, SpotRatingSummary } from '../lib/ratings';
import { getUserDisplayName } from '../lib/userUtils';
import type { Spot, SpotMedia, SpotRating } from '../types';

interface SpotDetailModalProps {
  spot: Spot;
  onClose: () => void;
}

const RATINGS_PAGE_SIZE = 5;

export default function SpotDetailModal({ spot, onClose }: SpotDetailModalProps) {
  const [media, setMedia] = useState<SpotMedia[]>([]);
  const [coverPhoto, setCoverPhoto] = useState<SpotMedia | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(true);
  const [showMediaDetail, setShowMediaDetail] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [spotData, setSpotData] = useState<Spot>(spot);
  const [userLiked, setUserLiked] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<SpotRatingSummary>(buildSummaryFromSpot(spot));
  const [ratings, setRatings] = useState<SpotRating[]>([]);
  const [ratingsPage, setRatingsPage] = useState(1);
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    setRatingSummary(buildSummaryFromSpot(spot));
    setRatings([]);
    setRatingsTotal(0);
    setRatingsPage(1);
    loadSpotMedia();
    loadCurrentUser();
    loadSpotData();
    loadSpotRatings(1, true);
  }, [spot.id, loadSpotRatings]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    if (user) {
      checkUserLike(user.id);
    }
  };

  const loadSpotData = async () => {
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .eq('id', spot.id)
        .single();

      if (error) throw error;
      if (data) {
        setSpotData(data);
        setRatingSummary(buildSummaryFromSpot(data));
      }
    } catch (error) {
      console.error('Error loading spot data:', error);
    }
  };

  const loadSpotRatings = useCallback(
    async (page: number = 1, replace: boolean = false) => {
      setRatingsLoading(true);

      try {
        const from = (page - 1) * RATINGS_PAGE_SIZE;
        const to = from + RATINGS_PAGE_SIZE - 1;

        const { data, error, count } = await supabase
          .from('spot_ratings')
          .select('id, rating, comment, created_at, updated_at, user:profiles(id, username, display_name, avatar_url)', {
            count: 'exact',
          })
          .eq('spot_id', spot.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const normalized = (data || []).map((item) => ({
          ...item,
          comment: item.comment ?? null,
        })) as SpotRating[];

        setRatings((previous) => {
          if (replace) {
            return normalized;
          }

          const existingIds = new Set(previous.map((rating) => rating.id));
          const merged = normalized.filter((rating) => !existingIds.has(rating.id));
          return [...previous, ...merged];
        });

        setRatingsTotal((previous) => {
          if (typeof count === 'number') {
            return count;
          }

          return replace ? normalized.length : previous + normalized.length;
        });
      } catch (error) {
        console.error('Error loading spot ratings:', error);
      } finally {
        setRatingsLoading(false);
      }
    },
    [spot.id]
  );

  const handleRatingSaved = async () => {
    await loadSpotData();
    await loadSpotRatings(1, true);
    setRatingsPage(1);
  };

  const handleLoadMoreRatings = () => {
    setRatingsPage((previous) => {
      const nextPage = previous + 1;
      loadSpotRatings(nextPage, false);
      return nextPage;
    });
  };

  const formatReviewDate = (value: string) => {
    try {
      const date = new Date(value);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting review date:', error);
      return value;
    }
  };

  const checkUserLike = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('spot_likes')
        .select('id')
        .eq('spot_id', spot.id)
        .eq('user_id', userId)
        .maybeSingle();

      setUserLiked(!!data);
    } catch (error) {
      console.error('Error checking like:', error);
    }
  };

  const handleSpotLike = async () => {
    if (!currentUser) {
      alert('Vous devez être connecté pour aimer un spot');
      return;
    }

    try {
      if (userLiked) {
        await supabase
          .from('spot_likes')
          .delete()
          .eq('spot_id', spot.id)
          .eq('user_id', currentUser.id);

        setUserLiked(false);
        setSpotData(prev => ({
          ...prev,
          likes_count: Math.max(0, (prev.likes_count || 0) - 1),
        }));
      } else {
        await supabase
          .from('spot_likes')
          .insert({
            spot_id: spot.id,
            user_id: currentUser.id,
          });

        setUserLiked(true);
        setSpotData(prev => ({
          ...prev,
          likes_count: (prev.likes_count || 0) + 1,
        }));
      }
    } catch (error) {
      console.error('Error liking spot:', error);
      alert('Échec de l\'action');
    }
  };

  const loadSpotMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('spot_media')
        .select('*, user:profiles(*)')
        .eq('spot_id', spot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const cover = data?.find(m => m.is_cover_photo) || data?.[0] || null;
      setCoverPhoto(cover);
      setMedia(data || []);
    } catch (error) {
      console.error('Error loading spot media:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSpotTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      street: 'Street',
      skatepark: 'Skatepark',
      bowl: 'Bowl',
      diy: 'DIY',
      transition: 'Transition',
    };
    return labels[type] || type;
  };

  const getSpotTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      street: 'bg-orange-100 text-orange-700',
      skatepark: 'bg-green-100 text-green-700',
      bowl: 'bg-blue-100 text-blue-700',
      diy: 'bg-purple-100 text-purple-700',
      transition: 'bg-cyan-100 text-cyan-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-slate-100 transition-colors"
          >
            <X size={24} className="text-slate-700" />
          </button>

          {loading ? (
            <div className="h-96 bg-slate-200 flex items-center justify-center">
              <div className="text-slate-500">Chargement des médias...</div>
            </div>
          ) : coverPhoto ? (
            <div className="relative h-96 bg-slate-900">
              {coverPhoto.media_type === 'video' ? (
                <video
                  src={coverPhoto.media_url}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <LazyImage
                  src={coverPhoto.media_url}
                  alt={coverPhoto.caption || spot.name}
                  className="w-full h-full object-cover"
                />
              )}

              <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                Photo de couverture
              </div>

              {coverPhoto.caption && (
                <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg">
                  <p className="text-sm">{coverPhoto.caption}</p>
                  {coverPhoto.user && (
                    <p className="text-xs text-slate-300 mt-1">
                      Par @{coverPhoto.user!.username}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-96 bg-slate-200 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <MapPin size={48} className="mx-auto mb-2 opacity-30" />
                <p>Aucune photo disponible</p>
                <p className="text-sm mt-1">Soyez le premier à partager une photo!</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-24rem)]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">{spot.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSpotTypeColor(spot.spot_type)}`}>
                  {getSpotTypeLabel(spot.spot_type)}
                </span>
                {spot.is_verified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Star size={14} className="fill-current" />
                    Vérifié
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                <MapPin size={16} />
                Adresse
              </h3>
              <p className="text-slate-800">{spot.address || 'Adresse non spécifiée'}</p>
            </div>

            {spot.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Description
                </h3>
                <p className="text-slate-700 leading-relaxed">{spot.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Difficulté
                </h3>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className={i < spot.difficulty ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Users size={16} />
                  Médias
                </h3>
                <p className="text-2xl font-bold text-slate-800">{media.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
              <button
                onClick={handleSpotLike}
                disabled={!currentUser}
                className={`flex items-center gap-2 transition-colors ${
                  userLiked
                    ? 'text-red-500'
                    : 'text-slate-600 hover:text-red-500'
                }`}
              >
                <Heart size={22} className={userLiked ? 'fill-current' : ''} />
                <span className="text-base font-semibold">{spotData.likes_count || 0} j'aime</span>
              </button>
              <div className="flex items-center gap-2 text-slate-600">
                <MessageCircle size={22} />
                <span className="text-base font-semibold">{spotData.comments_count || 0} commentaires</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Notes & avis</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-slate-800">
                      {ratingSummary.count > 0 ? ratingSummary.average.toFixed(1) : '—'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const starValue = index + 1;
                          const isFull = ratingSummary.average >= starValue - 0.25;
                          const isHalf = !isFull && ratingSummary.average >= starValue - 0.75;
                          return (
                            <Star
                              key={starValue}
                              size={18}
                              className={
                                isFull
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : isHalf
                                    ? 'text-yellow-300'
                                    : 'text-slate-300'
                              }
                            />
                          );
                        })}
                      </div>
                      <p className="text-sm text-slate-500">{ratingSummary.count} avis</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[5, 4, 3, 2, 1].map((value) => {
                      const count = ratingSummary.distribution[value as 1 | 2 | 3 | 4 | 5] ?? 0;
                      const percentage = ratingSummary.count > 0 ? (count / ratingSummary.count) * 100 : 0;

                      return (
                        <div key={value} className="flex items-center gap-3">
                          <div className="flex items-center min-w-[3rem] text-sm text-slate-600">
                            <span>{value}</span>
                            <Star size={14} className="ml-1 text-yellow-400 fill-yellow-400" />
                          </div>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-10 text-right text-sm text-slate-600">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <SpotRatingForm
                  spotId={spot.id}
                  currentUser={currentUser}
                  onRatingSaved={handleRatingSaved}
                />
              </div>
              <div className="mt-6 space-y-4">
                <h4 className="text-base font-semibold text-slate-700">Avis récents</h4>
                {ratings.length === 0 && !ratingsLoading && (
                  <p className="text-sm text-slate-500">
                    Aucun avis pour le moment. Soyez le premier à partager votre ressenti !
                  </p>
                )}
                {ratings.map((rating) => (
                  <div key={rating.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {getUserDisplayName(rating.user ?? null, 'Skater anonyme')}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              size={16}
                              className={index < rating.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{formatReviewDate(rating.created_at)}</span>
                    </div>
                    {rating.comment && (
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{rating.comment}</p>
                    )}
                  </div>
                ))}
                {ratingsLoading && (
                  <div className="flex justify-center py-3">
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  </div>
                )}
                {ratings.length < ratingsTotal && !ratingsLoading && (
                  <div className="flex justify-center">
                    <button
                      onClick={handleLoadMoreRatings}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Voir plus d'avis
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Commentaires</h3>
              <SpotCommentSection
                spotId={spot.id}
                currentUser={currentUser}
                onCommentCountChange={(count) => {
                  setSpotData(prev => ({ ...prev, comments_count: count }));
                }}
              />
            </div>

            {spot.modules && Array.isArray(spot.modules) && spot.modules.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Modules
                </h3>
                <div className="flex flex-wrap gap-2">
                  {spot.modules.map((module, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {spot.surfaces && Array.isArray(spot.surfaces) && spot.surfaces.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Surfaces
                </h3>
                <div className="flex flex-wrap gap-2">
                  {spot.surfaces.map((surface, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                    >
                      {surface}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0 || !currentUser) return;

                  setShowGallery(false);

                  try {
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${currentUser.id}/${Date.now()}-${i}.${fileExt}`;

                      const { error: uploadError } = await supabase.storage
                        .from('spots')
                        .upload(fileName, file);

                      if (uploadError) throw uploadError;

                      const { data: { publicUrl } } = supabase.storage
                        .from('spots')
                        .getPublicUrl(fileName);

                      const { error: insertError } = await supabase.from('spot_media').insert({
                        spot_id: spot.id,
                        user_id: currentUser.id,
                        media_url: publicUrl,
                        media_type: file.type.startsWith('video') ? 'video' : 'photo',
                      });

                      if (insertError) throw insertError;
                    }

                    loadSpotMedia();
                    setShowGallery(true);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  } catch (error) {
                    console.error('Error uploading media:', error);
                    alert('Erreur lors de l\'ajout du média');
                  }
                }}
              />

              <button
                onClick={() => {
                  if (!currentUser) {
                    alert('Vous devez être connecté pour ajouter une photo');
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold mb-4"
              >
                <Upload size={20} />
                Ajouter une photo/vidéo
              </button>

              {showGallery && (
                <SpotMediaGallery
                  spotId={spot.id}
                  onMediaClick={(mediaItem) => {
                    const clickedIndex = media.findIndex(m => m.id === mediaItem.id);
                    if (clickedIndex !== -1) {
                      setCurrentMediaIndex(clickedIndex);
                      setShowMediaDetail(true);
                    }
                  }}
                  onUploadClick={() => fileInputRef.current?.click()}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showMediaDetail && media.length > 0 && (
        <MediaDetailModal
          media={media}
          initialIndex={currentMediaIndex}
          onClose={() => setShowMediaDetail(false)}
        />
      )}
    </div>
  );
}
