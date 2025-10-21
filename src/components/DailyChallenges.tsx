import { useState, useEffect } from 'react';
import { Target, CheckCircle, Clock, Zap, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_count: number;
  xp_reward: number;
  start_date: string;
  end_date: string;
}

interface ChallengeProgress {
  challenge_id: string;
  current_count: number;
  is_completed: boolean;
  completed_at: string | null;
}

interface ChallengeWithProgress extends Challenge {
  progress?: ChallengeProgress;
}

interface DailyChallengesProps {
  profile: Profile;
}

export default function DailyChallenges({ profile }: DailyChallengesProps) {
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();

    const channel = supabase
      .channel('challenge-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_challenge_progress',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const getFallbackDailyChallenges = () => {
    const now = new Date();
    const addDays = (days: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      return date.toISOString();
    };

    return [
      {
        id: 'daily-fallback-community-session',
        title: 'Session matinale au park',
        description: 'Pose trois manuals consécutifs avant 10h et partage ta meilleure tentative.',
        challenge_type: 'daily',
        target_count: 3,
        xp_reward: 75,
        start_date: now.toISOString(),
        end_date: addDays(1),
      },
      {
        id: 'daily-fallback-new-spot',
        title: 'Nouveau spot référencé',
        description: 'Ajoute un spot street ou mets à jour les infos d’un spot existant.',
        challenge_type: 'daily',
        target_count: 1,
        xp_reward: 60,
        start_date: now.toISOString(),
        end_date: addDays(1),
      },
      {
        id: 'weekly-fallback-tour',
        title: 'Tour des quartiers',
        description: 'Valide cinq spots différents dans la semaine et laisse un avis sur chacun.',
        challenge_type: 'weekly',
        target_count: 5,
        xp_reward: 200,
        start_date: now.toISOString(),
        end_date: addDays(7),
      },
      {
        id: 'weekly-fallback-clip',
        title: 'Clip collectif',
        description: 'Publie une vidéo de groupe avec au moins trois riders différents.',
        challenge_type: 'weekly',
        target_count: 1,
        xp_reward: 250,
        start_date: now.toISOString(),
        end_date: addDays(7),
      },
    ];
  };

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const { data: challengesData, error: challengesError } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('xp_reward', { ascending: false });

      if (challengesError) throw challengesError;

      const { data: progressData, error: progressError } = await supabase
        .from('user_challenge_progress')
        .select('*')
        .eq('user_id', profile.id);

      if (progressError) throw progressError;

      const progressMap = new Map(
        progressData?.map((p) => [p.challenge_id, p]) || []
      );

      const challengesWithProgress = challengesData?.map((challenge) => ({
        ...challenge,
        progress: progressMap.get(challenge.id),
      })) || [];

      if (challengesWithProgress.length === 0) {
        setChallenges(getFallbackDailyChallenges());
      } else {
        setChallenges(challengesWithProgress);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges(getFallbackDailyChallenges());
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (challenge: ChallengeWithProgress) => {
    if (!challenge.progress) return 0;
    return Math.min(
      100,
      (challenge.progress.current_count / challenge.target_count) * 100
    );
  };

  const isDaily = (challenge: Challenge) => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  };

  const dailyChallenges = challenges.filter(isDaily);
  const weeklyChallenges = challenges.filter(c => !isDaily(c));

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Chargement des défis...
      </div>
    );
  }

  const ChallengeCard = ({ challenge }: { challenge: ChallengeWithProgress }) => {
    const progress = getProgressPercentage(challenge);
    const isCompleted = challenge.progress?.is_completed || false;

    return (
      <div
        className={`bg-dark-900 rounded-lg p-4 border-2 transition-all ${
          isCompleted
            ? 'border-green-500 bg-green-500/5'
            : 'border-dark-700 hover:border-dark-600'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isCompleted ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <Target className="text-orange-500" size={20} />
              )}
              <h3 className="font-bold text-white">{challenge.title}</h3>
            </div>
            <p className="text-sm text-gray-400">{challenge.description}</p>
          </div>

          <div className="flex flex-col items-end ml-4">
            <div className="flex items-center gap-1 text-orange-500 font-bold">
              <Zap size={16} />
              <span>+{challenge.xp_reward}</span>
            </div>
            <span className="text-xs text-gray-500">XP</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Progression</span>
            <span className="text-white font-semibold">
              {challenge.progress?.current_count || 0} / {challenge.target_count}
            </span>
          </div>

          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isCompleted
                  ? 'bg-gradient-to-r from-green-500 to-green-400'
                  : 'bg-gradient-to-r from-orange-500 to-orange-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {isCompleted && challenge.progress?.completed_at && (
            <div className="flex items-center gap-1 text-xs text-green-500 mt-2">
              <CheckCircle size={14} />
              <span>
                Complété{' '}
                {new Date(challenge.progress.completed_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {dailyChallenges.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="text-orange-500" size={24} />
              <h2 className="text-xl font-bold text-white">Défis Quotidiens</h2>
            </div>
            <div className="text-sm text-gray-400">
              Se termine dans{' '}
              {24 - new Date().getHours()}h{' '}
              {60 - new Date().getMinutes()}min
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </div>
      )}

      {weeklyChallenges.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="text-purple-500" size={24} />
              <h2 className="text-xl font-bold text-white">Défis Hebdomadaires</h2>
            </div>
            <div className="text-sm text-gray-400">
              Se termine dans {7 - new Date().getDay()} jours
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weeklyChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </div>
      )}

      {challenges.length === 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
          <Target size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-bold text-white mb-2">
            Aucun défi actif
          </h3>
          <p className="text-gray-400">
            De nouveaux défis seront disponibles bientôt!
          </p>
        </div>
      )}

      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-orange-500" />
          Comment ça marche?
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>
            ✨ Complète des défis quotidiens et hebdomadaires pour gagner des XP bonus
          </p>
          <p>
            🎯 Chaque défi a un objectif spécifique à atteindre
          </p>
          <p>
            🏆 Les défis se réinitialisent automatiquement
          </p>
          <p>
            💎 Certains défis peuvent débloquer des badges exclusifs
          </p>
        </div>
      </div>
    </div>
  );
}
