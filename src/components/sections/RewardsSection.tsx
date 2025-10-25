import { useState, useEffect } from 'react';
import { ShoppingBag, Package, Gift, Ticket, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import type { Reward, UserReward, Profile, UserXP } from '../../types';

interface RewardsSectionProps {
  profile: Profile | null;
}

export default function RewardsSection({ profile }: RewardsSectionProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [userXP, setUserXP] = useState<UserXP | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (profile) {
      loadRewards();
      loadUserXP();
    }
  }, [profile]);

  const loadRewards = async () => {
    if (!profile) return;

    try {
      const [rewardsResult, userRewardsResult] = await Promise.all([
        supabase.from('rewards').select('*').eq('is_active', true).order('cost_xp', { ascending: true }),
        supabase.from('user_rewards').select('*, reward:rewards(*)').eq('user_id', profile.id)
      ]);

      if (rewardsResult.error) throw rewardsResult.error;
      if (userRewardsResult.error) throw userRewardsResult.error;

      setRewards(rewardsResult.data || []);
      setUserRewards(userRewardsResult.data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserXP = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('user_xp')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setUserXP(data);
    } catch (error) {
      console.error('Error loading user XP:', error);
    }
  };

  const canAfford = (cost: number) => {
    return userXP ? userXP.total_xp >= cost : false;
  };

  const handleClaimReward = async (reward: Reward) => {
    if (!profile || !userXP || !canAfford(reward.cost_xp)) return;

    setClaiming(true);
    try {
      const redemptionCode = `SHRED-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const { error } = await supabase.from('user_rewards').insert({
        user_id: profile.id,
        reward_id: reward.id,
        redemption_code: reward.type === 'digital' || reward.type === 'discount' ? redemptionCode : null,
      });

      if (error) throw error;

      alert(`Récompense réclamée avec succès! ${redemptionCode ? `Code: ${redemptionCode}` : 'Vous recevrez votre récompense sous peu.'}`);
      setSelectedReward(null);
      loadRewards();
      loadUserXP();
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Erreur lors de la réclamation de la récompense');
    } finally {
      setClaiming(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'physical': return <Package className="text-blue-500" size={20} />;
      case 'digital': return <Gift className="text-purple-500" size={20} />;
      case 'discount': return <Ticket className="text-orange-500" size={20} />;
      default: return <ShoppingBag size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'physical': return 'Physique';
      case 'digital': return 'Numérique';
      case 'discount': return 'Réduction';
      default: return type;
    }
  };

  const filterButtons = [
    { id: 'all', label: 'Toutes' },
    { id: 'physical', label: 'Physiques' },
    { id: 'digital', label: 'Numériques' },
    { id: 'discount', label: 'Réductions' },
  ];

  const filteredRewards = filter === 'all'
    ? rewards
    : rewards.filter(r => r.type === filter);

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Skate Store</h1>
            <p className="text-gray-400">Échangez vos XP contre des récompenses exclusives</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-orange-500">{userXP?.total_xp || 0}</div>
            <div className="text-sm text-gray-400">XP disponibles</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-orange-500" size={32} />
              <div>
                <div className="text-2xl font-bold text-white">{rewards.length}</div>
                <div className="text-sm text-gray-400">Récompenses disponibles</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <Package className="text-blue-500" size={32} />
              <div>
                <div className="text-2xl font-bold text-white">{userRewards.length}</div>
                <div className="text-sm text-gray-400">Récompenses réclamées</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <Gift className="text-purple-500" size={32} />
              <div>
                <div className="text-2xl font-bold text-white">
                  {userRewards.filter(ur => ur.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-400">En attente</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden mb-6">
        <div className="border-b border-dark-700 p-4 overflow-x-auto">
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === btn.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Chargement des récompenses...</div>
          ) : filteredRewards.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucune récompense disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRewards.map((reward) => {
                const affordable = canAfford(reward.cost_xp);
                const outOfStock = reward.stock === 0;

                return (
                  <div
                    key={reward.id}
                    className={`bg-dark-900 rounded-lg border-2 overflow-hidden transition-all ${
                      affordable && !outOfStock
                        ? 'border-orange-500/50 hover:border-orange-500 hover:scale-105'
                        : 'border-dark-700'
                    } ${outOfStock ? 'opacity-50' : ''}`}
                  >
                    <div className="aspect-video bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center relative">
                      {reward.image_url ? (
                        <img
                          src={reward.image_url}
                          alt={reward.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <ShoppingBag size={64} className="text-gray-600" />
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-dark-900/80 flex items-center justify-center">
                          <span className="text-red-500 font-bold text-lg">RUPTURE</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-white">{reward.name}</h3>
                        {getTypeIcon(reward.type)}
                      </div>

                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{reward.description}</p>

                      {reward.partner && (
                        <div className="text-xs text-gray-500 mb-2">
                          Par {reward.partner}
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-orange-500">{reward.cost_xp}</span>
                          <span className="text-sm text-gray-400">XP</span>
                        </div>
                        {reward.stock > 0 && reward.stock < 20 && (
                          <span className="text-xs text-yellow-500">
                            {reward.stock} restants
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => !outOfStock && setSelectedReward(reward)}
                        disabled={!affordable || outOfStock}
                        className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                          affordable && !outOfStock
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {outOfStock ? 'Rupture de stock' : affordable ? 'Réclamer' : 'XP insuffisants'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {userRewards.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Mes Récompenses</h2>
          <div className="space-y-3">
            {userRewards.map((userReward) => (
              <div
                key={userReward.id}
                className="bg-dark-900 rounded-lg p-4 border border-dark-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {getTypeIcon(userReward.reward?.type || 'physical')}
                  <div>
                    <h3 className="font-semibold text-white">{userReward.reward?.name}</h3>
                    <p className="text-sm text-gray-400">
                      Réclamé le {new Date(userReward.claimed_at).toLocaleDateString('fr-FR')}
                    </p>
                    {userReward.redemption_code && (
                      <p className="text-sm text-orange-500 font-mono mt-1">
                        Code: {userReward.redemption_code}
                      </p>
                    )}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  userReward.status === 'delivered'
                    ? 'bg-green-500/20 text-green-500'
                    : userReward.status === 'shipped'
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {userReward.status === 'delivered' ? 'Livré' :
                   userReward.status === 'shipped' ? 'Expédié' : 'En attente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedReward && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl border border-dark-700 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Confirmer la réclamation</h3>
              <button
                onClick={() => setSelectedReward(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <div className="aspect-video bg-gradient-to-br from-dark-700 to-dark-800 rounded-lg mb-4 flex items-center justify-center">
                {selectedReward.image_url ? (
                  <img
                    src={selectedReward.image_url}
                    alt={selectedReward.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <ShoppingBag size={64} className="text-gray-600" />
                )}
              </div>

              <h4 className="font-bold text-white text-lg mb-2">{selectedReward.name}</h4>
              <p className="text-sm text-gray-400 mb-3">{selectedReward.description}</p>

              <div className="bg-dark-900 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Coût</span>
                  <span className="text-orange-500 font-bold">{selectedReward.cost_xp} XP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Solde restant</span>
                  <span className="text-white font-semibold">
                    {(userXP?.total_xp || 0) - selectedReward.cost_xp} XP
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedReward(null)}
                className="flex-1 py-2 px-4 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleClaimReward(selectedReward)}
                disabled={claiming}
                className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Réclamation...</span>
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    <span>Confirmer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
