import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Megaphone, Sparkles } from 'lucide-react';
import type { Profile, ProfileExperienceMode, Section } from '../../types';
import { settingsCategories, quickSettingsLinks } from '../../data/settingsCatalog';
import SubscriptionPlanTester from '../subscription/SubscriptionPlanTester';
import { sponsorModeHighlights } from '../../data/sponsorExperience';
import { getNotificationPreferences, saveNotificationPreferences } from '../../lib/notifications';

interface SettingsSectionProps {
  profile: Profile | null;
  onNavigate: (section: Section) => boolean | void;
  profileMode: ProfileExperienceMode;
  onProfileModeChange: (mode: ProfileExperienceMode) => void;
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

export default function SettingsSection({ profile, onNavigate, profileMode, onProfileModeChange }: SettingsSectionProps) {
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

  const [isLoadingRemotePreferences, setIsLoadingRemotePreferences] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!profile?.id) {
      setIsLoadingRemotePreferences(false);
      setSyncState('idle');
      setSyncError(null);
      return;
    }

    let isMounted = true;
    setIsLoadingRemotePreferences(true);
    setSyncError(null);

    getNotificationPreferences(defaultPreferences)
      .then((remotePreferences) => {
        if (!isMounted) {
          return;
        }
        setPreferences(remotePreferences);
        setSyncState('idle');
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        console.error('Impossible de charger les préférences de notification :', error);
        setSyncState('error');
        setSyncError("Impossible de charger les préférences de notification.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRemotePreferences(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profile?.id, defaultPreferences]);

  const persistPreferences = useCallback(
    async (nextPreferences: Record<string, boolean>) => {
      if (!profile?.id) {
        return;
      }

      setSyncState('saving');
      setSyncError(null);

      try {
        await saveNotificationPreferences(nextPreferences);
        setSyncState('idle');
      } catch (error) {
        console.error('Impossible de sauvegarder les préférences de notification :', error);
        setSyncState('error');
        setSyncError("Impossible d'enregistrer les préférences. Réessayez.");
      }
    },
    [profile?.id]
  );

  const togglePreference = (id: string) => {
    setPreferences((previous) => {
      const nextValue = !previous[id];
      const nextPreferences = {
        ...previous,
        [id]: nextValue,
      };

      void persistPreferences(nextPreferences);
      return nextPreferences;
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

  const isSponsorMode = profileMode === 'sponsor';
  const sponsorToggleLabel = isSponsorMode ? 'Revenir au profil rider' : 'Activer le profil sponsor';
  const sponsorStatusLabel = isSponsorMode ? 'Profil sponsor actif' : 'Mode sponsor inactif';
  const handleSponsorModeToggle = () => {
    onProfileModeChange(isSponsorMode ? 'rider' : 'sponsor');
  };

  const isPreferenceInteractionDisabled = isLoadingRemotePreferences || syncState === 'saving';

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

      <section className="bg-dark-800 border border-dark-700 rounded-3xl p-6 md:p-8 shadow-lg shadow-orange-500/5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-orange-300">
              <Megaphone size={16} />
              Mode sponsor immersif
            </span>
            <h2 className="text-2xl font-semibold text-white">Pilotez Shredloc comme un sponsor</h2>
            <p className="text-gray-400 max-w-2xl">
              Activez un profil sponsor pour débloquer le dashboard, les outils marketing et tester la collaboration marque ×
              riders sans attendre la validation d&apos;un compte partenaire.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 min-w-[220px]">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isSponsorMode
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/40'
                  : 'bg-dark-700 text-gray-400 border border-dark-600'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isSponsorMode ? 'bg-emerald-300' : 'bg-gray-500'}`} />
              {sponsorStatusLabel}
            </span>
            <button
              type="button"
              onClick={handleSponsorModeToggle}
              className="w-full rounded-full bg-orange-500/80 hover:bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              {sponsorToggleLabel}
            </button>
            {isSponsorMode && (
              <button
                type="button"
                onClick={() => onNavigate('sponsors')}
                className="w-full rounded-full border border-orange-500/60 px-5 py-2.5 text-sm font-semibold text-orange-300 hover:bg-orange-500/10 transition-colors"
              >
                Ouvrir le cockpit sponsor
              </button>
            )}
          </div>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsorModeHighlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-3 rounded-2xl bg-dark-900/60 border border-dark-700 px-4 py-3 text-sm text-gray-300"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                <Sparkles size={18} />
              </span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </section>

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
        {profile && (
          <div className="flex flex-col gap-3 rounded-3xl bg-dark-800 border border-dark-700 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Synchronisation des notifications</p>
              <p className="text-xs text-gray-400">Vos préférences sont sauvegardées dans le cloud pour rester cohérentes sur tous vos appareils.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isLoadingRemotePreferences ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-orange-200">Chargement des préférences...</span>
                </>
              ) : syncState === 'error' ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-red-300">{syncError ?? 'Une erreur est survenue.'}</span>
                </>
              ) : syncState === 'saving' ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-blue-200">Synchronisation en cours...</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-200">Préférences synchronisées</span>
                </>
              )}
            </div>
          </div>
        )}
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
                      disabled={isPreferenceInteractionDisabled}
                      className={`relative w-16 h-8 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/70 ${
                        enabled ? 'bg-orange-500/80' : 'bg-dark-600'
                      } ${
                        isPreferenceInteractionDisabled ? 'opacity-60 cursor-not-allowed' : ''
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
