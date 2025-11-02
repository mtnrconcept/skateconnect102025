import {
  Map,
  Home,
  CalendarDays,
  Trophy,
  ShoppingBag,
  Store,
  TrendingUp,
  Handshake,
  Gift,
  Coins,
  Mail,
  User,
  Award,
  Settings,
  Shield,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Section } from '../types';

export interface NavigationItem {
  id: Section;
  label: string;
  icon: LucideIcon;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    title: 'Navigation principale',
    items: [
      { id: 'feed', label: "Fil d'actu", icon: Home },
      { id: 'map', label: 'Carte', icon: Map },
      { id: 'events', label: 'Événements', icon: CalendarDays },
      { id: 'challenges', label: 'Défis', icon: Trophy },
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'leaderboard', label: 'Classement', icon: TrendingUp },
      { id: 'sponsors', label: 'Sponsor', icon: Handshake },
      { id: 'pricing', label: 'Abonnements', icon: Coins },
      
    ],
  },
  {
    title: 'Espace membre',
    items: [
      { id: 'messages', label: 'Messages', icon: Mail },
      { id: 'profile', label: 'Profil', icon: User },
      { id: 'badges', label: 'Badge', icon: Award },
      { id: 'settings', label: 'Paramètres', icon: Settings },
    ],
  },
  {
    title: 'Informations',
    items: [
      { id: 'privacy', label: 'Confidentialité', icon: Shield },
      { id: 'terms', label: 'Conditions', icon: FileText },
    ],
  },
];

const primaryNavigationBase = navigationGroups[0]?.items ?? [];
const badgesNavigationItem = navigationGroups
  .flatMap((group) => group.items)
  .find((item) => item.id === 'badges');
const settingsNavigationItem = navigationGroups
  .flatMap((group) => group.items)
  .find((item) => item.id === 'settings');
export const primaryNavigationItems = (() => {
  const base = [...primaryNavigationBase];
  if (badgesNavigationItem) base.push(badgesNavigationItem);
  if (settingsNavigationItem) base.push(settingsNavigationItem);
  return base;
})();

export const searchableNavigationItems = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    category: group.title,
  })),
);
