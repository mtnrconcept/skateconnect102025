import { useState, useEffect } from 'react';
import { MapPin, Calendar, Award, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import EditProfileModal from '../EditProfileModal';
import type { Profile, Post } from '../../types';

interface ProfileSectionProps {
  profile: Profile | null;
}

export default function ProfileSection({ profile }: ProfileSectionProps) {
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({
    postsCount: 0,
    spotsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (profile) {
      loadProfileData();
    }
  }, [profile]);

  const loadProfileData = async () => {
    if (!profile) return;

    try {
      const [postsResult, spotsResult, followersResult, followingResult] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('spots').select('*', { count: 'exact' }).eq('created_by', profile.id),
        supabase.from('follows').select('*', { count: 'exact' }).eq('following_id', profile.id),
        supabase.from('follows').select('*', { count: 'exact' }).eq('follower_id', profile.id),
      ]);

      setUserPosts(postsResult.data || []);
      setStats({
        postsCount: postsResult.count || 0,
        spotsCount: spotsResult.count || 0,
        followersCount: followersResult.count || 0,
        followingCount: followingResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'spots', label: 'Spots' },
    { id: 'tricks', label: 'Tricks' },
    { id: 'achievements', label: 'Achievements' },
  ];

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-500">
        Chargement du profil...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="h-48 bg-gradient-to-br from-blue-500 to-cyan-500 relative">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-16 mb-4">
            <div className="flex items-end gap-4 mb-4 sm:mb-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={getUserDisplayName(profile)}
                  className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                  {getUserInitial(profile)}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Modifier le profil
            </button>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-800">{getUserDisplayName(profile)}</h1>
            <p className="text-slate-600">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="text-slate-700 mb-4">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
            <div className="flex items-center gap-1">
              <MapPin size={16} />
              <span>{profile.stance || 'Regular'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Award size={16} />
              <span className="capitalize">{profile.skill_level || 'Débutant'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Membre depuis {new Date(profile.created_at).getFullYear()}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.postsCount}</div>
              <div className="text-sm text-slate-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.spotsCount}</div>
              <div className="text-sm text-slate-600">Spots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.followersCount}</div>
              <div className="text-sm text-slate-600">Abonnés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.followingCount}</div>
              <div className="text-sm text-slate-600">Abonnements</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Chargement...</div>
          ) : activeTab === 'posts' ? (
            userPosts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>Aucun post pour le moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userPosts.map((post) => (
                  <div key={post.id} className="border border-slate-200 rounded-lg p-4">
                    <p className="text-slate-700 mb-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>{post.likes_count} likes</span>
                      <span>{post.comments_count} commentaires</span>
                      <span>{new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p>Contenu à venir</p>
            </div>
          )}
        </div>
      </div>

      {showEditModal && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            loadProfileData();
          }}
        />
      )}
    </div>
  );
}
