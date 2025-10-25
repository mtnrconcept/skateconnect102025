import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Award, Crown, Medal } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { fakeLeaderboardEntries } from '../../data/fakeFeed';
import { getUserInitial, getUserDisplayName } from '../../lib/userUtils';
import type { Profile, UserXP } from '../../types';

interface LeaderboardEntry extends UserXP {
  profile?: Profile;
  rank: number;
}

interface LeaderboardSectionProps {
  profile: Profile | null;
}

export default function LeaderboardSection({ profile }: LeaderboardSectionProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'global' | 'week' | 'month'>('global');

  const buildRankedLeaderboard = (entries: (UserXP & { profile?: Profile })[]): LeaderboardEntry[] => {
    const realEntries = entries.map((entry) => ({ ...entry }));
    const fakeEntries = fakeLeaderboardEntries.map((entry) => ({ ...entry }));

    return [...realEntries, ...fakeEntries]
      .sort((a, b) => b.total_xp - a.total_xp)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  };

  useEffect(() => {
    if (profile) {
      loadLeaderboard();
    }
  }, [profile, filter]);

  const loadLeaderboard = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('user_xp')
        .select('*, profile:profiles(*)')
        .order('total_xp', { ascending: false })
        .limit(100);

      if (error) throw error;

      const supabaseEntries: (UserXP & { profile?: Profile })[] = (data || []).map((entry) => ({ ...entry }));
      const rankedData = buildRankedLeaderboard(supabaseEntries);

      setLeaderboard(rankedData);

      const currentUserRank = rankedData.find(entry => entry.user_id === profile.id) || null;
      setUserRank(currentUserRank);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      const fallbackData = buildRankedLeaderboard([]);
      setLeaderboard(fallbackData);
      const fallbackRank = fallbackData.find(entry => entry.user_id === profile.id) || null;
      setUserRank(fallbackRank);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="text-yellow-500" size={24} />;
      case 2:
        return <Medal className="text-gray-400" size={24} />;
      case 3:
        return <Medal className="text-orange-600" size={24} />;
      default:
        return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-500 to-orange-500';
      case 2:
        return 'from-gray-400 to-gray-500';
      case 3:
        return 'from-orange-600 to-orange-700';
      default:
        return 'from-gray-600 to-gray-700';
    }
  };

  const getLevelColor = (level: number) => {
    if (level >= 30) return 'from-purple-500 to-pink-500';
    if (level >= 20) return 'from-yellow-500 to-orange-500';
    if (level >= 10) return 'from-blue-500 to-cyan-500';
    if (level >= 5) return 'from-green-500 to-emerald-500';
    return 'from-gray-500 to-gray-600';
  };

  const filterButtons = [
    { id: 'global' as const, label: 'Global', icon: Trophy },
    { id: 'week' as const, label: 'Semaine', icon: TrendingUp },
    { id: 'month' as const, label: 'Mois', icon: Award },
  ];

  if (!profile) {
    return (
      <div className="text-center py-12 text-gray-400">
        Chargement...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Classement des Riders</h1>
        <p className="text-gray-400 mb-6">Compétez avec les meilleurs skaters de la communauté</p>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {filterButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === btn.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                <Icon size={18} />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {userRank && (
          <div className="bg-dark-900 rounded-lg p-4 border-2 border-orange-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(userRank.rank)} flex items-center justify-center text-white font-bold text-xl`}>
                  #{userRank.rank}
                </div>
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={getUserDisplayName(profile)}
                      className="w-12 h-12 rounded-full object-cover border-2 border-orange-500"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white font-semibold">
                      {getUserInitial(profile)}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white">Votre position</div>
                    <div className="text-sm text-gray-400">{userRank.level_title}</div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-500">{userRank.total_xp}</div>
                <div className="text-sm text-gray-400">XP</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Chargement du classement...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucun classement disponible</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 3).map((entry) => (
                <div
                  key={entry.user_id}
                  className={`bg-gradient-to-r ${getRankColor(entry.rank)} rounded-lg p-1`}
                >
                  <div className="bg-dark-900 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="flex items-center gap-3">
                          {entry.profile?.avatar_url ? (
                            <img
                              src={entry.profile.avatar_url}
                              alt={getUserDisplayName(entry.profile)}
                              className="w-12 h-12 rounded-full object-cover border-2 border-orange-500"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 border-orange-500 bg-orange-500 flex items-center justify-center text-white font-semibold">
                              {getUserInitial(entry.profile)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">
                              {getUserDisplayName(entry.profile)}
                            </div>
                            <div className="text-sm text-gray-400">{entry.level_title}</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getLevelColor(entry.current_level)} flex items-center justify-center text-white font-bold`}>
                          {entry.current_level}
                        </div>
                        <div className="text-lg font-bold text-white mt-1">
                          {entry.total_xp.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">XP</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="space-y-2 mt-4">
                {leaderboard.slice(3).map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`bg-dark-900 rounded-lg p-4 border transition-colors ${
                      entry.user_id === profile?.id
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-center">
                          <span className="text-gray-400 font-semibold">#{entry.rank}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {entry.profile?.avatar_url ? (
                            <img
                              src={entry.profile.avatar_url}
                              alt={getUserDisplayName(entry.profile)}
                              className={`w-10 h-10 rounded-full object-cover border-2 ${
                                entry.user_id === profile?.id ? 'border-orange-500' : 'border-dark-700'
                              }`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full border-2 ${
                              entry.user_id === profile?.id ? 'border-orange-500 bg-orange-500' : 'border-dark-700 bg-dark-700'
                            } flex items-center justify-center text-white font-semibold text-sm`}>
                              {getUserInitial(entry.profile)}
                            </div>
                          )}
                          <div>
                            <div className={`font-semibold ${
                              entry.user_id === profile?.id ? 'text-orange-500' : 'text-white'
                            }`}>
                              {getUserDisplayName(entry.profile)}
                              {entry.user_id === profile?.id && (
                                <span className="ml-2 text-xs text-gray-400">(Vous)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{entry.level_title}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getLevelColor(entry.current_level)} flex items-center justify-center text-white font-bold text-sm`}>
                          {entry.current_level}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">
                            {entry.total_xp.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">XP</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mt-6">
        <h2 className="text-xl font-bold text-white mb-4">Comment grimper au classement?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="text-orange-500 font-bold mb-2">+20 XP</div>
            <div className="text-white font-semibold">Partagez une vidéo</div>
            <div className="text-sm text-gray-400">Publiez vos meilleures tricks</div>
          </div>
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="text-orange-500 font-bold mb-2">+10 XP</div>
            <div className="text-white font-semibold">Ajoutez un spot</div>
            <div className="text-sm text-gray-400">Partagez de nouveaux spots</div>
          </div>
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="text-orange-500 font-bold mb-2">+5 XP</div>
            <div className="text-white font-semibold">Commentez</div>
            <div className="text-sm text-gray-400">Participez aux discussions</div>
          </div>
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="text-orange-500 font-bold mb-2">+2 XP</div>
            <div className="text-white font-semibold">Likez du contenu</div>
            <div className="text-sm text-gray-400">Soutenez la communauté</div>
          </div>
        </div>
      </div>
    </div>
  );
}
