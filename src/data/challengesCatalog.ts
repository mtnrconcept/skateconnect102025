import type { Challenge } from '../types';

export const createFallbackChallenges = (): Challenge[] => {
  const now = new Date();
  const addDays = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };

  return [
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
};

export type DailyChallenge = {
  id: string;
  title: string;
  description: string;
  challenge_type: 'daily' | 'weekly';
  target_count: number;
  xp_reward: number;
  start_date: string;
  end_date: string;
};

export const createFallbackDailyChallenges = (): DailyChallenge[] => {
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

export const getFallbackChallenges = (
  filter: Challenge['challenge_type'] | 'all' = 'all',
): Challenge[] => {
  const challenges = createFallbackChallenges();
  if (filter === 'all') {
    return challenges;
  }
  return challenges.filter((challenge) => challenge.challenge_type === filter);
};
