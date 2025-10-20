import { useState, useEffect } from 'react';
import { X, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MediaUploader from './MediaUploader';

interface AddSpotModalProps {
  onClose: () => void;
  onSpotAdded: () => void;
}

export default function AddSpotModal({ onClose, onSpotAdded }: AddSpotModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [spotType, setSpotType] = useState<'street' | 'skatepark' | 'bowl' | 'diy' | 'transition'>('street');
  const [difficulty, setDifficulty] = useState(3);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const surfaceOptions = [
    'concrete',
    'wood',
    'marble',
    'granite',
    'metal',
    'asphalt',
  ];

  const moduleOptions = [
    'stairs',
    'rails',
    'ledges',
    'gaps',
    'quarter',
    'funbox',
    'bank',
    'bowl',
    'pool',
    'transitions',
    'manual pad',
    'spine',
    'curbs',
  ];

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Impossible d\'obtenir votre position');
        }
      );
    }
  };

  const toggleSurface = (surface: string) => {
    setSelectedSurfaces(prev =>
      prev.includes(surface)
        ? prev.filter(s => s !== surface)
        : [...prev, surface]
    );
  };

  const toggleModule = (module: string) => {
    setSelectedModules(prev =>
      prev.includes(module)
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !latitude || !longitude) {
      alert('Veuillez remplir le nom et les coordonnées GPS');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Vous devez être connecté pour ajouter un spot');
        return;
      }

      const { data: newSpot, error: spotError } = await supabase.from('spots').insert({
        created_by: user.id,
        name,
        description,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        spot_type: spotType,
        difficulty,
        surfaces: selectedSurfaces,
        modules: selectedModules,
      }).select().single();

      if (spotError) throw spotError;

      if (mediaUrls.length > 0 && newSpot) {
        const mediaInserts = mediaUrls.map(url => ({
          spot_id: newSpot.id,
          media_url: url,
          media_type: url.includes('video') ? 'video' : 'image',
          uploaded_by: user.id,
        }));

        const { error: mediaError } = await supabase
          .from('spot_media')
          .insert(mediaInserts);

        if (mediaError) {
          console.error('Error adding spot media:', mediaError);
        }
      }

      alert('Spot ajouté avec succès!');
      onSpotAdded();
      onClose();
    } catch (error) {
      console.error('Error adding spot:', error);
      alert('Erreur lors de l\'ajout du spot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Ajouter un Spot</h2>
          <button
            onClick={onClose}
            className="bg-white bg-opacity-20 rounded-full p-2 hover:bg-opacity-30 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom du spot *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Trocadéro"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Décrivez le spot, ses caractéristiques, l'ambiance..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Photos et Vidéos
              </label>
              <MediaUploader
                bucket="spots"
                acceptVideo={true}
                maxFiles={5}
                onUploadComplete={(url) => {
                  setMediaUrls(prev => [...prev, url]);
                }}
                onError={(error) => {
                  alert(error);
                }}
                compressionOptions={{
                  maxWidth: 1920,
                  maxHeight: 1920,
                  quality: 0.85,
                  maxSizeMB: 5,
                }}
              />
              {mediaUrls.length > 0 && (
                <p className="mt-2 text-sm text-green-600">
                  {mediaUrls.length} fichier(s) téléchargé(s)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Adresse
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Place du Trocadéro, 75016 Paris"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="48.8566"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2.3522"
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={getUserLocation}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Navigation size={18} />
              Utiliser ma position actuelle
            </button>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type de spot *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['street', 'skatepark', 'bowl', 'diy', 'transition'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSpotType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      spotType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'street' ? 'Street' :
                     type === 'skatepark' ? 'Skatepark' :
                     type === 'bowl' ? 'Bowl' :
                     type === 'diy' ? 'DIY' : 'Transition'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Difficulté (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      difficulty === level
                        ? 'bg-yellow-400 text-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {'⭐'.repeat(level)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Surfaces
              </label>
              <div className="grid grid-cols-3 gap-2">
                {surfaceOptions.map((surface) => (
                  <label
                    key={surface}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedSurfaces.includes(surface)
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                        : 'bg-slate-50 text-slate-700 border-2 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSurfaces.includes(surface)}
                      onChange={() => toggleSurface(surface)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm capitalize">{surface}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Modules
              </label>
              <div className="grid grid-cols-3 gap-2">
                {moduleOptions.map((module) => (
                  <label
                    key={module}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedModules.includes(module)
                        ? 'bg-cyan-100 text-cyan-700 border-2 border-cyan-500'
                        : 'bg-slate-50 text-slate-700 border-2 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(module)}
                      onChange={() => toggleModule(module)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm capitalize">{module}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ajout en cours...' : 'Ajouter le spot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
