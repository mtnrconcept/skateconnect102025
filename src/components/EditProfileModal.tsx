import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
          <h2 className="text-2xl font-bold">Edit Profile</h2>
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
                Cover Photo
              </label>
              <div className="relative h-32 bg-slate-200 rounded-lg overflow-hidden">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Upload size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <MediaUploader
                    bucket="covers"
                    path={profile.id}
                    onUploadComplete={(url) => {
                      setCoverUrl(url);
                      setUploadingCover(false);
                    }}
                    onError={(error) => {
                      alert(error);
                      setUploadingCover(false);
                    }}
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
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-200">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-3xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Upload size={24} className="text-white" />
                  </div>
                </div>
                <MediaUploader
                  bucket="avatars"
                  path={profile.id}
                  onUploadComplete={(url) => {
                    setAvatarUrl(url);
                    setUploadingAvatar(false);
                  }}
                  onError={(error) => {
                    alert(error);
                    setUploadingAvatar(false);
                  }}
                  enableCrop={true}
                  cropAspectRatio={1}
                  compressionOptions={{
                    maxWidth: 800,
                    maxHeight: 800,
                    quality: 0.9,
                    maxSizeMB: 2,
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-2">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-semibold text-slate-700 mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Skill Level
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

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
