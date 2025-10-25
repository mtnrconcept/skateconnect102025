import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  MapPin,
  Send,
  Video,
  X,
  Image as ImageIcon,
  Loader2,
  CalendarDays,
  Flag,
  Award,
  Users,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import { uploadFile } from '../../lib/storage';
import { filterOutProfileMediaPosts } from '../../lib/postUtils';
import { compressImage, validateMediaFile } from '../../lib/imageCompression';
import CommentSection from '../CommentSection';
import FakeCommentSection from '../FakeCommentSection';
import PostMediaViewer from '../PostMediaViewer';
import FakeProfileModal from '../FakeProfileModal';
import FakeDirectMessageModal from '../FakeDirectMessageModal';
import ProfilePreviewModal from '../ProfilePreviewModal';
import { fakeFeedPosts, fakeProfilesById, fakePostsByProfileId, fakeLeaderboardEntries } from '../../data/fakeFeed';
import { eventsCatalog } from '../../data/eventsCatalog';
import { createFallbackChallenges } from '../../data/challengesCatalog';
import type { FakeProfileDetails } from '../../data/fakeFeed';
import type { Comment, Post, Profile } from '../../types';

type FeedPost = Post & {
  liked_by_user?: boolean;
  isFake?: boolean;
  segments?: ('all' | 'following' | 'local')[];
};

type FeedComment = Comment & {
  user: Profile | FakeProfileDetails;
};

interface FeedSectionProps {
  currentUser: Profile | null;
}

