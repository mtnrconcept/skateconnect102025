import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import { filterOutProfileMediaPosts } from '../../lib/postUtils';
import EditProfileModal from '../EditProfileModal';
import XPProgressBar from '../XPProgressBar';
import StatsDisplay from '../StatsDisplay';
import XPHistory from '../XPHistory';
import GamificationTester from '../GamificationTester';
import PostMediaViewer from '../PostMediaViewer';
import SponsorProfileHero from '../profile/sponsor/SponsorProfileHero';
import SponsorContactPanel from '../profile/sponsor/SponsorContactPanel';
import type { Profile, Post, UserXP, UserBadge } from '../../types';

interface ProfileSectionProps {
  profile: Profile | null;
  currentUserId?: string | null;
  onOpenConversation?: (profileId: string) => Promise<void> | void;
  onProfileUpdate?: (profile: Profile) => void;
}

export default function ProfileSection({
  profile,
  currentUserId,
  onOpenConversation,
  onProfileUpdate,
}: ProfileSectionProps) {
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
  const [showGalleryViewer, setShowGalleryViewer] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [profileSnapshot, setProfileSnapshot] = useState<Profile | null>(null);
  const [isOpeningConversation, setIsOpeningConversation] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const handleAvatarPreview = useCallback((url: string | null) => {
    setProfileData((prev) => (prev ? { ...prev, avatar_url: url } : prev));
  }, []);

  const handleCoverPreview = useCallback((url: string | null) => {
    setProfileData((prev) => (prev ? { ...prev, cover_url: url } : prev));
  }, []);

  const handleModalClose = useCallback(() => {
    setShowEditModal(false);
    if (profileSnapshot) {
      setProfileData({ ...profileSnapshot });
    }
    setProfileSnapshot(null);
  }, [profileSnapshot]);

  const openEditModal = useCallback(() => {
    if (profileData) {
      setProfileSnapshot({ ...profileData });
    } else {
      setProfileSnapshot(null);
    }
    setShowEditModal(true);
  }, [profileData]);

  useEffect(() => {
    setProfileData(profile);
  }, [profile]);

  const viewerId = currentUserId ?? null;
  const viewedProfileId = profileData?.id ?? null;
  const isOwnProfile = Boolean(viewerId && viewedProfileId && viewerId === viewedProfileId);

  const isCertifiedProfile = useMemo(() => {
    if (!userBadges.length) {
      return false;
    }
    return userBadges.some((userBadge) => {
      const name = userBadge.badge?.name?.toLowerCase() ?? '';
      const category = userBadge.badge?.category?.toLowerCase() ?? '';
      return (
        name.includes('certif') ||
        category.includes('certif') ||
        name.includes('pro rider')
      );
    });
  }, [userBadges]);

  const canMessageCertifiedProfile = Boolean(
    onOpenConversation && viewedProfileId && !isOwnProfile && isCertifiedProfile,
  );

  const handleMessageClick = useCallback(async () => {
    if (!canMessageCertifiedProfile || !profileData?.id || !onOpenConversation) {
      return;
    }
    setMessageError(null);
    setIsOpeningConversation(true);
    try {
      await onOpenConversation(profileData.id);
    } catch (error) {
      console.error("Erreur lors de l'ouverture de la messagerie :", error);
      setMessageError("Impossible d'ouvrir la messagerie pour le moment.");
    } finally {
      setIsOpeningConversation(false);
    }
  }, [canMessageCertifiedProfile, onOpenConversation, profileData?.id]);

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
          supabase
            .from('posts')
            .select('*, user:profiles(*)', { count: 'exact' })
            .eq('user_id', profileId),
          supabase.from('spots').select('*', { count: 'exact' }).eq('created_by', profileId),
          supabase.from('follows').select('*', { count: 'exact' }).eq('following_id', profileId),
          supabase.from('follows').select('*', { count: 'exact' }).eq('follower_id', profileId),
          supabase.from('user_xp').select('*').eq('user_id', profileId).maybeSingle(),
          supabase
            .from('user_badges')
            .select('*, badge:badges(*)')
            .eq('user_id', profileId)
            .order('earned_at', { ascending: false }),
        ]);

        const filteredPosts = filterOutProfileMediaPosts(postsResult.data || []);

        if (profile?.id && filteredPosts.length > 0) {
          const postIds = filteredPosts.map((post) => post.id);
          const { data: likesData } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', profile.id)
            .in('post_id', postIds);
          const likedIds = new Set(likesData?.map((like) => like.post_id) || []);
          setUserPosts(filteredPosts.map((post) => ({
            ...post,
            liked_by_user: likedIds.has(post.id),
          })));
        } else {
          setUserPosts(filteredPosts);
        }

        const baseFollowers = profile?.legacy_followers_count ?? 0;
        const baseFollowing = profile?.legacy_following_count ?? 0;

        setStats({
          postsCount: filteredPosts.length,
          spotsCount: spotsResult.count || 0,
          followersCount: (followersResult.count || 0) + baseFollowers,
          followingCount: (followingResult.count || 0) + baseFollowing,
        });
        setUserXP(xpResult.data);
        setUserBadges(badgesResult.data || []);
      } catch (error) {
        console.error('Error loading profile data:', error);
      } finally {
        setLoading(false);
      }
    },
    [profile?.id, profile?.legacy_followers_count, profile?.legacy_following_count],
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
          .select(
            '*, sponsor_branding, sponsor_contact, sponsor_permissions, sponsor_media_kits'
          )
          .eq('id', profileId)
          .maybeSingle();

        if (error) throw error;
        setProfileData(data);
        if (data) {
          onProfileUpdate?.(data);
        }
        return data;
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }

      return null;
    },
    [onProfileUpdate],
  );

  const tabs = [
    { id: 'posts', label: 'Posts' },
    { id: 'stats', label: 'Statistiques' },
    { id: 'xp', label: 'Historique XP' },
    { id: 'badges', label: 'Badges' },
    { id: 'test', label: 'Test Gamification' },
  ];

  const mediaPosts = userPosts.filter((post) => post.media_urls && post.media_urls.length > 0);

  const isVideoUrl = (url: string) => {
    try {
      const cleanUrl = new URL(url, 'http://localhost').pathname || url;
      return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(cleanUrl);
    } catch {
      return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(url);
    }
  };

  const handlePostLike = async (postId: string) => {
    if (!profileData) return;

    const post = userPosts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.liked_by_user) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profileData.id);

        setUserPosts((prev) => prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_user: false, likes_count: Math.max(0, (p.likes_count || 0) - 1) }
            : p
        ));
      } else {
        await supabase
          .from('likes')
          .insert({
            user_id: profileData.id,
            post_id: postId,
          });

        setUserPosts((prev) => prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_user: true, likes_count: (p.likes_count || 0) + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleGalleryCommentCountChange = (postId: string, count: number) => {
    setUserPosts((prev) => prev.map((p) =>
      p.id === postId
        ? { ...p, comments_count: count }
        : p
    ));
  };

  if (!profileData) {
    return (
      <div className="text-center py-12 text-gray-400">
        Chargement du profil...
      </div>
    );
  }

  const isSponsorProfile = profileData.role === 'sponsor';

  return (
    <>
      <div className={`mx-auto px-4 py-6 ${isSponsorProfile ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {isSponsorProfile ? <SponsorProfileHero profile={profileData} /> : null}

        <div className={isSponsorProfile ? 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}>
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-xl border border-dark-700">
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
                  onClick={openEditModal}
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

              <div className="flex gap-3 mb-4 flex-wrap">
                <button className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold">
                  Follow
                </button>
                {canMessageCertifiedProfile && (
                  <button
                    type="button"
                    onClick={handleMessageClick}
                    disabled={isOpeningConversation}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isOpeningConversation ? 'Ouverture…' : 'Écrire un message'}
                  </button>
                )}
                <button
                  onClick={openEditModal}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
                >
                  Edit Profile
                </button>
              </div>
              {messageError && (
                <p className="text-sm text-red-400 -mt-2 mb-4">{messageError}</p>
              )}

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
                mediaPosts.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <p className="text-sm">Aucun média partagé pour le moment.</p>
                    <p className="text-xs text-gray-500 mt-1">Ajoutez une photo ou une vidéo pour alimenter votre galerie.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {mediaPosts.map((post, index) => {
                      const firstMedia = post.media_urls?.[0];
                      const isVideo = firstMedia ? isVideoUrl(firstMedia) : post.post_type === 'video';

                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => {
                            setActiveGalleryIndex(index);
                            setShowGalleryViewer(true);
                          }}
                          className="relative aspect-square bg-dark-700 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-500"
                          aria-label="Voir le média du post"
                        >
                          {firstMedia ? (
                            isVideo ? (
                              <video
                                src={firstMedia}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                loop
                              />
                            ) : (
                              <img src={firstMedia} alt="Post" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-dark-600 to-dark-700 flex items-center justify-center">
                              <span className="text-4xl opacity-20">🛹</span>
                            </div>
                          )}
                          {isVideo && (
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                              Vidéo
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Contenu à venir</p>
                </div>
              )}
            </div>
          </div>
        </div>

          {isSponsorProfile ? <SponsorContactPanel profile={profileData} /> : null}
        </div>
      </div>

      {showGalleryViewer && mediaPosts.length > 0 && profileData && (
        <PostMediaViewer
          posts={mediaPosts}
          initialPostIndex={activeGalleryIndex}
          initialMediaIndex={0}
          onClose={() => setShowGalleryViewer(false)}
          onLike={handlePostLike}
          currentUser={profileData}
          onCommentCountChange={handleGalleryCommentCountChange}
          fallbackUser={profileData}
        />
      )}

      {showEditModal && profileData && (
        <EditProfileModal
          profile={profileData}
          onClose={handleModalClose}
          onSaved={async () => {
            const updatedProfile = await refreshProfile(profileData.id);
            if (updatedProfile) {
              setProfileSnapshot(null);
              setShowEditModal(false);
              setLoading(true);
              await loadProfileData(updatedProfile.id);
            }
          }}
          onAvatarChange={handleAvatarPreview}
          onCoverChange={handleCoverPreview}
        />
      )}
    </>
  );
}
