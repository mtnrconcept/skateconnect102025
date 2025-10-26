import type { Challenge } from '../types';

const addDaysIso = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
};

const createCommunityFallbackChallenges = (now: Date): Challenge[] => [
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
    end_date: addDaysIso(now, 10),
    participants_count: 128,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-2',
    created_by: null,
    title: 'Game of S.K.A.T.E. local',
    description:
      'Organise un mini Game of S.K.A.T.E. dans ton park et poste le récap vidéo des meilleurs moments.',
    challenge_type: 'community',
    difficulty: 2,
    prize: 'Badge « Host » + 150 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 8),
    participants_count: 142,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-3',
    created_by: null,
    title: 'Cleanup collectif',
    description:
      'Planifie un clean-up sur un spot et partage un avant/après pour inspirer la communauté.',
    challenge_type: 'community',
    difficulty: 2,
    prize: '100 XP + highlight dans la newsletter',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 14),
    participants_count: 88,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-4',
    created_by: null,
    title: 'Recrée un trick mythique',
    description:
      'Reproduis un trick iconique d’une part vidéo culte et poste la comparaison side-by-side.',
    challenge_type: 'community',
    difficulty: 4,
    prize: 'Goodies édition limitée',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 12),
    participants_count: 75,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-5',
    created_by: null,
    title: 'Mission mentor',
    description:
      'Coach un·e rider débutant·e sur un trick basique et documente sa progression en vidéo.',
    challenge_type: 'community',
    difficulty: 1,
    prize: 'Badge « Mentor » + 120 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 9),
    participants_count: 63,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-6',
    created_by: null,
    title: 'Tour de spots nocturne',
    description:
      'Organise une session nocturne multi-spots et partage un montage highlight sous les lumières.',
    challenge_type: 'community',
    difficulty: 3,
    prize: 'Badge « Night Rider » + 180 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 11),
    participants_count: 97,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-7',
    created_by: null,
    title: 'Spot guide collaboratif',
    description:
      'Crée un mini-guide vidéo de trois spots locaux avec astuces d’accès et niveaux recommandés.',
    challenge_type: 'community',
    difficulty: 2,
    prize: 'Badge « Scout » + 130 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 15),
    participants_count: 110,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-8',
    created_by: null,
    title: 'Photo story crew',
    description:
      'Capture une série de cinq photos racontant une journée de ride avec ta crew et publie-les en carrousel.',
    challenge_type: 'community',
    difficulty: 1,
    prize: 'Badge « Storyteller » + 90 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 7),
    participants_count: 156,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-9',
    created_by: null,
    title: 'Trick collectif synchronisé',
    description:
      'Réalise un trick synchronisé à deux ou trois riders et poste le clip au ralenti.',
    challenge_type: 'community',
    difficulty: 3,
    prize: 'Badge « Squad Goals » + 160 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 13),
    participants_count: 84,
    is_active: true,
    created_at: now.toISOString(),
  },
  {
    id: 'community-fallback-10',
    created_by: null,
    title: 'Live report contest',
    description:
      'Couvre un contest local en stories ou live et partage le résumé avec la communauté SkateConnect.',
    challenge_type: 'community',
    difficulty: 2,
    prize: 'Badge « Reporter » + 140 XP',
    start_date: now.toISOString(),
    end_date: addDaysIso(now, 6),
    participants_count: 119,
    is_active: true,
    created_at: now.toISOString(),
  },
];

