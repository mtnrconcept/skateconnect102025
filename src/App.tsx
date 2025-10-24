import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Header from './components/Header';
import Footer from './components/Footer';
import MobileNavigation from './components/MobileNavigation';
import MapSection from './components/sections/MapSection';
import FeedSection from './components/sections/FeedSection';
import EventsSection from './components/sections/EventsSection';
import ChallengesSection from './components/sections/ChallengesSection';
import ProfileSection from './components/sections/ProfileSection';
import BadgesSection from './components/sections/BadgesSection';
import RewardsSection from './components/sections/RewardsSection';
import LeaderboardSection from './components/sections/LeaderboardSection';
import PricingSection from './components/sections/PricingSection';
import SettingsSection from './components/sections/SettingsSection';
import MessagesSection from './components/sections/MessagesSection';
import PrivacyPolicySection from './components/sections/PrivacyPolicySection';
import TermsSection from './components/sections/TermsSection';
import SponsorsSection from './components/sections/SponsorsSection';
import SponsorDashboard from './components/sponsors/SponsorDashboard';
import AchievementNotification from './components/AchievementNotification';
import SubscriptionUpgradeNotice from './components/subscription/SubscriptionUpgradeNotice';
import { SubscriptionProvider, type RestrictionNotice } from './contexts/SubscriptionContext';
import { SponsorProvider } from './contexts/SponsorContext';
import {
  DEFAULT_SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STORAGE_KEY,
  canAccessSection,
  findNextEligiblePlan,
  getUpgradeMessage,
  isSubscriptionPlan,
  type SubscriptionPlan,
} from './lib/subscription';
import type { Profile, Section, ContentNavigationOptions } from './types';
import type { FakeDirectMessagePayload } from './types/messages';

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentSection, setCurrentSection] = useState<Section>('feed');
  const [loading, setLoading] = useState(true);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    section: Section;
    options?: ContentNavigationOptions;
  } | null>(null);
  const [challengeFocus, setChallengeFocus] = useState<ContentNavigationOptions | null>(null);
  const [mapFocusSpotId, setMapFocusSpotId] = useState<string | null>(null);
  const [queuedDirectMessages, setQueuedDirectMessages] = useState<FakeDirectMessagePayload[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_SUBSCRIPTION_PLAN;
    }

    const stored = window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (stored && isSubscriptionPlan(stored)) {
      return stored;
    }

    return DEFAULT_SUBSCRIPTION_PLAN;
  });
  const [restrictionNotice, setRestrictionNotice] = useState<RestrictionNotice | null>(null);

  const sectionDisplayNames = useMemo<Record<Section, string>>(
    () => ({
      feed: "le fil d'actu",
      map: 'la carte',
      events: 'les événements',
      challenges: 'les défis sponsorisés',
      sponsors: "l’espace sponsor",
      pricing: 'les abonnements',
      profile: 'ton profil avancé',
      messages: 'la messagerie avancée',
      badges: 'les badges actifs',
      rewards: 'le store des récompenses',
      leaderboard: 'le classement',
      settings: 'les paramètres',
      privacy: 'la politique de confidentialité',
      terms: 'les conditions générales',
      notifications: 'les notifications',
    }),
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, subscriptionPlan);
    } catch (error) {
      console.error('Impossible de sauvegarder le mode abonnement :', error);
    }
  }, [subscriptionPlan]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleExternalDirectMessage = (event: Event) => {
      const customEvent = event as CustomEvent<FakeDirectMessagePayload>;
      const payload = customEvent.detail;

      if (!payload?.message?.id) {
        return;
      }

      setQueuedDirectMessages((previous) => {
        if (previous.some((item) => item.message.id === payload.message.id)) {
          return previous;
        }
        return [...previous, payload];
      });

      setCurrentSection((current) => (current === 'messages' ? current : 'messages'));
    };

    window.addEventListener(
      'shredloc:direct-message',
      handleExternalDirectMessage as EventListener,
    );

    return () => {
      window.removeEventListener(
        'shredloc:direct-message',
        handleExternalDirectMessage as EventListener,
      );
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setProfile(null);
        return;
      }

      const normalizedProfile: Profile = {
        ...data,
        role: (data.role ?? 'skater') as Profile['role'],
        sponsor_contact: data.sponsor_contact ?? null,
        sponsor_branding: data.sponsor_branding ?? null,
        sponsor_permissions: data.sponsor_permissions ?? null,
      };

      setProfile(normalizedProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });
  };

  const handlePlanChange = (plan: SubscriptionPlan) => {
    setSubscriptionPlan(plan);
    setRestrictionNotice(null);
  };

  const handleQueuedMessagesProcessed = useCallback((messageIds: string[]) => {
    if (!messageIds.length) {
      return;
    }

    setQueuedDirectMessages((previous) =>
      previous.filter((payload) => !messageIds.includes(payload.message.id)),
    );
  }, []);

  const handleNavigateToContent = (section: Section, options?: ContentNavigationOptions): boolean => {
    if (!canAccessSection(subscriptionPlan, section)) {
      setPendingNavigation(null);
      const requiredPlan = findNextEligiblePlan(subscriptionPlan, section);
      if (requiredPlan) {
        const message = getUpgradeMessage(subscriptionPlan, section, {
          displayName: sectionDisplayNames[section] ?? 'cette section',
        });
        setRestrictionNotice({
          target: section,
          requiredPlan,
          message,
        });
      }
      return false;
    }

    setRestrictionNotice(null);
    setCurrentSection(section);
    if (options) {
      setPendingNavigation({ section, options });
    } else {
      setPendingNavigation(null);
    }

    return true;
  };

  useEffect(() => {
    if (!pendingNavigation) {
      return;
    }

    if (currentSection !== pendingNavigation.section) {
      return;
    }

    const { options } = pendingNavigation;

    if (pendingNavigation.section === 'challenges') {
      setChallengeFocus(options ?? null);
      setPendingNavigation(null);
      return;
    }

    if (pendingNavigation.section === 'map' && options?.spotId) {
      setMapFocusSpotId(options.spotId);
      setPendingNavigation(null);
      return;
    }

    if (options?.scrollToId) {
      const timeout = window.setTimeout(() => {
        const element = document.getElementById(options.scrollToId!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 220);

      setPendingNavigation(null);

      return () => window.clearTimeout(timeout);
    }

    setPendingNavigation(null);
  }, [pendingNavigation, currentSection]);

  useEffect(() => {
    if (currentSection !== 'challenges') {
      setChallengeFocus(null);
    }
    if (currentSection !== 'map') {
      setMapFocusSpotId(null);
    }
  }, [currentSection]);

  useEffect(() => {
    if (canAccessSection(subscriptionPlan, currentSection)) {
      return;
    }

    const fallbackOrder: Section[] = ['feed', 'map', 'pricing'];
    const fallback = fallbackOrder.find((section) => canAccessSection(subscriptionPlan, section)) ?? 'feed';
    setCurrentSection(fallback);
    setPendingNavigation(null);
  }, [subscriptionPlan, currentSection]);

  const dimmedClass = isSearchActive
    ? 'transition-all duration-300 ease-out opacity-40 pointer-events-none blur-[1px]'
    : 'transition-all duration-300 ease-out';

  const subscriptionContextValue = useMemo(
    () => ({
      plan: subscriptionPlan,
      setPlan: handlePlanChange,
      lastRestriction: restrictionNotice,
      setRestriction: setRestrictionNotice,
    }),
    [subscriptionPlan, restrictionNotice, handlePlanChange],
  );

  let content: JSX.Element;

  if (loading) {
    content = (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo2.png" alt="Shredloc" className="neon-logo h-150 w-auto animate-pulse" />
          </div>
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  } else if (!session) {
    content = <Auth onAuthSuccess={handleAuthSuccess} />;
  } else {
    content = (
      <SponsorProvider profile={profile}>
        <div className="min-h-screen bg-dark-900 flex flex-col">
          <Header
            profile={profile}
            currentSection={currentSection}
            onSectionChange={handleNavigateToContent}
            onNavigateToContent={handleNavigateToContent}
            onSearchFocusChange={setIsSearchActive}
          />
          <div className={dimmedClass}>
            <MobileNavigation currentSection={currentSection} onNavigate={handleNavigateToContent} />
          </div>

          <main className={`flex-1 pt-16 pb-20 md:pb-16 lg:pb-40 ${dimmedClass}`}>
            {currentSection === 'map' && (
              <MapSection
                focusSpotId={mapFocusSpotId}
                onSpotFocusHandled={() => setMapFocusSpotId(null)}
              />
            )}
            {currentSection === 'feed' && <FeedSection currentUser={profile} />}
            {currentSection === 'events' && <EventsSection profile={profile} />}
            {currentSection === 'challenges' && (
              <ChallengesSection
                profile={profile}
                focusConfig={challengeFocus}
                onFocusHandled={() => setChallengeFocus(null)}
              />
            )}
            {currentSection === 'sponsors' &&
              (profile?.role === 'sponsor' ? (
                <SponsorDashboard />
              ) : (
                <SponsorsSection profile={profile} />
              ))}
            {currentSection === 'pricing' && <PricingSection />}
            {currentSection === 'profile' && (
              <ProfileSection profile={profile} onProfileUpdate={setProfile} />
            )}
            {currentSection === 'badges' && <BadgesSection profile={profile} />}
            {currentSection === 'rewards' && <RewardsSection profile={profile} />}
            {currentSection === 'leaderboard' && <LeaderboardSection profile={profile} />}
            {currentSection === 'messages' && <MessagesSection profile={profile} />}
            {currentSection === 'settings' && (
              <SettingsSection profile={profile} onNavigate={handleNavigateToContent} />
            )}
            {currentSection === 'privacy' && <PrivacyPolicySection onNavigate={handleNavigateToContent} />}
            {currentSection === 'terms' && <TermsSection onNavigate={handleNavigateToContent} />}
          </main>

          <div className={dimmedClass}>{profile && <AchievementNotification profile={profile} />}</div>
          <div className={`${dimmedClass} lg:mt-auto`}>
            <Footer onSectionChange={handleNavigateToContent} />
          </div>
        </div>
      </SponsorProvider>
    );
  }

  return (
    <SubscriptionProvider value={subscriptionContextValue}>
      {restrictionNotice && session && (
        <SubscriptionUpgradeNotice
          notice={restrictionNotice}
          currentPlan={subscriptionPlan}
          onClose={() => setRestrictionNotice(null)}
          onSimulateUpgrade={handlePlanChange}
          onViewPricing={() => handleNavigateToContent('pricing')}
        />
      )}
      {content}
    </SubscriptionProvider>
  );
}

export default App;
