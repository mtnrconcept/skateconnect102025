import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Header from './components/Header';
import Navigation from './components/Navigation';
import MapSection from './components/sections/MapSection';
import FeedSection from './components/sections/FeedSection';
import AddSection from './components/sections/AddSection';
import ChallengesSection from './components/sections/ChallengesSection';
import ProfileSection from './components/sections/ProfileSection';
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4 animate-bounce">
            <span className="text-3xl">🛹</span>
          </div>
          <h3 className="text-white text-xl font-bold mb-2">SkateConnect</h3>
          <p className="text-slate-300">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header profile={profile} />

      <main className="pt-16 pb-20 md:pb-6">
        {currentSection === 'map' && <MapSection />}
        {currentSection === 'feed' && <FeedSection currentUser={profile} />}
        {currentSection === 'add' && <AddSection onNavigate={setCurrentSection} />}
        {currentSection === 'challenges' && <ChallengesSection />}
        {currentSection === 'profile' && <ProfileSection profile={profile} />}
      </main>

      <Navigation currentSection={currentSection} onSectionChange={setCurrentSection} />
    </div>
  );
}

export default App;
