import {
  Map,
  Home,
  CalendarDays,
  Trophy,
  TrendingUp,
  Handshake,
  Gift,
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
      { id: 'leaderboard', label: 'Classement', icon: TrendingUp },
      { id: 'sponsors', label: 'Sponsor', icon: Handshake },
      { id: 'rewards', label: 'Store', icon: Gift },
    ],
  },
  {
    title: 'Espace membre',
    items: [
      { id: 'messages', label: 'Messages', icon: Mail },
      { id: 'profile', label: 'Profil', icon: User },
      { id: 'badges', label: 'Badges', icon: Award },
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

export const primaryNavigationItems = navigationGroups[0]?.items ?? [];

export const searchableNavigationItems = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    category: group.title,
  })),
);
