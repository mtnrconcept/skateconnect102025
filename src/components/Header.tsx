import { useState, useEffect, useMemo, useRef } from 'react';
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  const navStructure = useMemo(
    () => [
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
    ],
    [],
  );

  const searchableNavItems = useMemo(
    () =>
      navStructure.flatMap((item) =>
        item.type === 'direct'
          ? [
              {
                id: item.id,
                label: item.label,
                icon: item.icon,
                category: 'Navigation',
              },
            ]
          : item.items.map((child) => ({
              id: child.id,
              label: child.label,
              icon: child.icon,
              category: item.label,
            })),
      ),
    [navStructure],
  );

  const filteredSearchItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return searchableNavItems;

    return searchableNavItems.filter((item) =>
      `${item.label} ${item.category}`.toLowerCase().includes(term),
    );
  }, [searchTerm, searchableNavItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownToggle = (label: string) => {
    setOpenDropdown((prev) => (prev === label ? null : label));
  };

  const handleNavigation = (section: Section) => {
    onSectionChange?.(section);
    setOpenDropdown(null);
    setShowSearchResults(false);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = filteredSearchItems[0];
    if (firstResult) {
      handleNavigation(firstResult.id);
      setSearchTerm('');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark-800/95 border-b border-dark-700/80 backdrop-blur z-40">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-dark-900/60 px-3 py-1.5 border border-dark-700/80">
            <img
              src="/logo.png"
              alt="Shredloc"
              className="h-12 w-auto object-contain"
            />
            <span className="sr-only">Shredloc</span>
          </div>
        </div>

        {onSectionChange && (
          <nav className="hidden md:flex flex-1 items-center justify-center lg:justify-start mx-4">
            <div className="flex flex-1 items-center justify-center lg:justify-start gap-2 xl:gap-3 overflow-x-auto whitespace-nowrap no-scrollbar">
              {navStructure.map((item) => {
                if (item.type === 'direct') {
                  const Icon = item.icon;
                  const isActive = currentSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigation(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm ${
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
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown((prev) => (prev === item.label ? null : prev))}
                  >
                    <button
                      type="button"
                      onClick={() => handleDropdownToggle(item.label)}
                      aria-haspopup="true"
                      aria-expanded={openDropdown === item.label}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm ${
                        hasActiveChild
                          ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30'
                          : 'text-gray-300 border-dark-700/40 bg-dark-800/60 hover:text-white hover:border-orange-500/40 hover:bg-dark-700/80'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                      <ChevronDown size={16} className="mt-[1px]" />
                    </button>
                    <div
                      className={`absolute top-full left-0 mt-3 min-w-[15rem] rounded-2xl border border-dark-700/80 bg-dark-900/95 p-2 shadow-xl flex-col ${
                        openDropdown === item.label ? 'flex' : 'hidden'
                      }`}
                    >
                      {item.items.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = currentSection === child.id;

                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => handleNavigation(child.id)}
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
            </div>
          </nav>
        )}

        <div className="flex-1 max-w-xl hidden lg:block" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="Rechercher une section..."
              className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 text-white rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
            />
            {showSearchResults && filteredSearchItems.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-dark-700/80 bg-dark-900/95 shadow-xl max-h-72 overflow-y-auto z-10">
                <div className="py-2 text-xs uppercase tracking-wide text-gray-500 px-3">Résultats</div>
                {filteredSearchItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        handleNavigation(item.id);
                        setSearchTerm('');
                      }}
                      className="w-full px-3 py-2 flex items-center gap-3 text-left text-sm text-gray-200 hover:bg-dark-700/80"
                    >
                      <Icon size={18} />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-gray-500">{item.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {showSearchResults && filteredSearchItems.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-dark-700/80 bg-dark-900/95 shadow-xl p-4 text-sm text-gray-400 z-10">
                Aucun résultat pour « {searchTerm} »
              </div>
            )}
          </form>
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
                <button
                  type="button"
                  onClick={() => handleNavigation('profile')}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-full"
                  title="Mon profil"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={getUserDisplayName(profile)}
                      className="w-9 h-9 rounded-full object-cover border-2 border-transparent hover:border-orange-500 transition-colors"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold border-2 border-orange-500">
                      {getUserInitial(profile)}
                    </div>
                  )}
                </button>
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