export const createFallbackChallenges = (): Challenge[] => {
  const now = new Date();

  return [
    ...createCommunityFallbackChallenges(now),
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
      end_date: addDaysIso(now, 7),
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
      end_date: addDaysIso(now, 5),
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
      end_date: addDaysIso(now, 1),
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

type DailyChallengeTemplate = {
  id: string;
  title: string;
  description: string;
  target_count: number;
  xp_reward: number;
};

type WeeklyChallengeTemplate = DailyChallengeTemplate & {
  challenge_type: 'weekly';
  durationDays: number;
};

const DAILY_CHALLENGE_POOL: (DailyChallengeTemplate & { badge_hint?: string })[] = [
  {
    id: 'daily-spot-hunt',
    title: 'Chasse au nouveau spot',
    description: 'Référence un spot inédit et ajoute deux photos pour débloquer le badge « Scout urbain ».',
    target_count: 1,
    xp_reward: 80,
  },
  {
    id: 'daily-crew-check',
    title: 'Crew check-in',
    description: 'Tagge trois membres de ta crew sur une story SkateConnect avant minuit.',
    target_count: 3,
    xp_reward: 70,
  },
  {
    id: 'daily-flat-challenge',
    title: 'Routine flat',
    description: 'Enchaîne cinq tricks flat différents et poste ta meilleure line.',
    target_count: 5,
    xp_reward: 95,
  },
  {
    id: 'daily-badge-grind',
    title: 'Session grind',
    description: 'Valide trois grinds différents sur le même module pour avancer vers le badge « Rail Lord ».',
    target_count: 3,
    xp_reward: 110,
  },
  {
    id: 'daily-community-boost',
    title: 'Boost communautaire',
    description: 'Like et commente cinq posts de riders débutants pour gagner du karma et des XP.',
    target_count: 5,
    xp_reward: 65,
  },
  {
    id: 'daily-switch-master',
    title: 'Switch master',
    description: 'Pose deux tricks en switch sur des spots différents.',
    target_count: 2,
    xp_reward: 120,
  },
  {
    id: 'daily-diy-upgrade',
    title: 'DIY upgrade express',
    description: 'Apporte une amélioration à un spot DIY et partage un avant/après.',
    target_count: 1,
    xp_reward: 90,
  },
  {
    id: 'daily-mentor-shoutout',
    title: 'Mentor shout-out',
    description: 'Publie un clip d’un rider que tu coachs et raconte sa progression.',
    target_count: 1,
    xp_reward: 85,
  },
  {
    id: 'daily-night-owl',
    title: 'Night owl session',
    description: 'Complète une line après 21h et partage la vidéo nocturne.',
    target_count: 1,
    xp_reward: 100,
  },
  {
    id: 'daily-eco-ride',
    title: 'Ride éco-responsable',
    description: 'Partage un trajet collectif ou écolo pour aller skater et inspire ta communauté.',
    target_count: 1,
    xp_reward: 60,
  },
  {
    id: 'daily-creative-angle',
    title: 'Angle créatif',
    description: 'Filme un trick avec un angle inédit (drone, fish-eye, POV) et poste le clip.',
    target_count: 1,
    xp_reward: 105,
  },
  {
    id: 'daily-legacy-recap',
    title: 'Legacy recap',
    description: 'Compose un mini montage de tes trois meilleurs clips du mois et partage-le.',
    target_count: 3,
    xp_reward: 115,
  },
];

const WEEKLY_CHALLENGE_TEMPLATES: WeeklyChallengeTemplate[] = [
  {
    id: 'weekly-tour-des-quartiers',
    title: 'Tour des quartiers',
    description: 'Valide cinq spots différents dans la semaine et laisse un avis sur chacun.',
    target_count: 5,
    xp_reward: 220,
    challenge_type: 'weekly',
    durationDays: 7,
  },
  {
    id: 'weekly-clip-collectif',
    title: 'Clip collectif',
    description: 'Publie une vidéo de groupe avec au moins trois riders différents.',
    target_count: 1,
    xp_reward: 260,
    challenge_type: 'weekly',
    durationDays: 7,
  },
  {
    id: 'weekly-badge-hunter',
    title: 'Chasseur de badges',
    description: 'Débloque deux badges en complétant les défis quotidiens ou communautaires.',
    target_count: 2,
    xp_reward: 320,
    challenge_type: 'weekly',
    durationDays: 7,
  },
];

const getIsoStartOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getIsoStartOfWeek = (date: Date) => {
  const start = getIsoStartOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // start week on Monday
  start.setDate(start.getDate() + diff);
  return start;
};

const createDailyChallengeInstances = (today: Date): DailyChallenge[] => {
  const daySeed = Math.floor(today.getTime() / 86400000);

  return Array.from({ length: 5 }).map((_, index) => {
    const template = DAILY_CHALLENGE_POOL[(daySeed + index) % DAILY_CHALLENGE_POOL.length];
    return {
      id: `${template.id}-${daySeed}`,
      title: template.title,
      description: template.description,
      challenge_type: 'daily' as const,
      target_count: template.target_count,
      xp_reward: template.xp_reward,
      start_date: today.toISOString(),
      end_date: addDaysIso(today, 1),
    } satisfies DailyChallenge;
  });
};

const createWeeklyChallengeInstances = (weekStart: Date): DailyChallenge[] => {
  const weekSeed = Math.floor(weekStart.getTime() / 86400000);

  return WEEKLY_CHALLENGE_TEMPLATES.map((template, index) => ({
    id: `${template.id}-${weekSeed + index}`,
    title: template.title,
    description: template.description,
    challenge_type: template.challenge_type,
    target_count: template.target_count,
    xp_reward: template.xp_reward,
    start_date: weekStart.toISOString(),
    end_date: addDaysIso(weekStart, template.durationDays),
  }));
};

export const createFallbackDailyChallenges = (): DailyChallenge[] => {
  const now = new Date();
  const today = getIsoStartOfDay(now);
  const weekStart = getIsoStartOfWeek(now);

  return [...createDailyChallengeInstances(today), ...createWeeklyChallengeInstances(weekStart)];
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
