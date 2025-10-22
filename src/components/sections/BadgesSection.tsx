import { useState, useEffect } from 'react';
import { Award, Lock, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Badge, UserBadge, Profile } from '../../types';

interface BadgesSectionProps {
  profile: Profile | null;
}

export default function BadgesSection({ profile }: BadgesSectionProps) {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    if (profile) {
      loadBadges();
    }
  }, [profile]);

  const loadBadges = async () => {
    if (!profile) return;

    try {
      const [badgesResult, userBadgesResult] = await Promise.all([
        supabase.from('badges').select('*').order('rarity', { ascending: false }),
        supabase
          .from('user_badges')
          .select('*, badge:badges(*)')
          .eq('user_id', profile.id)
      ]);

      if (badgesResult.error) throw badgesResult.error;
      if (userBadgesResult.error) throw userBadgesResult.error;

      setAllBadges(badgesResult.data || []);
      setUserBadges(userBadgesResult.data || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBadgeDisplay = async (userBadgeId: string, currentDisplay: boolean) => {
    try {
      const { error } = await supabase
        .from('user_badges')
        .update({ is_displayed: !currentDisplay })
        .eq('id', userBadgeId);

      if (error) throw error;

      setUserBadges(userBadges.map(ub =>
        ub.id === userBadgeId ? { ...ub, is_displayed: !currentDisplay } : ub
      ));
    } catch (error) {
      console.error('Error toggling badge display:', error);
    }
  };

  const isEarned = (badgeId: string) => {
    return userBadges.some(ub => ub.badge_id === badgeId);
  };

  const getUserBadge = (badgeId: string) => {
    return userBadges.find(ub => ub.badge_id === badgeId);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-orange-500';
      case 'epic': return 'from-purple-500 to-pink-500';
      case 'rare': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-500';
      case 'epic': return 'border-purple-500';
      case 'rare': return 'border-blue-500';
      default: return 'border-gray-600';
    }
  };

  const categories = ['all', 'spots', 'content', 'social', 'progression', 'engagement'];
  const filteredBadges = filter === 'all'
    ? allBadges
    : allBadges.filter(b => b.category === filter);

  const handleLockedBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
  };

  const closeModal = () => {
    setSelectedBadge(null);
  };

  const earnedCount = userBadges.length;
  const totalCount = allBadges.length;
  const completionPercentage = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

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
        <h1 className="text-3xl font-bold text-white mb-2">Badges et Achievements</h1>
        <p className="text-gray-400 mb-6">Collectionnez des badges en accomplissant des exploits</p>

        <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Ce que les badges peuvent débloquer</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            <li>Bonus d’XP permanents pour accélérer ta progression sur le leaderboard.</li>
            <li>Réductions exclusives sur la boutique partenaire et accès anticipé aux drops.</li>
            <li>Slots supplémentaires pour mettre en avant tes spots, clips et événements.</li>
            <li>Accès à des challenges secrets réservés aux riders les plus assidus.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                <Award className="text-white" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{earnedCount}/{totalCount}</div>
                <div className="text-sm text-gray-400">Badges débloqués</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {Math.round(completionPercentage)}%
              </div>
              <div>
                <div className="text-2xl font-bold text-white">Complétion</div>
                <div className="text-sm text-gray-400">Collection totale</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {userBadges.filter(ub => ub.badge?.rarity === 'legendary').length}
              </div>
              <div>
                <div className="text-2xl font-bold text-white">Légendaires</div>
                <div className="text-sm text-gray-400">Badges rares</div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden mb-6">
        <div className="border-b border-dark-700 p-4 overflow-x-auto">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {cat === 'all' ? 'Tous' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Chargement des badges...</div>
          ) : filteredBadges.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Lock size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucun badge dans cette catégorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredBadges.map((badge) => {
                const earned = isEarned(badge.id);
                const userBadge = getUserBadge(badge.id);

                return (
                  <div
                    key={badge.id}
                    className={`relative bg-dark-900 rounded-lg p-4 border-2 transition-all ${
                      earned
                        ? `${getRarityBorder(badge.rarity)} hover:scale-105`
                        : 'border-dark-700 opacity-50'
                    }`}
                  >
                    {!earned && (
                      <button
                        type="button"
                        onClick={() => handleLockedBadgeClick(badge)}
                        className="absolute inset-0 bg-dark-900/80 rounded-lg flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                        aria-label={`Comment débloquer le badge ${badge.name}`}
                      >
                        <Lock className="text-gray-600" size={32} />
                      </button>
                    )}

                    <div className="flex flex-col items-center text-center">
                      <div className={`w-16 h-16 mb-3 rounded-full bg-gradient-to-br ${getRarityColor(badge.rarity)} flex items-center justify-center text-3xl`}>
                        {badge.icon}
                      </div>
                      <h3 className="font-bold text-white text-sm mb-1">{badge.name}</h3>
                      <p className="text-xs text-gray-400 mb-2">{badge.description}</p>

                      {earned && (
                        <div className="mt-2 pt-2 border-t border-dark-700 w-full">
                          <button
                            onClick={() => toggleBadgeDisplay(userBadge!.id, userBadge!.is_displayed)}
                            className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors mx-auto"
                          >
                            {userBadge?.is_displayed ? (
                              <>
                                <Eye size={14} />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={14} />
                                <span>Masqué</span>
                              </>
                            )}
                          </button>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(userBadge!.earned_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      )}
                    </div>

                    {earned && (
                      <div className="absolute top-2 right-2">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getRarityColor(badge.rarity)}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Mur des Légendes</h2>
        <p className="text-gray-400 mb-4">Les membres avec le plus de badges légendaires</p>
        <div className="text-center py-8 text-gray-500">
          <Award size={48} className="mx-auto mb-2 opacity-30" />
          <p>Fonctionnalité à venir</p>
        </div>
      </div>

      {selectedBadge && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-dark-800 border border-dark-600 rounded-xl max-w-md w-full p-6 relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-full"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-center mb-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRarityColor(selectedBadge.rarity)} flex items-center justify-center text-3xl`}>
                {selectedBadge.icon}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">{selectedBadge.name}</h3>
            <p className="text-gray-300 text-sm text-center">
              Pour déverrouiller ce badge : {selectedBadge.description}
            </p>

            <button
              type="button"
              onClick={closeModal}
              className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
