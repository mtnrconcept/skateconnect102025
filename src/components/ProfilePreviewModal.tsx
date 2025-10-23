import { useEffect, useMemo, useState } from 'react';
import { MapPin, Users, Award, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { filterOutProfileMediaPosts } from '../lib/postUtils';
import { getUserDisplayName } from '../lib/userUtils';
import type { Post, Profile } from '../types';

interface ProfilePreviewModalProps {
  profileId: string;
  currentUserId?: string;
  onClose: () => void;
  onToggleFollow?: (profileId: string) => Promise<boolean | null>;
  isFollowing?: boolean;
  isFollowLoading?: boolean;
}

type ProfileWithDetails = Profile & {
  sponsors?: string[] | null;
  favorite_tricks?: string[] | null;
  achievements?: string[] | null;
  location?: string | null;
  legacy_followers_count?: number | null;
  legacy_following_count?: number | null;
};

interface ProfileStats {
  followers: number;
  following: number;
  posts: number;
}

const numberFormatter = new Intl.NumberFormat('fr-FR');

export default function ProfilePreviewModal({
  profileId,
  currentUserId,
  onClose,
  onToggleFollow,
  isFollowing,
  isFollowLoading,
}: ProfilePreviewModalProps) {
  const [profile, setProfile] = useState<ProfileWithDetails | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ followers: 0, following: 0, posts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localFollowing, setLocalFollowing] = useState<boolean>(isFollowing ?? false);

  useEffect(() => {
    setLocalFollowing(isFollowing ?? false);
  }, [isFollowing, profileId]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const [profileResult, postsResult, followersResult, followingResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .maybeSingle(),
          supabase
            .from('posts')
            .select('*, user:profiles(*)')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false })
            .limit(6),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profileId),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', profileId),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (postsResult.error) throw postsResult.error;
        if (followersResult.error) throw followersResult.error;
        if (followingResult.error) throw followingResult.error;
        if (!profileResult.data) throw new Error('Profil introuvable');

        const filteredPosts = filterOutProfileMediaPosts(postsResult.data || []);

        if (isMounted) {
          setProfile(profileResult.data as ProfileWithDetails);
          setPosts(filteredPosts);

          const baseFollowers = profileResult.data?.legacy_followers_count ?? 0;
          const baseFollowing = profileResult.data?.legacy_following_count ?? 0;
          const followersCount = (followersResult.count ?? 0) + baseFollowers;
          const followingCount = (followingResult.count ?? 0) + baseFollowing;

          setStats({
            followers: followersCount,
            following: followingCount,
            posts: filteredPosts.length,
          });
        }
      } catch (err) {
        console.error('Error loading profile preview:', err);
        if (isMounted) {
          setError("Impossible de charger ce profil");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [profileId]);

  const isOwnProfile = currentUserId === profileId;

  const sponsors = useMemo(() => profile?.sponsors ?? [], [profile]);
  const favoriteTricks = useMemo(() => profile?.favorite_tricks ?? [], [profile]);
  const achievements = useMemo(() => profile?.achievements ?? [], [profile]);

  const handleFollow = async () => {
    if (!onToggleFollow || isOwnProfile) return;

    const previous = localFollowing;

    try {
      const result = await onToggleFollow(profileId);
      if (typeof result === 'boolean') {
        setLocalFollowing(result);
        setStats((prev) => ({
          ...prev,
          followers: Math.max(
            0,
            prev.followers + (result && !previous ? 1 : !result && previous ? -1 : 0),
          ),
        }));
      }
    } catch (err) {
      console.error('Error toggling follow from modal:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-dark-700 bg-[#101019] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-gray-300 transition-colors hover:text-white"
          aria-label="Fermer le profil"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="flex h-80 flex-col items-center justify-center gap-4 text-gray-400">
            <Award size={32} className="text-orange-500" />
            <p>{error}</p>
          </div>
        ) : !profile ? (
          <div className="flex h-80 items-center justify-center text-gray-400">Profil introuvable</div>
        ) : (
          <div>
            {profile.cover_url ? (
              <div className="h-40 w-full overflow-hidden">
                <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-32 w-full bg-gradient-to-r from-orange-500/40 via-pink-500/30 to-purple-500/40" />
            )}

            <div className="-mt-12 px-6 pb-6">
              <div className="flex flex-col gap-6 rounded-3xl border border-dark-700 bg-[#13131d] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl border-2 border-orange-500/70 bg-orange-500/20">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={getUserDisplayName(profile)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                        {getUserDisplayName(profile).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">{getUserDisplayName(profile)}</h2>
                      <p className="text-sm text-gray-400">@{profile.username}</p>
                    </div>
                    {profile.bio && <p className="text-sm leading-relaxed text-gray-300">{profile.bio}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      {profile.location && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1">
                          <MapPin size={14} className="text-orange-400" />
                          {profile.location}
                        </span>
                      )}
                      {profile.skill_level && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 px-3 py-1">
                          <Sparkles size={14} className="text-orange-400" />
                          {profile.skill_level}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isOwnProfile && onToggleFollow && (
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={isFollowLoading}
                      className={`flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        localFollowing
                          ? 'border border-orange-500/60 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      } ${isFollowLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isFollowLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : localFollowing ? (
                        'Abonné·e'
                      ) : (
                        'Suivre'
                      )}
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Followers</div>
                    <div className="text-xl font-semibold text-white">
                      {numberFormatter.format(stats.followers)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Following</div>
                    <div className="text-xl font-semibold text-white">
                      {numberFormatter.format(stats.following)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dark-700 bg-[#181821] px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Posts</div>
                    <div className="text-xl font-semibold text-white">{stats.posts}</div>
                  </div>
                </div>

                {(sponsors.length > 0 || achievements.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sponsors.length > 0 && (
                      <div className="rounded-2xl border border-dark-700 bg-[#181821] p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Users size={16} className="text-orange-400" />
                          Sponsors
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                          {sponsors.map((sponsor) => (
                            <span
                              key={sponsor}
                              className="rounded-full border border-orange-500/40 px-3 py-1 text-orange-300"
                            >
                              {sponsor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {achievements.length > 0 && (
                      <div className="rounded-2xl border border-dark-700 bg-[#181821] p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Award size={16} className="text-orange-400" />
                          Highlights
                        </div>
                        <ul className="space-y-1 text-xs text-gray-300">
                          {achievements.map((achievement) => (
                            <li key={achievement}>• {achievement}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {favoriteTricks.length > 0 && (
                  <div className="rounded-2xl border border-dark-700 bg-[#181821] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                      <Sparkles size={16} className="text-orange-400" />
                      Tricks favoris
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                      {favoriteTricks.map((trick) => (
                        <span key={trick} className="rounded-full border border-dark-600 px-3 py-1">
                          {trick}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {posts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Posts récents</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {posts.map((post) => (
                        <div key={post.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-dark-700 bg-[#181821]">
                          {post.media_urls && post.media_urls.length > 0 && (
                            <div className="relative h-40 w-full overflow-hidden">
                              <img
                                src={post.media_urls[0]}
                                alt={post.content?.slice(0, 40) ?? 'Post'}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-1 flex-col gap-3 p-4">
                            <p className="text-sm text-gray-200">{post.content}</p>
                            <div className="flex gap-4 text-xs text-gray-400">
                              <span>❤️ {numberFormatter.format(post.likes_count || 0)}</span>
                              <span>💬 {numberFormatter.format(post.comments_count || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
