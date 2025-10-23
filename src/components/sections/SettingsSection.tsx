import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Profile, Section } from '../../types';
import { settingsCategories, quickSettingsLinks } from '../../data/settingsCatalog';
import SubscriptionPlanTester from '../subscription/SubscriptionPlanTester';

interface SettingsSectionProps {
  profile: Profile | null;
  onNavigate: (section: Section) => boolean | void;
}

const STORAGE_KEY = 'shredloc:settings-preferences';

const buildDefaultPreferences = () => {
  const defaults: Record<string, boolean> = {};
  settingsCategories.forEach((category) => {
    category.items.forEach((item) => {
      defaults[item.id] = item.defaultValue;
    });
  });
  return defaults;
};

export default function SettingsSection({ profile, onNavigate }: SettingsSectionProps) {
  const defaultPreferences = useMemo(() => buildDefaultPreferences(), []);

  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return defaultPreferences;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return defaultPreferences;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean> | null;
      if (!parsed || typeof parsed !== 'object') {
        return defaultPreferences;
      }

      return { ...defaultPreferences, ...parsed };
    } catch (error) {
      console.error('Impossible de charger les préférences sauvegardées :', error);
      return defaultPreferences;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Impossible de sauvegarder les préférences :', error);
    }
  }, [preferences]);

  const togglePreference = (id: string) => {
    setPreferences((previous) => {
      const nextValue = !previous[id];
      return {
        ...previous,
        [id]: nextValue,
      };
    });
  };

  const quickLinks = quickSettingsLinks.map((link) => ({
    ...link,
    action:
      link.id === 'privacy'
        ? () => onNavigate('privacy')
        : link.id === 'terms'
          ? () => onNavigate('terms')
          : () => {},
  }));

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

      <SubscriptionPlanTester />

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
                    id={`setting-${item.id}`}
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
                      <span className="sr-only" aria-live="polite">
                        {enabled ? `${item.title} activé` : `${item.title} désactivé`}
                      </span>
                    </button>
                    <div className="text-sm text-gray-400 md:text-right">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${
                          enabled
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                            : 'border-dark-600 text-gray-400 bg-dark-700/60'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        {enabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </div>
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
