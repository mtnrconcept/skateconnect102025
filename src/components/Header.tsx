import { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Mail,
  LogOut,
  Map,
  Home,
  Plus,
  Trophy,
  User,
  Award,
  Gift,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUnreadCount } from '../lib/notifications';
import { getUserInitial, getUserDisplayName } from '../lib/userUtils';
import NotificationsPanel from './NotificationsPanel';
import type { Profile, Section } from '../types';

interface HeaderProps {
  profile: Profile | null;
  currentSection?: Section;
  onSectionChange?: (section: Section) => void;
}

export default function Header({ profile, currentSection, onSectionChange }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (profile) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark-800 border-b border-dark-700 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Shredloc"
              className="h-12 w-auto object-contain m-[3px]"
            />
            <span className="sr-only">Shredloc</span>
          </div>
        </div>

        {onSectionChange && (
          <nav className="hidden md:flex items-center gap-1 mx-6">
            <button
              onClick={() => onSectionChange('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'map'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Map size={20} />
              <span>Carte</span>
            </button>
            <button
              onClick={() => onSectionChange('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'feed'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Home size={20} />
              <span>Feed</span>
            </button>
            <button
              onClick={() => onSectionChange('add')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'add'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Plus size={20} />
              <span>Ajouter</span>
            </button>
            <button
              onClick={() => onSectionChange('challenges')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'challenges'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Trophy size={20} />
              <span>Défis</span>
            </button>
            <button
              onClick={() => onSectionChange('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'profile'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <User size={20} />
              <span>Profil</span>
            </button>
            <button
              onClick={() => onSectionChange('leaderboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'leaderboard'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <TrendingUp size={20} />
              <span>Classement</span>
            </button>
            <button
              onClick={() => onSectionChange('rewards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'rewards'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Gift size={20} />
              <span>Store</span>
            </button>
            <button
              onClick={() => onSectionChange('badges')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'badges'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Award size={20} />
              <span>Badges</span>
            </button>
            <button
              onClick={() => onSectionChange('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'settings'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Settings size={20} />
              <span>Paramètres</span>
            </button>
          </nav>
        )}

        <div className="flex-1 max-w-xl mx-4 hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Find news..."
              className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 text-white rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSectionChange?.('settings')}
            className="relative p-2 hover:bg-dark-700 rounded-full transition-colors"
            title="Paramètres"
          >
            <Settings size={20} className="text-gray-400" />
          </button>
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 hover:bg-dark-700 rounded-full transition-colors"
          >
            <Bell size={20} className="text-gray-400" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-orange-500 rounded-full text-white text-xs flex items-center justify-center font-semibold px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button className="relative p-2 hover:bg-dark-700 rounded-full transition-colors">
            <Mail size={20} className="text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
          </button>
          <div className="h-6 w-px bg-dark-700 mx-2"></div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden sm:flex items-center gap-2">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={getUserDisplayName(profile)}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold border-2 border-orange-500">
                    {getUserInitial(profile)}
                  </div>
                )}
                <span className="font-medium text-white">{getUserDisplayName(profile)}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-dark-700 rounded-full transition-colors text-orange-500"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {showNotifications && (
        <NotificationsPanel
          onClose={() => {
            setShowNotifications(false);
            loadUnreadCount();
          }}
        />
      )}
    </header>
  );
}
