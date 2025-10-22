import type { ComponentType } from 'react';
import { Bell, Globe, Lock, Shield, ShieldCheck, Trophy, Users, Volume2, FileText } from 'lucide-react';

export type PreferenceItem = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  defaultValue: boolean;
};

export type SettingsCategory = {
  id: string;
  title: string;
  description: string;
  items: PreferenceItem[];
};

export type QuickSettingsLink = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
};

export const settingsCategories: SettingsCategory[] = [
  {
    id: 'general',
    title: 'Paramètres généraux du compte',
    description:
      'Gérez les informations de base visibles sur votre profil et votre expérience sur Shredloc.',
    items: [
      {
        id: 'public-profile',
        title: 'Profil public',
        description: "Affichez votre profil et vos posts aux riders qui ne vous suivent pas encore.",
        icon: Globe,
        defaultValue: true,
      },
      {
        id: 'session-reminders',
        title: 'Rappels de sessions',
        description: 'Recevez des notifications pour rappeler vos sessions enregistrées.',
        icon: Bell,
        defaultValue: true,
      },
      {
        id: 'friend-suggestions',
        title: 'Suggestions de riders',
        description: 'Recommandations personnalisées basées sur vos spots et défis suivis.',
        icon: Users,
        defaultValue: true,
      },
    ],
  },
  {
    id: 'security',
    title: 'Sécurité et connexion',
    description: 'Renforcez la protection de votre compte et contrôlez les appareils connectés.',
    items: [
      {
        id: 'two-factor',
        title: 'Connexion à deux facteurs',
        description: 'Ajoutez un code supplémentaire lors de chaque connexion pour plus de sécurité.',
        icon: Shield,
        defaultValue: false,
      },
      {
        id: 'login-alerts',
        title: 'Alertes de connexion',
        description: 'Soyez prévenu lorsqu’une nouvelle connexion est détectée.',
        icon: Lock,
        defaultValue: true,
      },
      {
        id: 'session-audio',
        title: 'Audio automatique des clips',
        description: 'Activez le son automatiquement pour les vidéos dans votre feed.',
        icon: Volume2,
        defaultValue: false,
      },
    ],
  },
  {
    id: 'community',
    title: 'Communauté et modération',
    description: 'Définissez comment vous interagissez avec la communauté et les messages reçus.',
    items: [
      {
        id: 'message-requests',
        title: 'Demandes de messages',
        description: 'Filtrer les messages des riders qui ne font pas partie de vos contacts.',
        icon: Users,
        defaultValue: true,
      },
      {
        id: 'spot-reviews',
        title: 'Avis sur les spots',
        description: 'Recevez une notification lorsqu’un rider laisse un avis sur un spot que vous suivez.',
        icon: Bell,
        defaultValue: true,
      },
      {
        id: 'challenge-highlights',
        title: 'Moments forts des défis',
        description: 'Mettre en avant vos participations aux défis dans le feed communautaire.',
        icon: Trophy,
        defaultValue: true,
      },
    ],
  },
];

export const quickSettingsLinks: QuickSettingsLink[] = [
  {
    id: 'privacy',
    title: 'Politique de confidentialité',
    description: 'Découvrez comment vos données sont protégées et comment gérer vos préférences.',
    icon: ShieldCheck,
  },
  {
    id: 'terms',
    title: 'Conditions générales',
    description: 'Apprenez-en plus sur les règles qui encadrent l’utilisation de Shredloc.',
    icon: FileText,
  },
];
