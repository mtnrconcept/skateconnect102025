import { useState, useEffect } from 'react';
import { Trophy, Calendar, Users, Star, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import DailyChallenges from '../DailyChallenges';
import type { Challenge, Profile } from '../../types';

interface ChallengesSectionProps {
  profile: Profile | null;
}

export default function ChallengesSection({ profile }: ChallengesSectionProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'daily' | 'community'>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, [filter]);

  const getFallbackChallenges = () => {
    const now = new Date();
    const addDays = (days: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      return date.toISOString();
    };

    const fallbackChallenges: Challenge[] = [
      {
        id: 'community-fallback-1',
        created_by: null,
        title: 'Session DIY à rénover',
        description:
          'Rassemble ta crew pour retaper un spot DIY et partage le résultat final avec la communauté.',
        challenge_type: 'community',
        difficulty: 3,
        prize: 'Pack stickers Shredloc + mise en avant sur la page d’accueil',
        start_date: now.toISOString(),
        end_date: addDays(10),
        participants_count: 128,
        is_active: true,
        created_at: now.toISOString(),
      },
      {
        id: 'weekly-fallback-1',
        created_by: null,
        title: 'Combo créatif filmé',
        description:
          'Filme un combo original de trois tricks minimum et publie-le sur le feed communautaire.',
        challenge_type: 'weekly',
        difficulty: 4,
        prize: 'Carte cadeau de 25€ chez notre shop partenaire',
        start_date: now.toISOString(),
        end_date: addDays(7),
        participants_count: 94,
        is_active: true,
        created_at: now.toISOString(),
      },
      {
        id: 'brand-fallback-1',
        created_by: null,
        title: 'Best trick brandé',
        description:
          'Porte une pièce de ta marque préférée et filme ton meilleur trick sur un curb ou une box.',
        challenge_type: 'brand',
        difficulty: 2,
        prize: 'Goodies exclusifs + repost sur le compte de la marque',
        start_date: now.toISOString(),
        end_date: addDays(5),
        participants_count: 57,
        is_active: true,
        created_at: now.toISOString(),
      },
      {
        id: 'daily-fallback-1',
        created_by: null,
        title: 'Bon plan spot partagé',
        description:
          'Ajoute un nouveau spot ou mets à jour un spot existant avec une photo récente.',
        challenge_type: 'daily',
        difficulty: 1,
        prize: '50 XP instantanés',
        start_date: now.toISOString(),
        end_date: addDays(1),
        participants_count: 36,
        is_active: true,
        created_at: now.toISOString(),
      },
    ];

    if (filter === 'all') {
      return fallbackChallenges;
    }

    return fallbackChallenges.filter((challenge) => challenge.challenge_type === filter);
  };

  const loadChallenges = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('challenges')
        .select('*, creator:profiles(*)')
        .eq('is_active', true);

      if (filter !== 'all') {
        query = query.eq('challenge_type', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setChallenges(getFallbackChallenges());
      } else {
        setChallenges(data);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges(getFallbackChallenges());
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays;
  };

  const filterButtons = [
    { id: 'daily', label: 'Quotidiens' },
    { id: 'weekly', label: 'Hebdomadaires' },
    { id: 'brand', label: 'Marques' },
    { id: 'community', label: 'Communauté' },
  ];

  const getChallengeColor = (type: string) => {
    switch (type) {
      case 'daily':
        return 'from-orange-500 to-red-500';
      case 'weekly':
        return 'from-blue-500 to-cyan-500';
      case 'brand':
        return 'from-purple-500 to-pink-500';
      case 'community':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-slate-500 to-slate-600';
    }
  };

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
        <h1 className="text-3xl font-bold text-white mb-2">Défis & Challenges</h1>
        <p className="text-gray-400 mb-6">Complète des défis pour gagner des XP et des récompenses</p>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'daily'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            <Target size={20} />
            <span>Défis Quotidiens</span>
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'community'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
            }`}
          >
            <Trophy size={20} />
            <span>Challenges Communautaires</span>
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? (
        <DailyChallenges profile={profile} />
      ) : (
        <div>
          <div className="mb-6 bg-dark-800 rounded-xl border border-dark-700 p-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
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

          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement des défis...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12 bg-dark-800 rounded-xl border border-dark-700">
              <Trophy size={48} className="mx-auto mb-2 opacity-30 text-gray-600" />
              <p className="text-lg mb-2 text-white">Aucun défi actif</p>
              <p className="text-sm text-gray-400">Revenez plus tard pour de nouveaux challenges!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {challenges.map((challenge) => {
                const daysRemaining = getDaysRemaining(challenge.end_date);
                const isExpiringSoon = daysRemaining <= 2;

                return (
                  <div
                    key={challenge.id}
                    className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden hover:border-dark-600 transition-all cursor-pointer"
                  >
                    <div className={`h-32 bg-gradient-to-br ${getChallengeColor(challenge.challenge_type)} p-4 flex flex-col justify-between`}>
                      <div className="flex items-center justify-between">
                        <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                          {challenge.challenge_type}
                        </span>
                        <Trophy className="text-white/80" size={24} />
                      </div>
                      <h3 className="text-white font-bold text-lg">{challenge.title}</h3>
                    </div>

                    <div className="p-4">
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {challenge.description}
                      </p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar size={16} />
                          <span>
                            {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Users size={16} />
                          <span>{challenge.participants_count} participants</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Star size={16} />
                          <span>Difficulté: {'⭐'.repeat(challenge.difficulty)}</span>
                        </div>
                      </div>

                      {challenge.prize && (
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 mb-4">
                          <div className="text-xs font-medium text-orange-500 mb-1">Prix</div>
                          <div className="text-sm text-orange-400">{challenge.prize}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        {daysRemaining > 0 ? (
                          <span className={`text-sm font-medium ${isExpiringSoon ? 'text-red-500' : 'text-gray-400'}`}>
                            {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-red-500">Expiré</span>
                        )}
                        <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                          Participer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
