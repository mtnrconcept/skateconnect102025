import { useState, useEffect } from 'react';
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
import SettingsSection from './components/sections/SettingsSection';
import MessagesSection from './components/sections/MessagesSection';
import PrivacyPolicySection from './components/sections/PrivacyPolicySection';
import TermsSection from './components/sections/TermsSection';
import SponsorsSection from './components/sections/SponsorsSection';
import AchievementNotification from './components/AchievementNotification';
import type { Profile, Section } from './types';

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentSection, setCurrentSection] = useState<Section>('feed');
  const [loading, setLoading] = useState(true);

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

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="Shredloc" className="h-150 w-auto animate-pulse" />
          </div>
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        profile={profile}
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
      />
      <MobileNavigation currentSection={currentSection} onNavigate={setCurrentSection} />

      <main className="pt-16 pb-16 md:pb-10 lg:pb-8">
        {currentSection === 'map' && <MapSection />}
        {currentSection === 'feed' && <FeedSection currentUser={profile} />}
        {currentSection === 'events' && <EventsSection profile={profile} />}
        {currentSection === 'challenges' && <ChallengesSection profile={profile} />}
        {currentSection === 'sponsors' && <SponsorsSection profile={profile} />}
        {currentSection === 'profile' && (
          <ProfileSection profile={profile} onProfileUpdate={setProfile} />
        )}
        {currentSection === 'badges' && <BadgesSection profile={profile} />}
        {currentSection === 'rewards' && <RewardsSection profile={profile} />}
        {currentSection === 'leaderboard' && <LeaderboardSection profile={profile} />}
        {currentSection === 'messages' && <MessagesSection profile={profile} />}
        {currentSection === 'settings' && (
          <SettingsSection profile={profile} onNavigate={setCurrentSection} />
        )}
        {currentSection === 'privacy' && <PrivacyPolicySection onNavigate={setCurrentSection} />}
        {currentSection === 'terms' && <TermsSection onNavigate={setCurrentSection} />}
      </main>

      {profile && <AchievementNotification profile={profile} />}
      <Footer onSectionChange={setCurrentSection} />
    </div>
  );
}

export default App;
