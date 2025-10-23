import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Heart, MessageCircle, MapPin, Send, Video, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import { uploadFile } from '../../lib/storage';
import { filterOutProfileMediaPosts } from '../../lib/postUtils';
import { compressImage, validateMediaFile } from '../../lib/imageCompression';
import CommentSection from '../CommentSection';
import PostMediaViewer from '../PostMediaViewer';
import FakeProfileModal from '../FakeProfileModal';
import ProfilePreviewModal from '../ProfilePreviewModal';
import { fakeFeedPosts, fakeProfilesById, fakePostsByProfileId } from '../../data/fakeFeed';
import type { Post, Profile } from '../../types';

type FeedPost = Post & {
  liked_by_user?: boolean;
  isFake?: boolean;
  segments?: ('all' | 'following' | 'local')[];
};

interface FeedSectionProps {
  currentUser: Profile | null;
}

export default function FeedSection({ currentUser }: FeedSectionProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [filter, setFilter] = useState('all');
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

  useEffect(() => {
    loadPosts();
  }, [filter, currentUser?.id]);

  const applyFilter = (data: FeedPost[]) => {
    if (filter === 'all') {
      return data;
    }

    return data.filter((post) => {
      if (!post.isFake) {
        return true;
      }
      if (!post.segments || post.segments.length === 0) {
        return filter === 'all';
      }
      return post.segments.includes(filter as 'following' | 'local');
    });
  };

  const loadFallbackPosts = () => {
    const filtered = applyFilter(fakeFeedPosts).map((post) => ({ ...post }));
    setPosts(filtered);
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
      let query = supabase
        .from('posts')
        .select('*, user:profiles(*), spot:spots(*)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const filteredData = filterOutProfileMediaPosts(data || []) as FeedPost[];

      if (!filteredData || filteredData.length === 0) {
        loadFallbackPosts();
        return;
      }

      if (currentUser && filteredData.length > 0) {
        const postIds = filteredData.map(p => p.id);
        const { data: likes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds);

        const likedIds = new Set(likes?.map(l => l.post_id) || []);
        const postsWithLikes = filteredData.map(p => ({
          ...p,
          liked_by_user: likedIds.has(p.id),
        }));
        const applied = applyFilter(postsWithLikes as FeedPost[]);
        setPosts(applied);
        await loadFollowingState(applied);
      } else {
        const applied = applyFilter(filteredData);
        setPosts(applied);
        await loadFollowingState(applied);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      loadFallbackPosts();
    } finally {
      setLoading(false);
    }
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

  const filterButtons = [
    { id: 'all', label: 'Tout' },
    { id: 'following', label: 'Abonnements' },
    { id: 'local', label: 'Local' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-6 mt-4 sm:mt-6 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-full border-2 border-orange-500 p-0.5">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt="Your story"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold">
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
              <div className="w-16 h-16 rounded-full border-2 border-orange-500 p-0.5 overflow-hidden">
                {post.media_urls?.[0] ? (
                  isVideoUrl(post.media_urls[0]) ? (
                    <video
                      src={post.media_urls[0]}
                      className="w-full h-full object-cover rounded-full"
                      muted
                      playsInline
                      loop
                    />
                  ) : (
                    <img
                      src={post.media_urls[0]}
                      alt={getUserDisplayName(post.user)}
                      className="w-full h-full rounded-full object-cover"
                    />
                  )
                ) : post.user?.avatar_url ? (
                  <img
                    src={post.user.avatar_url}
                    alt={getUserDisplayName(post.user)}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                    {getUserInitial(post.user)}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 truncate max-w-[64px]">{post.user?.username || 'Story'}</span>
            </button>
          ))}
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-700 p-4 mb-6">
          <form onSubmit={handleCreatePost}>
            <div className="flex gap-3">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={getUserDisplayName(currentUser)}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-orange-500"
                />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {getUserInitial(currentUser)}
                </div>
              )}
              <div className="flex-1">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Partagez votre session, un nouveau trick, ou un spot découvert..."
                  className="w-full border-0 focus:ring-0 resize-none bg-dark-800 text-white placeholder-gray-500"
                  rows={3}
                />

                {mediaPreview.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {mediaPreview.map((preview, index) => (
                      <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-dark-700">
                        {preview.type === 'image' ? (
                          <img
                            src={preview.url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={preview.url}
                            className="w-full h-full object-cover"
                            controls
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(index)}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors shadow-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploading && (
                  <div className="mt-3 flex items-center gap-2 text-orange-500 text-sm">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Téléchargement en cours...</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={(e) => handleMediaSelect(e, 'image')}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => handleMediaSelect(e, 'video')}
                  className="hidden"
                />

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-700">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || mediaPreview.length >= 4}
                      className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Ajouter des photos"
                    >
                      <ImageIcon size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploading || mediaPreview.length >= 1}
                      className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Ajouter une vidéo"
                    >
                      <Video size={20} />
                    </button>
                    <button type="button" className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400" title="Localisation">
                      <MapPin size={20} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={(!newPostContent.trim() && uploadedMedia.length === 0) || uploading}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send size={18} />
                    <span>Publier</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Chargement des posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">Aucun post pour le moment</p>
          <p className="text-sm">Soyez le premier à partager quelque chose!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => handleAvatarClick(post)}
                      className={`group relative flex-shrink-0 focus:outline-none ${post.isFake ? 'rounded-full focus-visible:ring-2 focus-visible:ring-orange-500' : ''}`}
                      title={post.isFake ? 'Voir le profil' : getUserDisplayName(post.user)}
                    >
                    {post.user?.avatar_url ? (
                      <img
                        src={post.user.avatar_url}
                        alt={getUserDisplayName(post.user)}
                        className={`w-10 h-10 rounded-full object-cover border-2 ${post.isFake ? 'border-orange-500 transition-colors group-hover:border-orange-400' : 'border-orange-500'}`}
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white font-semibold ${post.isFake ? 'transition-colors group-hover:bg-orange-400' : ''}`}>
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
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        followingMap[post.user_id]
                          ? 'border border-orange-500/60 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      } ${followLoadingMap[post.user_id] ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                </div>

                {post.content && (
                  <p className="text-gray-300 mb-3 whitespace-pre-wrap">{post.content}</p>
                )}

                {post.media_urls && post.media_urls.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {post.media_urls.map((url, index) => (
                      <div key={index} className="relative rounded-lg overflow-hidden bg-dark-700">
                        {post.post_type === 'video' ? (
                          <video
                            src={url}
                            className="w-full aspect-video object-cover"
                            controls
                            playsInline
                          />
                        ) : (
                          <img
                            src={url}
                            alt={`Media ${index + 1}`}
                            className="w-full aspect-auto object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {post.spot && (
                  <div className="flex items-center gap-2 text-sm text-orange-500 mb-3">
                    <MapPin size={16} />
                    <span>{post.spot.name}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-dark-700 px-4 py-3">
                <div className="flex items-center gap-4 mb-2">
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
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <MessageCircle size={24} />
                  </button>
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <Send size={24} />
                  </button>
                </div>
                <div className="text-sm text-white mb-1">
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
                    className="text-sm text-gray-500 mt-1"
                  >
                    View all {post.comments_count} comments
                  </button>
                )}
              </div>

              {expandedComments.has(post.id) && (
                <div className="border-t border-dark-700 px-4 py-4">
                  <CommentSection
                    postId={post.id}
                    currentUser={currentUser}
                    onCommentCountChange={(count) => handleCommentCountChange(post.id, count)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
    </div>
  );
}
