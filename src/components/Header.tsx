import { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Mail,
  LogOut,
  Map,
  Home,
  CalendarDays,
  Trophy,
  User,
  Award,
  Gift,
  TrendingUp,
  Settings,
  Handshake,
  ChevronDown,
  Users,
  BookOpen,
  Shield,
  FileText,
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

  const navStructure = [
    {
      type: 'direct' as const,
      id: 'feed' as Section,
      label: "Fil d'actu",
      icon: Home,
    },
    {
      type: 'direct' as const,
      id: 'sponsors' as Section,
      label: 'Sponsors',
      icon: Handshake,
    },
    {
      type: 'dropdown' as const,
      label: 'Explorer',
      icon: Map,
      items: [
        { id: 'map' as Section, label: 'Carte', icon: Map },
        { id: 'events' as Section, label: 'Événements', icon: CalendarDays },
        { id: 'challenges' as Section, label: 'Défis', icon: Trophy },
      ],
    },
    {
      type: 'dropdown' as const,
      label: 'Communauté',
      icon: Users,
      items: [
        { id: 'messages' as Section, label: 'Messages', icon: Mail },
        { id: 'leaderboard' as Section, label: 'Classement', icon: TrendingUp },
        { id: 'rewards' as Section, label: 'Store', icon: Gift },
      ],
    },
    {
      type: 'dropdown' as const,
      label: 'Profil',
      icon: User,
      items: [
        { id: 'profile' as Section, label: 'Mon profil', icon: User },
        { id: 'badges' as Section, label: 'Badges', icon: Award },
        { id: 'settings' as Section, label: 'Paramètres', icon: Settings },
      ],
    },
    {
      type: 'dropdown' as const,
      label: 'Infos',
      icon: BookOpen,
      items: [
        { id: 'privacy' as Section, label: 'Confidentialité', icon: Shield },
        { id: 'terms' as Section, label: 'Conditions', icon: FileText },
      ],
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark-800/95 border-b border-dark-700/80 backdrop-blur z-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-dark-900/60 px-3 py-1.5 border border-dark-700/80">
            <img
              src="/logo.png"
              alt="Shredloc"
              className="h-14 w-auto object-contain"
            />
            <span className="sr-only">Shredloc</span>
          </div>
        </div>

        {onSectionChange && (
          <nav className="hidden md:flex flex-1 items-center justify-center lg:justify-start gap-x-3 gap-y-2 mx-4 flex-wrap">
            {navStructure.map((item) => {
              if (item.type === 'direct') {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30'
                        : 'text-gray-300 border-dark-700/40 bg-dark-800/60 hover:text-white hover:border-orange-500/40 hover:bg-dark-700/80'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              }

              const Icon = item.icon;
              const hasActiveChild = item.items.some((child) => child.id === currentSection);

              return (
                <div key={item.label} className="relative group">
                  <button
                    type="button"
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm whitespace-nowrap ${
                      hasActiveChild
                        ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30'
                        : 'text-gray-300 border-dark-700/40 bg-dark-800/60 hover:text-white hover:border-orange-500/40 hover:bg-dark-700/80'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                    <ChevronDown size={16} className="mt-[1px]" />
                  </button>
                  <div className="absolute top-full left-0 mt-3 hidden min-w-[15rem] rounded-2xl border border-dark-700/80 bg-dark-900/95 p-2 shadow-xl group-hover:flex group-focus-within:flex flex-col">
                    {item.items.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = currentSection === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => onSectionChange(child.id)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                            isChildActive
                              ? 'bg-orange-500/20 text-white'
                              : 'text-gray-300 hover:bg-dark-700 hover:text-white'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        )}

        <div className="flex-1 max-w-xl hidden lg:block">
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
          <button
            onClick={() => onSectionChange?.('messages')}
            className={`relative p-2 rounded-full transition-colors ${
              currentSection === 'messages' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-dark-700'
            }`}
            title="Messagerie"
          >
            <Mail size={20} className={currentSection === 'messages' ? 'text-orange-400' : 'text-gray-400'} />
            {currentSection !== 'messages' && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            )}
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
