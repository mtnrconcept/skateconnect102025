import { useState, useEffect } from 'react';
import { Heart, MessageCircle, MapPin, Send, Camera, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
    if (!newPostContent.trim() || !currentUser) return;

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUser.id,
        content: newPostContent,
        post_type: 'text',
      });

      if (error) throw error;

      setNewPostContent('');
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
    }
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
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Flux d'actualités</h2>

        <div className="flex gap-2 mb-6">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === btn.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <form onSubmit={handleCreatePost}>
            <div className="flex gap-3">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.display_name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {currentUser?.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Partagez votre session, un nouveau trick, ou un spot découvert..."
                  className="w-full border-0 focus:ring-0 resize-none text-slate-700"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <div className="flex gap-2">
                    <button type="button" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                      <Camera size={20} />
                    </button>
                    <button type="button" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                      <Video size={20} />
                    </button>
                    <button type="button" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                      <MapPin size={20} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!newPostContent.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="text-center py-8 text-slate-500">Chargement des posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg mb-2">Aucun post pour le moment</p>
          <p className="text-sm">Soyez le premier à partager quelque chose!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  {post.user?.avatar_url ? (
                    <img
                      src={post.user.avatar_url}
                      alt={post.user.display_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                      {post.user?.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{post.user?.display_name}</span>
                      <span className="text-slate-500">@{post.user?.username}</span>
                    </div>
                    <div className="text-xs text-slate-500">{formatDate(post.created_at)}</div>
                  </div>
                </div>

                <p className="text-slate-700 mb-3 whitespace-pre-wrap">{post.content}</p>

                {post.spot && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                    <MapPin size={16} />
                    <span>{post.spot.name}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 transition-colors ${
                    post.liked_by_user
                      ? 'text-red-500'
                      : 'text-slate-600 hover:text-red-500'
                  }`}
                >
                  <Heart size={20} className={post.liked_by_user ? 'fill-current' : ''} />
                  <span className="text-sm font-medium">{post.likes_count || 0}</span>
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
                  className="flex items-center gap-2 text-slate-600 hover:text-blue-500 transition-colors"
                >
                  <MessageCircle size={20} />
                  <span className="text-sm font-medium">{post.comments_count || 0}</span>
                </button>
              </div>

              {expandedComments.has(post.id) && (
                <div className="border-t border-slate-100 px-4 py-4">
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
