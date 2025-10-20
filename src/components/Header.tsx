import { useState, useEffect } from 'react';
import { Search, Bell, Mail, LogOut, Map, Home, Plus, Trophy, User } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛹</span>
            <span className="font-bold text-xl hidden sm:inline">SkateConnect</span>
          </div>
        </div>

        {onSectionChange && (
          <nav className="hidden md:flex items-center gap-1 mx-6">
            <button
              onClick={() => onSectionChange('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'map'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Map size={20} />
              <span>Carte</span>
            </button>
            <button
              onClick={() => onSectionChange('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'feed'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Home size={20} />
              <span>Feed</span>
            </button>
            <button
              onClick={() => onSectionChange('add')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'add'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Plus size={20} />
              <span>Ajouter</span>
            </button>
            <button
              onClick={() => onSectionChange('challenges')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'challenges'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Trophy size={20} />
              <span>Défis</span>
            </button>
            <button
              onClick={() => onSectionChange('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                currentSection === 'profile'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User size={20} />
              <span>Profil</span>
            </button>
          </nav>
        )}

        <div className="flex-1 max-w-xl mx-4 hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher spots, skaters, événements..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell size={20} className="text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-semibold px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button className="relative p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Mail size={20} className="text-slate-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          </button>
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                    {getUserInitial(profile)}
                  </div>
                )}
                <span className="font-medium text-slate-700">{getUserDisplayName(profile)}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-600"
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