export default function FeedSection({ currentUser }: FeedSectionProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([]);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activeStoryMediaIndex, setActiveStoryMediaIndex] = useState(0);
  const [activeFakeProfileId, setActiveFakeProfileId] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});
  const [fakeFollowingMap, setFakeFollowingMap] = useState<Record<string, boolean>>({});
  const [fakeCommentsMap, setFakeCommentsMap] = useState<Record<string, FeedComment[]>>(() => {
    const initial: Record<string, FeedComment[]> = {};
    fakeFeedPosts.forEach((post) => {
      initial[post.id] = (post.fakeComments ?? []).map((comment) => ({
        ...comment,
        user: comment.user,
      }));
    });
    return initial;
  });
  const [activeFakeMessageProfileId, setActiveFakeMessageProfileId] = useState<string | null>(null);

  const upcomingEvents = useMemo(() => eventsCatalog.slice(0, 3), []);
  const sponsorChallenges = useMemo(
    () => createFallbackChallenges().filter((challenge) => challenge.challenge_type === 'brand').slice(0, 2),
    [],
  );
  const topAthletes = useMemo(() => fakeLeaderboardEntries.slice(0, 3), []);

  const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

  const formatChallengeDeadline = (endDate?: string | null) => {
    if (!endDate) return null;
    const parsed = new Date(endDate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const now = new Date();
    const diffMs = parsed.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Se termine aujourd'hui";
    }
    if (diffDays === 1) {
      return 'Se termine demain';
    }
    if (diffDays < 14) {
      return `Se termine dans ${diffDays} jours`;
    }
    return `Se termine le ${parsed.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    })}`;
  };

  const formatLastUpdate = (date?: string | null) => {
    if (!date) return null;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) {
      return 'Mise à jour à l’instant';
    }
    if (diffMinutes < 60) {
      return `Mise à jour il y a ${diffMinutes} min`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `Mise à jour il y a ${diffHours} h`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Mise à jour il y a 1 jour';
    }
    if (diffDays < 7) {
      return `Mise à jour il y a ${diffDays} jours`;
    }
    return `Mis à jour le ${parsed.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    })}`;
  };

  useEffect(() => {
    loadPosts();
  }, [currentUser?.id]);

  const sortPostsByDateDesc = (data: FeedPost[]) =>
    [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const loadFallbackPosts = () => {
    const clones = fakeFeedPosts.map((post) => ({
      ...post,
      comments_count: fakeCommentsMap[post.id]?.length ?? 0,
    }));
    setPosts(sortPostsByDateDesc(clones));
    setFollowingMap({});
    setFollowLoadingMap({});
  };

  const loadFollowingState = useCallback(async (fetchedPosts: FeedPost[]) => {
    if (!currentUser) {
      setFollowingMap({});
      return;
    }

    const uniqueUserIds = Array.from(
      new Set(
        fetchedPosts
          .filter((post) => !post.isFake)
          .map((post) => post.user_id)
          .filter((id): id is string => Boolean(id && id !== currentUser.id)),
      ),
    );

    if (uniqueUserIds.length === 0) {
      setFollowingMap({});
      return;
    }

    try {
      const { data: followRows, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)
        .in('following_id', uniqueUserIds);

      if (error) throw error;

      const map: Record<string, boolean> = {};
      (followRows ?? []).forEach((row: { following_id: string | null }) => {
        if (row.following_id) {
          map[row.following_id] = true;
        }
      });

      setFollowingMap(map);
    } catch (error) {
      console.error('Error loading follow status:', error);
    }
  }, [currentUser]);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, user:profiles(*), spot:spots(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filteredData = filterOutProfileMediaPosts(data || []) as FeedPost[];
      let postsWithLikes: FeedPost[] = filteredData.map((post) => ({ ...post }));

      if (currentUser && postsWithLikes.length > 0) {
        const postIds = postsWithLikes.map((p) => p.id);
        const { data: likes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds);

        const likedIds = new Set(likes?.map((l) => l.post_id) || []);
        postsWithLikes = postsWithLikes.map((p) => ({
          ...p,
          liked_by_user: likedIds.has(p.id),
        }));
      }

      const fakePostsForFeed = fakeFeedPosts.map((post) => ({
        ...post,
        comments_count: fakeCommentsMap[post.id]?.length ?? 0,
      }));
      const combinedPosts = [...postsWithLikes, ...fakePostsForFeed];
      const sorted = sortPostsByDateDesc(combinedPosts);
      setPosts(sorted);
      await loadFollowingState(sorted);
    } catch (error) {
      console.error('Error loading posts:', error);
      loadFallbackPosts();
    } finally {
      setLoading(false);
    }
  };

  const toggleFakeFollow = (profileId: string) => {
    if (!currentUser) {
      alert('Connectez-vous pour suivre ce profil.');
      return;
    }

    setFakeFollowingMap((previous) => {
      const next = { ...previous };
      if (next[profileId]) {
        delete next[profileId];
      } else {
        next[profileId] = true;
      }
      return next;
    });
  };

  const handleFakeCommentAdd = (postId: string, content: string) => {
    if (!currentUser) {
      alert('Connectez-vous pour commenter ce post.');
      return;
    }

    const newComment: FeedComment = {
      id: `local-${postId}-${Date.now()}`,
      post_id: postId,
      user_id: currentUser.id,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: currentUser,
    };

    setFakeCommentsMap((previous) => {
      const existing = previous[postId] ?? [];
      const nextList = [...existing, newComment];
      const nextMap = { ...previous, [postId]: nextList };
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId && post.isFake
            ? { ...post, comments_count: nextList.length }
            : post,
        ),
      );
      return nextMap;
    });
  };

  const handleFakeCommentDelete = (postId: string, commentId: string) => {
    setFakeCommentsMap((previous) => {
      const existing = previous[postId] ?? [];
      const target = existing.find((comment) => comment.id === commentId);
      if (target && currentUser && target.user_id !== currentUser.id) {
        return previous;
      }

      const nextList = existing.filter((comment) => comment.id !== commentId);
      const nextMap = { ...previous, [postId]: nextList };
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId && post.isFake
            ? { ...post, comments_count: nextList.length }
            : post,
        ),
      );
      return nextMap;
    });
  };

  const toggleFollow = useCallback(async (userId: string): Promise<boolean | null> => {
    if (!currentUser || !userId || userId === currentUser.id) {
      return null;
    }

    const isFollowing = !!followingMap[userId];

    setFollowLoadingMap((prev) => ({ ...prev, [userId]: true }));

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: userId });

        if (error) throw error;
      }

      setFollowingMap((prev) => {
        const next = { ...prev };
        if (isFollowing) {
          delete next[userId];
        } else {
          next[userId] = true;
        }
        return next;
      });

      return !isFollowing;
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Échec de la mise à jour du suivi');
      return null;
    } finally {
      setFollowLoadingMap((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }, [currentUser, followingMap]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPostContent.trim() && uploadedMedia.length === 0) || !currentUser) return;

    try {
      const postType = uploadedMedia.length > 0
        ? (mediaPreview[0]?.type === 'video' ? 'video' : 'photo')
        : 'text';

      const { error } = await supabase.from('posts').insert({
        user_id: currentUser.id,
        content: newPostContent,
        media_urls: uploadedMedia,
        post_type: postType,
      });

      if (error) throw error;

      setNewPostContent('');
      setUploadedMedia([]);
      setMediaPreview([]);
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Échec de la publication du post');
    }
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const validation = validateMediaFile(file, {
          allowedTypes: type === 'video'
            ? ['video/mp4', 'video/quicktime', 'video/webm']
            : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maxSizeMB: type === 'video' ? 50 : 10,
        });

        if (!validation.valid) {
          alert(validation.error);
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        setMediaPreview(prev => [...prev, { url: previewUrl, type }]);

        let fileToUpload = file;
        if (type === 'image') {
          const compressed = await compressImage(file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.85,
            maxSizeMB: 5,
          });
          fileToUpload = compressed.file;
        }

        const result = await uploadFile('posts', fileToUpload);
        setUploadedMedia(prev => [...prev, result.url]);
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Échec du téléchargement du média');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setMediaPreview(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
    setUploadedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.isFake) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? {
              ...p,
              liked_by_user: !p.liked_by_user,
              likes_count: Math.max(0, (p.likes_count || 0) + (p.liked_by_user ? -1 : 1)),
            }
            : p
        ));
        return;
      }
      if (post.liked_by_user) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);

        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: false, likes_count: Math.max(0, (p.likes_count || 0) - 1) }
            : p
        ));
      } else {
        await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            post_id: postId,
          });

        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: true, likes_count: (p.likes_count || 0) + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  const handleCommentCountChange = (postId: string, count: number) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, comments_count: count }
        : p
    ));
  };

  const storyPosts = posts.filter((post) => post.media_urls && post.media_urls.length > 0);

  const activeFakeProfile = useMemo(() => {
    if (!activeFakeProfileId) return null;
    return fakeProfilesById[activeFakeProfileId] ?? null;
  }, [activeFakeProfileId]);

  const activeFakeMessageProfile = useMemo(() => {
    if (!activeFakeMessageProfileId) return null;
    return fakeProfilesById[activeFakeMessageProfileId] ?? null;
  }, [activeFakeMessageProfileId]);

  const getFakeFollowerCount = useCallback(
    (profileId: string) => {
      const profile = fakeProfilesById[profileId];
      if (!profile) {
        return 0;
      }
      return profile.followers + (fakeFollowingMap[profileId] ? 1 : 0);
    },
    [fakeFollowingMap],
  );

  const activeFakeProfilePosts = useMemo(() => {
    if (!activeFakeProfileId) return [];
    const fallback = fakePostsByProfileId[activeFakeProfileId] || [];
    const inFeed = posts.filter((post) => post.user_id === activeFakeProfileId && post.isFake);
    if (inFeed.length > 0) {
      return inFeed;
    }
    return fallback;
  }, [activeFakeProfileId, posts]);

  const handleAvatarClick = (post: FeedPost) => {
    if (post.isFake) {
      setActiveProfileId(null);
      setActiveFakeProfileId(post.user_id);
      return;
    }
    if (post.user_id) {
      setActiveFakeProfileId(null);
      setActiveProfileId(post.user_id);
    }
  };

  const isVideoUrl = (url: string) => {
    try {
      const cleanUrl = new URL(url, 'http://localhost').pathname || url;
      return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(cleanUrl);
    } catch {
      return /(\.mp4$|\.mov$|\.webm$|\.ogg$)/i.test(url);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-dark-700/80 bg-dark-900/60 p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-orange-500/10 p-2 text-orange-400">
                  <Users size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Ton fil d'actu</p>
                  <p className="text-lg font-semibold text-white">Partage ta session</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar sm:mt-10">
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="h-16 w-16 rounded-full border-2 border-orange-500 p-0.5">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt="Your story"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-orange-500 text-white font-semibold">
                      {getUserInitial(currentUser)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400">You</span>
              </div>
              {storyPosts.slice(0, 10).map((post, idx) => (
                <button
                  key={post.id}
                  className="flex-shrink-0 flex flex-col items-center gap-1 focus:outline-none"
                  onClick={() => {
                    setActiveStoryIndex(idx);
                    setActiveStoryMediaIndex(0);
                    setShowStoryViewer(true);
                  }}
                >
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-orange-500 p-0.5">
                    {post.media_urls?.[0] ? (
                      isVideoUrl(post.media_urls[0]) ? (
                        <video
                          src={post.media_urls[0]}
                          className="h-full w-full rounded-full object-cover"
                          muted
                          playsInline
                          loop
                        />
                      ) : (
                        <img
                          src={post.media_urls[0]}
                          alt={getUserDisplayName(post.user)}
                          className="h-full w-full rounded-full object-cover"
                        />
                      )
                    ) : post.user?.avatar_url ? (
                      <img
                        src={post.user.avatar_url}
                        alt={getUserDisplayName(post.user)}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                        {getUserInitial(post.user)}
                      </div>
                    )}
                  </div>
                  <span className="max-w-[64px] truncate text-xs text-gray-400">{post.user?.username || 'Story'}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-dark-700/60 bg-dark-800/80 p-4 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.8)]">
              <form onSubmit={handleCreatePost}>
                <div className="flex gap-3">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={getUserDisplayName(currentUser)}
                      className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-orange-500 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500 text-white font-semibold">
                      {getUserInitial(currentUser)}
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Partagez votre session, un nouveau trick, ou un spot découvert..."
                      className="w-full resize-none border-0 bg-dark-800 text-white placeholder-gray-500 focus:ring-0"
                      rows={3}
                    />

                    {mediaPreview.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {mediaPreview.map((preview, index) => (
                          <div key={index} className="relative aspect-video overflow-hidden rounded-lg bg-dark-700">
                            {preview.type === 'image' ? (
                              <img src={preview.url} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                            ) : (
                              <video src={preview.url} className="h-full w-full object-cover" controls />
                            )}
                            <button
                              type="button"
                              onClick={() => removeMedia(index)}
                              className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600 shadow-lg"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {uploading && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-orange-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                        <span>Chargement des médias...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dark-700 pt-4 text-sm text-gray-400">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-dark-700/80 px-3 py-2 transition-colors hover:border-orange-500/60 hover:text-white"
                    >
                      <ImageIcon size={18} className="text-orange-400" />
                      <span>Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-dark-700/80 px-3 py-2 transition-colors hover:border-orange-500/60 hover:text-white"
                    >
                      <Video size={18} className="text-orange-400" />
                      <span>Vidéo</span>
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={(!newPostContent.trim() && uploadedMedia.length === 0) || uploading}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={18} />
                    <span>Publier</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-dark-700/80 bg-dark-900/60 p-4 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.9)]">
            {loading ? (
              <div className="flex min-h-[200px] items-center justify-center text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : posts.length === 0 ? (
              <div className="space-y-2 py-12 text-center text-gray-400">
                <p className="text-lg font-semibold text-white/80">Aucun post pour le moment</p>
                <p className="text-sm text-gray-500">Soyez le premier à partager quelque chose!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="overflow-hidden rounded-xl border border-dark-700/70 bg-dark-800/80">
                    <div className="p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleAvatarClick(post)}
                          className={`group relative flex-shrink-0 focus:outline-none ${
                            post.isFake ? 'rounded-full focus-visible:ring-2 focus-visible:ring-orange-500' : ''
                          }`}
                          title={post.isFake ? 'Voir le profil' : getUserDisplayName(post.user)}
                        >
                          {post.user?.avatar_url ? (
                            <img
                              src={post.user.avatar_url}
                              alt={getUserDisplayName(post.user)}
                              className={`h-10 w-10 rounded-full border-2 object-cover ${
                                post.isFake
                                  ? 'border-orange-500 transition-colors group-hover:border-orange-400'
                                  : 'border-orange-500'
                              }`}
                            />
                          ) : (
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-500 text-white font-semibold ${
                                post.isFake ? 'transition-colors group-hover:bg-orange-400' : ''
                              }`}
                            >
                              {getUserInitial(post.user)}
                            </div>
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{getUserDisplayName(post.user)}</span>
                            <MapPin size={14} className="text-orange-500" />
                          </div>
                          <div className="text-xs text-gray-500">{formatDate(post.created_at)}</div>
                        </div>
                        {currentUser && !post.isFake && post.user_id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => void toggleFollow(post.user_id)}
                            disabled={!!followLoadingMap[post.user_id]}
                            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                              followingMap[post.user_id]
                                ? 'border border-orange-500/60 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            } ${followLoadingMap[post.user_id] ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {followLoadingMap[post.user_id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : followingMap[post.user_id] ? (
                              'Abonné·e'
                            ) : (
                              'Suivre'
                            )}
                          </button>
                        )}
                        {currentUser && post.isFake && (
                          <button
                            type="button"
                            onClick={() => toggleFakeFollow(post.user_id)}
                            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                              fakeFollowingMap[post.user_id]
                                ? 'border border-orange-500/60 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {fakeFollowingMap[post.user_id] ? 'Suivi·e' : 'Suivre'}
                          </button>
                        )}
                      </div>

                      {post.content && <p className="mb-3 whitespace-pre-wrap text-gray-300">{post.content}</p>}

                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className={`mb-3 grid gap-2 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.media_urls.map((url, index) => (
                            <div key={index} className="relative overflow-hidden rounded-lg bg-dark-700">
                              {post.post_type === 'video' ? (
                                <video src={url} className="aspect-video w-full object-cover" controls playsInline />
                              ) : (
                                <img src={url} alt={`Media ${index + 1}`} className="w-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {post.spot && (
                        <div className="mb-3 flex items-center gap-2 text-sm text-orange-500">
                          <MapPin size={16} />
                          <span>{post.spot.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dark-700 bg-dark-900/30 px-4 py-3">
                      <div className="mb-2 flex items-center gap-4">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`transition-colors ${
                            post.liked_by_user
                              ? 'text-orange-500'
                              : 'text-gray-400 hover:text-orange-500'
                          }`}
                        >
                          <Heart size={24} className={post.liked_by_user ? 'fill-current' : ''} />
                        </button>
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedComments);
                            if (newExpanded.has(post.id)) {
                              newExpanded.delete(post.id);
                            } else {
                              newExpanded.add(post.id);
                            }
                            setExpandedComments(newExpanded);
                          }}
                          className="text-gray-400 transition-colors hover:text-white"
                        >
                          <MessageCircle size={24} />
                        </button>
                        <button
                          className={`text-gray-400 transition-colors ${post.isFake ? 'hover:text-white' : 'cursor-not-allowed opacity-60'}`}
                          onClick={() => {
                            if (!post.isFake) {
                              return;
                            }
                            if (!currentUser) {
                              alert('Connectez-vous pour envoyer un message.');
                              return;
                            }
                            setActiveFakeMessageProfileId(post.user_id);
                          }}
                          type="button"
                        >
                          <Send size={24} />
                        </button>
                      </div>
                      <div className="mb-1 text-sm text-white">
                        <span className="font-semibold">Liked by {post.likes_count || 1234}</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold text-white">{post.user?.username}</span>{' '}
                        {post.content?.substring(0, 80) || 'Sunset session was insane! New trick unlocked!'}
                        {post.content && post.content.length > 80 && '...'}
                      </p>
                      {post.comments_count > 0 && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedComments);
                            if (newExpanded.has(post.id)) {
                              newExpanded.delete(post.id);
                            } else {
                              newExpanded.add(post.id);
                            }
                            setExpandedComments(newExpanded);
                          }}
                          className="mt-1 text-sm text-gray-500"
                        >
                          View all {post.comments_count} comments
                        </button>
                      )}
                    </div>

                    {expandedComments.has(post.id) && (
                      <div className="border-t border-dark-700 bg-dark-900/40 px-4 py-4">
                        {post.isFake ? (
                          <FakeCommentSection
                            comments={fakeCommentsMap[post.id] ?? []}
                            currentUser={currentUser}
                            onAddComment={(content) => handleFakeCommentAdd(post.id, content)}
                            onDeleteComment={(commentId) => handleFakeCommentDelete(post.id, commentId)}
                          />
                        ) : (
                          <CommentSection
                            postId={post.id}
                            currentUser={currentUser}
                            onCommentCountChange={(count) => handleCommentCountChange(post.id, count)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <aside className="hidden lg:flex lg:flex-col lg:gap-6">
          <section className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-dark-900/80 via-dark-900/60 to-dark-900/30 p-5 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="rounded-full bg-orange-500/10 p-2 text-orange-400">
                  <CalendarDays size={18} />
                </span>
                <h3 className="text-sm font-semibold uppercase tracking-wide">Événements à venir</h3>
              </div>
              <span className="rounded-full border border-orange-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
                Top 3
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="rounded-xl border border-dark-700/70 bg-dark-900/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{event.title}</p>
                    {event.is_sponsor_event && (
                      <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                        Sponsor
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{event.date}</p>
                  <div className="mt-3 flex flex-col gap-2 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-orange-400" />
                      <span>{event.location}</span>
                    </div>
                    {event.time && (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-orange-400" />
                        <span>{event.time}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-white/80">
                      <Users size={14} className="text-orange-400" />
                      <span className="font-medium">{formatNumber(event.attendees)}</span>
                      <span className="text-gray-500">participants</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-dark-900/80 via-dark-900/55 to-dark-800/60 p-5 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="rounded-full bg-orange-500/10 p-2 text-orange-400">
                <Flag size={18} />
              </span>
              <h3 className="text-sm font-semibold uppercase tracking-wide">Défis sponsors</h3>
            </div>
            <ul className="mt-4 space-y-4">
              {sponsorChallenges.map((challenge) => {
                const deadlineLabel = formatChallengeDeadline(challenge.end_date);
                return (
                  <li key={challenge.id} className="rounded-xl border border-dark-700/70 bg-dark-900/50 p-4">
                    <p className="text-sm font-semibold text-white">{challenge.title}</p>
                    <p className="mt-1 text-xs text-gray-400">{challenge.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1 text-gray-300">
                        <Users size={14} className="text-orange-400" />
                        {formatNumber(challenge.participants_count ?? 0)} participants
                      </span>
                      <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                        Récompense
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-orange-300">{challenge.prize}</p>
                    {deadlineLabel && (
                      <p className="mt-2 text-[11px] uppercase tracking-wide text-gray-500">{deadlineLabel}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-dark-900/80 via-dark-900/55 to-dark-800/60 p-5 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="rounded-full bg-orange-500/10 p-2 text-orange-400">
                <Award size={18} />
              </span>
              <h3 className="text-sm font-semibold uppercase tracking-wide">Meilleurs sportifs du moment</h3>
            </div>
            <ul className="mt-4 space-y-4">
              {topAthletes.map((entry, index) => {
                const lastUpdate = formatLastUpdate(entry.updated_at);
                return (
                  <li
                    key={entry.user_id}
                    className="flex items-start gap-3 rounded-xl border border-dark-700/70 bg-dark-900/40 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/40 text-sm font-semibold text-orange-300">
                      #{index + 1}
                    </div>
                    <div className="flex items-start gap-3">
                      {entry.profile.avatar_url ? (
                        <img
                          src={entry.profile.avatar_url}
                          alt={getUserDisplayName(entry.profile)}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                          {getUserInitial(entry.profile)}
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">{getUserDisplayName(entry.profile)}</p>
                        <p className="text-xs text-orange-300">{entry.level_title}</p>
                        <p className="text-xs text-gray-300">
                          {formatNumber(entry.total_xp)} XP · Niveau {entry.current_level}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Prochain palier dans {formatNumber(entry.xp_to_next_level)} XP
                        </p>
                        {lastUpdate && (
                          <p className="text-[10px] uppercase tracking-wide text-gray-600">{lastUpdate}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {showStoryViewer && storyPosts.length > 0 && (
        <PostMediaViewer
          posts={storyPosts}
          initialPostIndex={activeStoryIndex}
          initialMediaIndex={activeStoryMediaIndex}
          onClose={() => setShowStoryViewer(false)}
          onLike={handleLike}
          currentUser={currentUser}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
      {activeFakeProfile && (
        <FakeProfileModal
          profile={activeFakeProfile}
          posts={activeFakeProfilePosts}
          onClose={() => setActiveFakeProfileId(null)}
          onPostLike={handleLike}
          onToggleFollow={() => toggleFakeFollow(activeFakeProfile.id)}
          isFollowing={!!fakeFollowingMap[activeFakeProfile.id]}
          onMessage={() => {
            if (!currentUser) {
              alert('Connectez-vous pour envoyer un message.');
              return;
            }
            setActiveFakeProfileId(null);
            setActiveFakeMessageProfileId(activeFakeProfile.id);
          }}
          followerCount={getFakeFollowerCount(activeFakeProfile.id)}
        />
      )}
      {activeProfileId && (
        <ProfilePreviewModal
          profileId={activeProfileId}
          currentUserId={currentUser?.id}
          onClose={() => setActiveProfileId(null)}
          onToggleFollow={toggleFollow}
          isFollowing={!!followingMap[activeProfileId]}
          isFollowLoading={!!followLoadingMap[activeProfileId]}
        />
      )}
      {activeFakeMessageProfile && (
        <FakeDirectMessageModal
          profile={activeFakeMessageProfile}
          currentUser={currentUser}
          onClose={() => setActiveFakeMessageProfileId(null)}
        />
      )}
    </div>
  );
}
