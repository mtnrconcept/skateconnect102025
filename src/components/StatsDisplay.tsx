import { useState, useEffect } from 'react';
import { TrendingUp, Award, MapPin, Video, MessageCircle, Heart, Users, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface StatsDisplayProps {
  profile: Profile;
}

interface UserStats {
  totalXP: number;
  level: number;
  rank: number;
  totalPosts: number;
  totalSpots: number;
  totalComments: number;
  totalLikes: number;
  totalFollowers: number;
  totalBadges: number;
  videosPosted: number;
  photosPosted: number;
  spotsVisited: number;
}

export default function StatsDisplay({ profile }: StatsDisplayProps) {
  const [stats, setStats] = useState<UserStats>({
    totalXP: 0,
    level: 1,
    rank: 0,
    totalPosts: 0,
    totalSpots: 0,
    totalComments: 0,
    totalLikes: 0,
    totalFollowers: 0,
    totalBadges: 0,
    videosPosted: 0,
    photosPosted: 0,
    spotsVisited: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [profile]);

  const loadStats = async () => {
    try {
      const [
        xpData,
        postsData,
        spotsData,
        commentsData,
        likesData,
        followersData,
        badgesData,
        rankData,
      ] = await Promise.all([
        supabase.from('user_xp').select('*').eq('user_id', profile.id).maybeSingle(),
        supabase.from('posts').select('post_type', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('spots').select('*', { count: 'exact' }).eq('created_by', profile.id),
        supabase.from('comments').select('*', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('likes').select('*', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('follows').select('*', { count: 'exact' }).eq('following_id', profile.id),
        supabase.from('user_badges').select('*', { count: 'exact' }).eq('user_id', profile.id),
        supabase
          .from('user_xp')
          .select('user_id')
          .order('total_xp', { ascending: false }),
      ]);

      const videos = postsData.data?.filter(p => p.post_type === 'video').length || 0;
      const photos = postsData.data?.filter(p => p.post_type === 'photo').length || 0;

      const userRank = rankData.data?.findIndex(u => u.user_id === profile.id) ?? -1;

      const baseFollowers = profile.legacy_followers_count ?? 0;

      setStats({
        totalXP: xpData.data?.total_xp || 0,
        level: xpData.data?.current_level || 1,
        rank: userRank >= 0 ? userRank + 1 : 0,
        totalPosts: postsData.count || 0,
        totalSpots: spotsData.count || 0,
        totalComments: commentsData.count || 0,
        totalLikes: likesData.count || 0,
        totalFollowers: (followersData.count || 0) + baseFollowers,
        totalBadges: badgesData.count || 0,
        videosPosted: videos,
        photosPosted: photos,
        spotsVisited: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Chargement des statistiques...
      </div>
    );
  }

  const statCards = [
    {
      icon: <TrendingUp className="text-orange-500" size={24} />,
      label: 'Total XP',
      value: stats.totalXP.toLocaleString(),
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: <Trophy className="text-yellow-500" size={24} />,
      label: 'Classement',
      value: `#${stats.rank}`,
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      icon: <Award className="text-purple-500" size={24} />,
      label: 'Badges',
      value: stats.totalBadges,
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: <MapPin className="text-blue-500" size={24} />,
      label: 'Spots',
      value: stats.totalSpots,
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: <Video className="text-pink-500" size={24} />,
      label: 'Vidéos',
      value: stats.videosPosted,
      color: 'from-pink-500 to-pink-600',
    },
    {
      icon: <MessageCircle className="text-cyan-500" size={24} />,
      label: 'Commentaires',
      value: stats.totalComments,
      color: 'from-cyan-500 to-cyan-600',
    },
    {
      icon: <Heart className="text-red-500" size={24} />,
      label: 'Likes donnés',
      value: stats.totalLikes,
      color: 'from-red-500 to-red-600',
    },
    {
      icon: <Users className="text-green-500" size={24} />,
      label: 'Abonnés',
      value: stats.totalFollowers,
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <TrendingUp className="text-orange-500" size={24} />
        Statistiques
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-dark-900 rounded-lg p-4 border border-dark-700 hover:border-dark-600 transition-colors"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-xs text-gray-400">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-dark-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Progression</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Niveau actuel</span>
              <span className="text-white font-semibold">Niveau {stats.level}</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                style={{ width: `${((stats.level % 10) / 10) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Engagement</span>
              <span className="text-white font-semibold">
                {Math.min(100, Math.round((stats.totalComments + stats.totalLikes) / 10))}%
              </span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                style={{
                  width: `${Math.min(100, Math.round((stats.totalComments + stats.totalLikes) / 10))}%`
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Contribution</span>
              <span className="text-white font-semibold">
                {Math.min(100, Math.round((stats.totalSpots + stats.videosPosted) * 10))}%
              </span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                style={{
                  width: `${Math.min(100, Math.round((stats.totalSpots + stats.videosPosted) * 10))}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
