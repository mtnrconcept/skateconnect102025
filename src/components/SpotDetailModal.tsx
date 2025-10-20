import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Star, Users, ChevronLeft, ChevronRight, Upload, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MediaUploader from './MediaUploader';
import CommentSection from './CommentSection';
import LazyImage from './LazyImage';
import SpotMediaGallery from './SpotMediaGallery';
import type { Spot, SpotMedia } from '../types';

interface SpotDetailModalProps {
  spot: Spot;
  onClose: () => void;
}

export default function SpotDetailModal({ spot, onClose }: SpotDetailModalProps) {
  const [media, setMedia] = useState<SpotMedia[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showGallery, setShowGallery] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSpotMedia();
    loadCurrentUser();
  }, [spot.id]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const loadSpotMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('spot_media')
        .select('*, user:profiles(*)')
        .eq('spot_id', spot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error('Error loading spot media:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextMedia = () => {
    if (media.length > 0) {
      setCurrentMediaIndex((prev) => (prev + 1) % media.length);
    }
  };

  const prevMedia = () => {
    if (media.length > 0) {
      setCurrentMediaIndex((prev) => (prev - 1 + media.length) % media.length);
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
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
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
          ) : media.length > 0 ? (
            <div className="relative h-96 bg-slate-900">
              {media[currentMediaIndex].media_type === 'video' ? (
                <video
                  src={media[currentMediaIndex].media_url}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <LazyImage
                  src={media[currentMediaIndex].media_url}
                  alt={media[currentMediaIndex].caption || spot.name}
                  className="w-full h-full object-cover"
                />
              )}

              {media.length > 1 && (
                <>
                  <button
                    onClick={prevMedia}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100 transition-all"
                  >
                    <ChevronLeft size={24} className="text-slate-700" />
                  </button>
                  <button
                    onClick={nextMedia}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100 transition-all"
                  >
                    <ChevronRight size={24} className="text-slate-700" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {media.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentMediaIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentMediaIndex
                            ? 'bg-white w-8'
                            : 'bg-white bg-opacity-50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {media[currentMediaIndex].caption && (
                <div className="absolute bottom-12 left-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg">
                  <p className="text-sm">{media[currentMediaIndex].caption}</p>
                  {media[currentMediaIndex].user && (
                    <p className="text-xs text-slate-300 mt-1">
                      Par @{media[currentMediaIndex].user!.username}
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="mt-6">
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
                  setShowComments(false);

                  try {
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${currentUser.id}/${Date.now()}-${i}.${fileExt}`;

                      const { data: uploadData, error: uploadError } = await supabase.storage
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
                  onMediaClick={(mediaItem, index) => {
                    const allMedia = media;
                    const clickedIndex = allMedia.findIndex(m => m.id === mediaItem.id);
                    if (clickedIndex !== -1) {
                      setCurrentMediaIndex(clickedIndex);
                      setShowGallery(false);
                    }
                  }}
                  onUploadClick={() => fileInputRef.current?.click()}
                />
              )}
            </div>

            {!showGallery && media.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowGallery(true)}
                  className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                >
                  ← Retour à la galerie
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
