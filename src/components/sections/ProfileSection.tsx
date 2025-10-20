import { useState, useEffect, useCallback } from 'react';
import { MapPin, Calendar, Award, Users, TrendingUp, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import { filterOutProfileMediaPosts } from '../../lib/postUtils';
import EditProfileModal from '../EditProfileModal';
import XPProgressBar from '../XPProgressBar';
import StatsDisplay from '../StatsDisplay';
import XPHistory from '../XPHistory';
import GamificationTester from '../GamificationTester';
import type { Profile, Post, UserXP, UserBadge } from '../../types';

interface ProfileSectionProps {
  profile: Profile | null;
}

export default function ProfileSection({ profile }: ProfileSectionProps) {
  const [profileData, setProfileData] = useState<Profile | null>(profile);
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({
    postsCount: 0,
    spotsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [userXP, setUserXP] = useState<UserXP | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    setProfileData(profile);
  }, [profile]);

  const loadProfileData = useCallback(
    async (profileId: string) => {
      try {
        const [
          postsResult,
          spotsResult,
          followersResult,
          followingResult,
          xpResult,
          badgesResult,
        ] = await Promise.all([
          supabase.from('posts').select('*', { count: 'exact' }).eq('user_id', profileId),
          supabase.from('spots').select('*', { count: 'exact' }).eq('created_by', profileId),
          supabase.from('follows').select('*', { count: 'exact' }).eq('following_id', profileId),
          supabase.from('follows').select('*', { count: 'exact' }).eq('follower_id', profileId),
          supabase.from('user_xp').select('*').eq('user_id', profileId).maybeSingle(),
          supabase
            .from('user_badges')
            .select('*, badge:badges(*)')
            .eq('user_id', profileId)
            .eq('is_displayed', true)
            .limit(5),
        ]);

        const filteredPosts = filterOutProfileMediaPosts(postsResult.data || []);
        setUserPosts(filteredPosts);
        setStats({
          postsCount: filteredPosts.length,
          spotsCount: spotsResult.count || 0,
          followersCount: followersResult.count || 0,
          followingCount: followingResult.count || 0,
        });
        setUserXP(xpResult.data);
        setUserBadges(badgesResult.data || []);
      } catch (error) {
        console.error('Error loading profile data:', error);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (profileData?.id) {
      setLoading(true);
      loadProfileData(profileData.id);
    }
  }, [profileData?.id, loadProfileData]);

  const refreshProfile = useCallback(
    async (profileId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .maybeSingle();

        if (error) throw error;
        setProfileData(data);
        return data;
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }

      return null;
    },
    [],
  );

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'stats', label: 'Statistiques' },
    { id: 'xp', label: 'Historique XP' },
    { id: 'badges', label: 'Badges' },
    { id: 'test', label: 'Test Gamification' },
  ];

  if (!profileData) {
    return (
      <div className="text-center py-12 text-gray-400">
        Chargement du profil...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-dark-800 rounded-xl border border-dark-700 mb-6">
        <div
          className={`relative h-48 rounded-t-xl overflow-hidden ${
            profileData.cover_url ? '' : 'bg-gradient-to-br from-dark-700 to-dark-600'
          }`}
        >
          {profileData.cover_url ? (
            <img
              src={profileData.cover_url}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : null}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-16 mb-4 relative z-10">
            <div className="flex items-end gap-4 mb-4 sm:mb-0">
              {profileData.avatar_url ? (
                <img
                  src={profileData.avatar_url}
                  alt={getUserDisplayName(profileData)}
                  className="w-32 h-32 rounded-full border-4 border-orange-500 object-cover shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-orange-500 bg-orange-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                  {getUserInitial(profileData)}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Edit Profile
            </button>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {getUserDisplayName(profileData)}
              <MapPin size={20} className="text-orange-500" />
            </h1>
            <p className="text-gray-400">{profileData.location || 'Los Angeles, CA'}</p>
          </div>

          {profileData.bio && (
            <p className="text-gray-300 mb-4">{profileData.bio}</p>
          )}

          {userXP && (
            <div className="mb-4">
              <XPProgressBar userXP={userXP} compact />
            </div>
          )}

          {userBadges.length > 0 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              {userBadges.map((userBadge) => (
                <div
                  key={userBadge.id}
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-2xl border-2 border-orange-500"
                  title={userBadge.badge?.name}
                >
                  {userBadge.badge?.icon}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mb-4">
            <button className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold">
              Follow
            </button>
            <button className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold">
              Message
            </button>
            <button className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold">
              Edit Profile
            </button>
          </div>

          <div className="flex justify-around border-t border-dark-700 pt-4">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.postsCount > 0 ? stats.postsCount : '1.5'}K</div>
              <div className="text-sm text-gray-400">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.followersCount > 0 ? stats.followersCount : '780'}</div>
              <div className="text-sm text-gray-400">Following</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.followingCount > 0 ? stats.followingCount : '4.2'}M</div>
              <div className="text-sm text-gray-400">Following</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{stats.spotsCount > 0 ? stats.spotsCount : 'Saved'}</div>
              <div className="text-sm text-gray-400">Saved</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="border-b border-dark-700">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-orange-500 border-b-2 border-orange-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : activeTab === 'stats' ? (
            <StatsDisplay profile={profileData} />
          ) : activeTab === 'xp' ? (
            <XPHistory profile={profileData} />
          ) : activeTab === 'badges' ? (
            <div className="p-4">
              <div className="flex flex-wrap gap-3">
                {userBadges.map((userBadge) => (
                  <div
                    key={userBadge.id}
                    className="bg-dark-900 rounded-lg p-4 border-2 border-orange-500 text-center"
                  >
                    <div className="text-4xl mb-2">{userBadge.badge?.icon}</div>
                    <div className="text-sm font-semibold text-white">{userBadge.badge?.name}</div>
                  </div>
                ))}
              </div>
              {userBadges.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Award size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Aucun badge débloqué</p>
                </div>
              )}
            </div>
          ) : activeTab === 'test' ? (
            <div className="p-4">
              <GamificationTester profile={profileData} />
            </div>
          ) : activeTab === 'posts' ? (
            userPosts.length === 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <div key={i} className="aspect-square bg-dark-700 rounded-lg overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-dark-600 to-dark-700 flex items-center justify-center">
                      <span className="text-4xl opacity-20">🛹</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {userPosts.map((post, index) => (
                  <div key={post.id} className="aspect-square bg-dark-700 rounded-lg overflow-hidden">
                    {post.media_urls && post.media_urls[0] ? (
                      <img src={post.media_urls[0]} alt="Post" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-dark-600 to-dark-700 flex items-center justify-center">
                        <span className="text-4xl opacity-20">🛹</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Contenu à venir</p>
            </div>
          )}
        </div>
      </div>

      {showEditModal && profileData && (
        <EditProfileModal
          profile={profileData}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            setShowEditModal(false);
            const updatedProfile = await refreshProfile(profileData.id);
            if (updatedProfile) {
              setLoading(true);
              await loadProfileData(updatedProfile.id);
            }
          }}
        />
      )}
    </div>
  );
}
