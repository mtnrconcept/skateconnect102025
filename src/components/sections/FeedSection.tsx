import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, MapPin, Send, Camera, Video, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import { uploadFile } from '../../lib/storage';
import { compressImage, validateMediaFile } from '../../lib/imageCompression';
import CommentSection from '../CommentSection';
import type { Post, Profile } from '../../types';

interface FeedSectionProps {
  currentUser: Profile | null;
}

export default function FeedSection({ currentUser }: FeedSectionProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([]);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPosts();
  }, [filter]);

  const loadPosts = async () => {
    try {
      let query = supabase
        .from('posts')
        .select('*, user:profiles(*), spot:spots(*)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      if (currentUser && data) {
        const postIds = data.map(p => p.id);
        const { data: likes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds);

        const likedIds = new Set(likes?.map(l => l.post_id) || []);
        const postsWithLikes = data.map(p => ({
          ...p,
          liked_by_user: likedIds.has(p.id),
        }));
        setPosts(postsWithLikes);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

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
      if (post.liked_by_user) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);

        setPosts(posts.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: false, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ));
      } else {
        await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            post_id: postId,
          });

        setPosts(posts.map(p =>
          p.id === postId
            ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 }
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

  const filterButtons = [
    { id: 'all', label: 'Tout' },
    { id: 'following', label: 'Abonnements' },
    { id: 'local', label: 'Local' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2">
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
          {posts.slice(0, 8).map((post, idx) => (
            <div key={idx} className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full border-2 border-orange-500 p-0.5">
                {post.user?.avatar_url ? (
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
              <span className="text-xs text-gray-400 truncate max-w-[64px]">{post.user?.username}</span>
            </div>
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
                  {post.user?.avatar_url ? (
                    <img
                      src={post.user.avatar_url}
                      alt={getUserDisplayName(post.user)}
                      className="w-10 h-10 rounded-full object-cover border-2 border-orange-500"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white font-semibold">
                      {getUserInitial(post.user)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{getUserDisplayName(post.user)}</span>
                      <MapPin size={14} className="text-orange-500" />
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(post.created_at)}</div>
                  </div>
                  <button className="bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition-colors text-sm font-semibold">
                    Follow
                  </button>
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
                    onCommentCountChange={(count) => {
                      setPosts(posts.map(p =>
                        p.id === post.id ? { ...p, comments_count: count } : p
                      ));
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
