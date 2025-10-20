import { useState } from 'react';
import { X, Upload, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserInitial } from '../lib/userUtils';
import MediaUploader from './MediaUploader';
import type { Profile } from '../types';

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || '');
  const [skillLevel, setSkillLevel] = useState(profile.skill_level || 'beginner');
  const [stance, setStance] = useState(profile.stance || 'regular');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [coverUrl, setCoverUrl] = useState(profile.cover_url);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showAvatarUploader, setShowAvatarUploader] = useState(false);
  const [showCoverUploader, setShowCoverUploader] = useState(false);

  const skillLevels = [
    { value: 'beginner', label: 'Débutant' },
    { value: 'intermediate', label: 'Intermédiaire' },
    { value: 'advanced', label: 'Avancé' },
    { value: 'pro', label: 'Pro' },
  ];

  const stances = [
    { value: 'regular', label: 'Regular' },
    { value: 'goofy', label: 'Goofy' },
    { value: 'switch', label: 'Switch' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          username: username,
          bio: bio,
          skill_level: skillLevel,
          stance: stance,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Modifier le profil</h2>
          <button
            onClick={onClose}
            className="bg-white bg-opacity-20 rounded-full p-2 hover:bg-opacity-30 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Photo de couverture
              </label>
              <div className="relative h-40 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl overflow-hidden">
                {coverUrl ? (
                  <>
                    <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCoverUploader(true)}
                        className="bg-white/90 backdrop-blur-sm text-slate-700 px-3 py-1.5 text-sm rounded-md font-medium hover:bg-white flex items-center gap-2"
                      >
                        <Camera size={16} />
                        <span>Changer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverUrl(null)}
                        className="bg-white/70 backdrop-blur-sm text-red-600 px-3 py-1.5 text-sm rounded-md font-medium hover:bg-white"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <ImageIcon size={48} />
                    <p className="text-sm">Aucune photo de couverture</p>
                    <button
                      type="button"
                      onClick={() => setShowCoverUploader(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg"
                    >
                      <Camera size={18} />
                      Ajouter une photo
                    </button>
                  </div>
                )}

                {showCoverUploader && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-4 w-full max-w-xl">
                      {uploadingCover ? (
                        <div className="flex flex-col items-center gap-2 text-slate-600">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <p className="text-sm">Téléchargement...</p>
                        </div>
                      ) : (
                        <>
                          <MediaUploader
                            bucket="covers"
                            path={profile.id}
                            onUploadComplete={(url) => {
                              setCoverUrl(url);
                              setShowCoverUploader(false);
                            }}
                            onError={(error) => {
                              alert(error);
                              setShowCoverUploader(false);
                              setUploadingCover(false);
                            }}
                            onUploadStart={() => setUploadingCover(true)}
                            onUploadEnd={() => setUploadingCover(false)}
                            enableCrop={true}
                            cropAspectRatio={3}
                            compressionOptions={{
                              maxWidth: 1920,
                              maxHeight: 640,
                              quality: 0.9,
                              maxSizeMB: 5,
                            }}
                            className="w-full"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowCoverUploader(false);
                              setUploadingCover(false);
                            }}
                            className="mt-3 text-sm text-slate-600 hover:text-slate-800"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Photo de profil
              </label>
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-slate-200 shadow-lg">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-4xl font-bold">
                      {getUserInitial({ display_name: displayName, username } as any)}
                    </div>
                  )}
                  {(!avatarUrl || uploadingAvatar) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      {uploadingAvatar ? (
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      ) : (
                        <Upload size={32} className="text-white" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  {showAvatarUploader ? (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <MediaUploader
                        bucket="avatars"
                        path={profile.id}
                        onUploadComplete={(url) => {
                          setAvatarUrl(url);
                          setShowAvatarUploader(false);
                        }}
                        onError={(error) => {
                          alert(error);
                          setShowAvatarUploader(false);
                        }}
                        onUploadStart={() => setUploadingAvatar(true)}
                        onUploadEnd={() => setUploadingAvatar(false)}
                        enableCrop={true}
                        cropAspectRatio={1}
                        compressionOptions={{
                          maxWidth: 800,
                          maxHeight: 800,
                          quality: 0.9,
                          maxSizeMB: 2,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAvatarUploader(false)}
                        className="mt-2 text-sm text-slate-600 hover:text-slate-800"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAvatarUploader(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-full justify-center"
                      >
                        <Camera size={20} />
                        {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(null)}
                          className="text-sm text-red-600 hover:text-red-700 w-full text-center"
                        >
                          Supprimer la photo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-2">
                Nom d'affichage
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName || ''}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">@</span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-semibold text-slate-700 mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                rows={4}
                placeholder="Parlez-nous de vous, vos tricks préférés, votre histoire..."
                maxLength={500}
              />
              <p className="text-xs text-slate-500 mt-1">{bio.length}/500 caractères</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Niveau
              </label>
              <div className="grid grid-cols-2 gap-2">
                {skillLevels.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setSkillLevel(level.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      skillLevel === level.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Stance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {stances.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStance(s.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      stance === s.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || uploadingAvatar || uploadingCover}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
