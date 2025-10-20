import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Bell,
  Lock,
  Shield,
  Users,
  Volume2,
  Globe,
  ChevronRight,
  ShieldCheck,
  FileText,
  Trophy,
} from 'lucide-react';
import type { Profile, Section } from '../../types';

interface SettingsSectionProps {
  profile: Profile | null;
  onNavigate: (section: Section) => void;
}

type PreferenceItem = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  defaultValue: boolean;
};

type SettingsCategory = {
  id: string;
  title: string;
  description: string;
  items: PreferenceItem[];
};

export default function SettingsSection({ profile, onNavigate }: SettingsSectionProps) {
  const settingsCategories = useMemo<SettingsCategory[]>(
    () => [
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
    ],
    []
  );

  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    settingsCategories.forEach((category) => {
      category.items.forEach((item) => {
        initial[item.id] = item.defaultValue;
      });
    });
    return initial;
  });

  const togglePreference = (id: string) => {
    setPreferences((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const quickLinks = [
    {
      id: 'privacy',
      title: 'Politique de confidentialité',
      description: 'Découvrez comment vos données sont protégées et comment gérer vos préférences.',
      icon: ShieldCheck,
      action: () => onNavigate('privacy'),
    },
    {
      id: 'terms',
      title: 'Conditions générales',
      description: 'Apprenez-en plus sur les règles qui encadrent l’utilisation de Shredloc.',
      icon: FileText,
      action: () => onNavigate('terms'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <div className="bg-gradient-to-r from-orange-500/90 via-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Centre de paramètres</h1>
            <p className="text-orange-100 max-w-2xl">
              Retrouvez toutes vos préférences de compte, de confidentialité et de sécurité inspirées du centre de contrôle de
              Facebook, adaptées à la communauté Shredloc.
            </p>
          </div>
          {profile && (
            <div className="bg-white/15 rounded-2xl px-6 py-4 backdrop-blur-sm">
              <p className="text-sm uppercase tracking-wider text-orange-100/70">Connecté en tant que</p>
              <p className="text-lg font-semibold">{profile.display_name ?? profile.username}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              onClick={link.action}
              className="text-left bg-dark-800 border border-dark-700 rounded-2xl p-6 hover:border-orange-500/70 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
                    <Icon size={24} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{link.title}</h2>
                    <p className="text-sm text-gray-400">{link.description}</p>
                  </div>
                </div>
                <ChevronRight className="text-gray-500 group-hover:text-orange-400 transition-colors" />
              </div>
              <p className="text-sm text-gray-500">
                Consultez les engagements de Shredloc pour protéger votre communauté et vos données personnelles.
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-8">
        {settingsCategories.map((category) => (
          <section key={category.id} className="bg-dark-800 border border-dark-700 rounded-3xl p-6 md:p-8">
            <header className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">{category.title}</h2>
              <p className="text-gray-400 max-w-3xl">{category.description}</p>
            </header>

            <div className="space-y-4">
              {category.items.map((item) => {
                const Icon = item.icon;
                const enabled = preferences[item.id];

                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-dark-900/60 rounded-2xl px-4 py-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="w-12 h-12 rounded-2xl bg-dark-700 flex items-center justify-center text-orange-400">
                        <Icon size={22} />
                      </span>
                      <div>
                        <h3 className="text-lg font-medium text-white">{item.title}</h3>
                        <p className="text-sm text-gray-400">{item.description}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => togglePreference(item.id)}
                      className={`relative w-16 h-8 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/70 ${
                        enabled ? 'bg-orange-500/80' : 'bg-dark-600'
                      }`}
                      type="button"
                      aria-pressed={enabled}
                      aria-label={`Basculer ${item.title}`}
                    >
                      <span
                        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
