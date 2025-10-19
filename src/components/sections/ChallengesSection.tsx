import { useState, useEffect } from 'react';
import { Trophy, Calendar, Users, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Challenge } from '../../types';

export default function ChallengesSection() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filter, setFilter] = useState('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, [filter]);

  const loadChallenges = async () => {
    try {
      let query = supabase
        .from('challenges')
        .select('*, creator:profiles(*)')
        .eq('is_active', true);

      if (filter !== 'all') {
        query = query.eq('challenge_type', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setChallenges(data || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Défis et Challenges</h2>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === btn.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Chargement des défis...</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Trophy size={48} className="mx-auto mb-2 opacity-30" />
          <p className="text-lg mb-2">Aucun défi actif</p>
          <p className="text-sm">Revenez plus tard pour de nouveaux challenges!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges.map((challenge) => {
            const daysRemaining = getDaysRemaining(challenge.end_date);
            const isExpiringSoon = daysRemaining <= 2;

            return (
              <div
                key={challenge.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
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
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                    {challenge.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={16} />
                      <span>
                        {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users size={16} />
                      <span>{challenge.participants_count} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Star size={16} />
                      <span>Difficulté: {'⭐'.repeat(challenge.difficulty)}</span>
                    </div>
                  </div>

                  {challenge.prize && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4">
                      <div className="text-xs font-medium text-yellow-800 mb-1">Prix</div>
                      <div className="text-sm text-yellow-900">{challenge.prize}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {daysRemaining > 0 ? (
                      <span className={`text-sm font-medium ${isExpiringSoon ? 'text-red-600' : 'text-slate-600'}`}>
                        {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-red-600">Expiré</span>
                    )}
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
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
  );
}
