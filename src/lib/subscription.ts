import type { Section } from '../types';

export type SubscriptionPlan = 'free-ride' | 'shred-pass' | 'pro-loc' | 'brand-crew';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlan;
  label: string;
  description: string;
  accentColor: string;
}

export const subscriptionPlans: SubscriptionPlanDefinition[] = [
  {
    id: 'free-ride',
    label: 'Free Ride',
    description:
      'Accès découverte : carte publique, fil d’actualité et gestion de ton profil de base.',
    accentColor: 'from-slate-500 via-slate-400 to-slate-300',
  },
  {
    id: 'shred-pass',
    label: 'Shred Pass',
    description:
      'Pack progression : accès complet aux défis, badges actifs et classement communautaire.',
    accentColor: 'from-emerald-500 via-emerald-400 to-emerald-300',
  },
  {
    id: 'pro-loc',
    label: 'Pro Loc',
    description:
      'Profil pro : outils de sponsoring, messagerie avancée et espace récompenses exclusif.',
    accentColor: 'from-orange-500 via-orange-400 to-amber-300',
  },
  {
    id: 'brand-crew',
    label: 'Brand Crew',
    description:
      'Suite marques & organisations : pilotage des campagnes et analytics communautaires.',
    accentColor: 'from-purple-500 via-fuchsia-500 to-pink-400',
  },
];

const planOrder: SubscriptionPlan[] = ['free-ride', 'shred-pass', 'pro-loc', 'brand-crew'];

export const orderedSubscriptionPlans: SubscriptionPlan[] = [...planOrder];

const planRank = planOrder.reduce<Record<SubscriptionPlan, number>>((accumulator, value, index) => {
  accumulator[value] = index;
  return accumulator;
}, {
  'free-ride': 0,
  'shred-pass': 0,
  'pro-loc': 0,
  'brand-crew': 0,
});

const sectionRequirements: Record<Section, SubscriptionPlan> = {
  map: 'free-ride',
  feed: 'free-ride',
  events: 'free-ride',
  search: 'free-ride',
  pricing: 'free-ride',
  profile: 'free-ride',
  settings: 'free-ride',
  privacy: 'free-ride',
  terms: 'free-ride',
  challenges: 'shred-pass',
  leaderboard: 'shred-pass',
  badges: 'shred-pass',
  sponsors: 'pro-loc',
  rewards: 'pro-loc',
  messages: 'pro-loc',
  notifications: 'pro-loc',
};

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = 'free-ride';

export const SUBSCRIPTION_STORAGE_KEY = 'shredloc:subscription-plan';

export function getPlanDefinition(plan: SubscriptionPlan): SubscriptionPlanDefinition {
  const definition = subscriptionPlans.find((candidate) => candidate.id === plan);
  if (!definition) {
    return subscriptionPlans[0];
  }

  return definition;
}

export function getRequiredPlanForSection(section: Section): SubscriptionPlan {
  return sectionRequirements[section] ?? DEFAULT_SUBSCRIPTION_PLAN;
}

export function canAccessSection(plan: SubscriptionPlan, section: Section): boolean {
  const requiredPlan = getRequiredPlanForSection(section);
  return planRank[plan] >= planRank[requiredPlan];
}

export function findNextEligiblePlan(current: SubscriptionPlan, section: Section): SubscriptionPlan | null {
  const required = getRequiredPlanForSection(section);
  if (planRank[current] >= planRank[required]) {
    return null;
  }

  return required;
}

export function getUpgradeMessage(
  plan: SubscriptionPlan,
  section: Section,
  options?: { displayName?: string },
): string {
  const requiredPlan = getRequiredPlanForSection(section);
  if (planRank[plan] >= planRank[requiredPlan]) {
    return '';
  }

  const planLabel = getPlanDefinition(plan).label;
  const requiredLabel = getPlanDefinition(requiredPlan).label;
  const featureName = options?.displayName ?? `cette section`;

  return `Ton mode « ${planLabel} » actuel ne permet pas encore d’accéder à ${featureName}. Passe en « ${requiredLabel} » pour activer toutes les options.`;
}

export function listAvailableSections(plan: SubscriptionPlan): Section[] {
  return (Object.keys(sectionRequirements) as Section[]).filter((section) => canAccessSection(plan, section));
}

export function getPlanLabel(plan: SubscriptionPlan): string {
  return getPlanDefinition(plan).label;
}

export function getHigherPlans(plan: SubscriptionPlan): SubscriptionPlan[] {
  const currentRank = planRank[plan];
  return planOrder.filter((candidate) => planRank[candidate] > currentRank);
}

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return planOrder.includes(value as SubscriptionPlan);
}
