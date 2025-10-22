import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Bell,
  Mail,
  LogOut,
  Settings,
  CalendarDays,
  Trophy,
  MapPin,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUnreadCount } from '../lib/notifications';
import { getUserInitial, getUserDisplayName } from '../lib/userUtils';
import NotificationsPanel from './NotificationsPanel';
import { primaryNavigationItems, searchableNavigationItems } from '../data/navigation';
import { eventsCatalog } from '../data/eventsCatalog';
import { createFallbackChallenges, createFallbackDailyChallenges } from '../data/challengesCatalog';
import { settingsCategories, quickSettingsLinks } from '../data/settingsCatalog';
import type { Profile, Section, ContentNavigationOptions } from '../types';
import type { LucideIcon } from 'lucide-react';

interface HeaderProps {
  profile: Profile | null;
  currentSection?: Section;
  onSectionChange?: (section: Section) => void;
  onNavigateToContent?: (section: Section, options?: ContentNavigationOptions) => void;
  onSearchFocusChange?: (isActive: boolean) => void;
}

interface SearchResult {
  key: string;
  label: string;
  category: string;
  description?: string;
  section?: Section;
  icon?: LucideIcon;
  options?: ContentNavigationOptions;
  onSelect?: () => void;
}

export default function Header({
  profile,
  currentSection,
  onSectionChange,
  onNavigateToContent,
  onSearchFocusChange,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isSearchActive = isInputFocused || showSearchResults;

  const sortResults = (results: SearchResult[]) =>
    [...results].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

  const mergeResults = (existing: SearchResult[], additions: SearchResult[]) => {
    const existingKeys = new Set(existing.map((item) => item.key));
    const uniqueAdditions = additions.filter((item) => !existingKeys.has(item.key));
    return sortResults([...existing, ...uniqueAdditions]);
  };

  useEffect(() => {
    onSearchFocusChange?.(isSearchActive);
  }, [isSearchActive, onSearchFocusChange]);

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

  const getSpotTypeLabel = (type?: string | null) => {
    switch (type) {
      case 'street':
        return 'Spot street';
      case 'skatepark':
        return 'Skatepark';
      case 'bowl':
        return 'Bowl';
      case 'diy':
        return 'Spot DIY';
      case 'transition':
        return 'Spot transition';
      default:
        return 'Spot';
    }
  };

  useEffect(() => {
    const navigationResults: SearchResult[] = searchableNavigationItems.map((item) => ({
      key: `nav-${item.id}`,
      label: item.label,
      category: item.category,
      description: `Aller à ${item.label}`,
      section: item.id,
      icon: item.icon,
    }));

    const eventResults: SearchResult[] = eventsCatalog.map((event) => ({
      key: `event-${event.id}`,
      label: event.title,
      category: 'Événements',
      description: event.location,
      section: 'events',
      icon: CalendarDays,
      options: { scrollToId: `event-${event.id}` },
    }));

    const fallbackChallengeResults: SearchResult[] = createFallbackChallenges().map((challenge) => ({
      key: `fallback-challenge-${challenge.id}`,
      label: challenge.title,
      category: 'Défis',
      description: challenge.description,
      section: 'challenges',
      icon: Trophy,
      options: {
        scrollToId: `challenge-${challenge.id}`,
        challengeTab: 'community',
      },
    }));

    const fallbackDailyResults: SearchResult[] = createFallbackDailyChallenges().map((challenge) => ({
      key: `fallback-daily-${challenge.id}`,
      label: challenge.title,
      category: 'Défis quotidiens',
      description: challenge.description,
      section: 'challenges',
      icon: Trophy,
      options: {
        scrollToId: `daily-challenge-${challenge.id}`,
        challengeTab: 'daily',
      },
    }));

    const settingsResults: SearchResult[] = settingsCategories.flatMap((category) =>
      category.items.map((item) => ({
        key: `setting-${item.id}`,
        label: item.title,
        category: `Paramètres · ${category.title}`,
        description: item.description,
        section: 'settings',
        icon: item.icon as LucideIcon,
        options: { scrollToId: `setting-${item.id}` },
      })),
    );

    const quickLinkResults: SearchResult[] = quickSettingsLinks.map((link) => ({
      key: `quick-${link.id}`,
      label: link.title,
      category: 'Documentation',
      description: link.description,
      section: link.id === 'privacy' ? 'privacy' : 'terms',
      icon: link.icon as LucideIcon,
    }));

    const initialResults = sortResults([
      ...navigationResults,
      ...eventResults,
      ...fallbackChallengeResults,
      ...fallbackDailyResults,
      ...settingsResults,
      ...quickLinkResults,
    ]);

    setSearchIndex(initialResults);

    const loadDynamicResults = async () => {
      const dynamicResults: SearchResult[] = [];

      try {
        const { data: spots } = await supabase
          .from('spots')
          .select('id, name, address, spot_type')
          .limit(50);

        if (spots) {
          dynamicResults.push(
            ...spots
              .filter((spot) => Boolean(spot.id) && Boolean(spot.name))
              .map((spot) => ({
                key: `spot-${spot.id}`,
                label: spot.name!,
                category: 'Spots',
                description: spot.address || getSpotTypeLabel(spot.spot_type),
                section: 'map',
                icon: MapPin,
                options: { spotId: spot.id },
              })),
          );
        }
      } catch (error) {
        console.error('Error loading spots for search:', error);
      }

      try {
        const { data: challengesData } = await supabase
          .from('challenges')
          .select('id, title, description, challenge_type')
          .limit(50);

        if (challengesData) {
          dynamicResults.push(
            ...challengesData
              .filter((challenge) => Boolean(challenge.id) && Boolean(challenge.title))
              .map((challenge) => ({
                key: `challenge-${challenge.id}`,
                label: challenge.title!,
                category: 'Défis',
                description: challenge.description ?? undefined,
                section: 'challenges',
                icon: Trophy,
                options: {
                  scrollToId: `challenge-${challenge.id}`,
                  challengeTab: 'community',
                },
              })),
          );
        }
      } catch (error) {
        console.error('Error loading challenges for search:', error);
      }

      try {
        const { data: dailyData } = await supabase
          .from('daily_challenges')
          .select('id, title, description, challenge_type')
          .limit(50);

        if (dailyData) {
          dynamicResults.push(
            ...dailyData
              .filter((challenge) => Boolean(challenge.id) && Boolean(challenge.title))
              .map((challenge) => ({
                key: `daily-${challenge.id}`,
                label: challenge.title!,
                category: 'Défis quotidiens',
                description: challenge.description ?? undefined,
                section: 'challenges',
                icon: Trophy,
                options: {
                  scrollToId: `daily-challenge-${challenge.id}`,
                  challengeTab: 'daily',
                },
              })),
          );
        }
      } catch (error) {
        console.error('Error loading daily challenges for search:', error);
      }

      try {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .limit(50);

        if (profilesData) {
          dynamicResults.push(
            ...profilesData
              .filter((person) => Boolean(person.id))
              .map((person) => ({
                key: `profile-${person.id}`,
                label: person.display_name || person.username || 'Rider',
                category: 'Riders',
                description: person.username ?? undefined,
                section: 'leaderboard',
                icon: UserIcon,
              })),
          );
        }
      } catch (error) {
        console.error('Error loading riders for search:', error);
      }

      setSearchIndex((previous) => mergeResults(previous, dynamicResults));
    };

    loadDynamicResults();
  }, []);

  const filteredResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return searchIndex.slice(0, 20);
    }

    return searchIndex
      .filter((item) => {
        const haystack = `${item.label} ${item.description ?? ''} ${item.category}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 20);
  }, [searchIndex, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
        setIsInputFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeSearch = () => {
    setShowSearchResults(false);
    setIsInputFocused(false);
  };

  const navigateToSection = (section: Section, options?: ContentNavigationOptions) => {
    if (onNavigateToContent) {
      onNavigateToContent(section, options);
    } else {
      onSectionChange?.(section);
    }
    setSearchTerm('');
    closeSearch();
  };

  const handleResultSelect = (result: SearchResult) => {
    if (result.onSelect) {
      result.onSelect();
      setSearchTerm('');
      closeSearch();
      return;
    }

    if (result.section) {
      navigateToSection(result.section, result.options);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = filteredResults[0];
    if (firstResult) {
      handleResultSelect(firstResult);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark-800/95 border-b border-dark-700/80 backdrop-blur z-40">
      {/* PASSAGE EN GRID POUR MAÎTRISER LES LARGEURS */}
      <div className="w-full px-4 lg:px-8 py-4 grid grid-cols-[auto,1fr,auto] items-center gap-3 xl:gap-6">
        {/* LOGO */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl bg-dark-900/60 px-4 py-2 border border-dark-700/80">
            <img
              src="/logo.png"
              alt="Shredloc"
              className="h-14 w-auto object-contain"
            />
            <span className="sr-only">Shredloc</span>
          </div>
        </div>

        {/* NAV – LAISSE SCROLLER, PAS DE MIN WIDTH RIGIDE */}
        {onSectionChange && (
          <nav className="hidden md:flex items-center min-w-0">
            <div className="flex items-center gap-2 xl:gap-3 overflow-x-auto whitespace-nowrap no-scrollbar w-full">
              {primaryNavigationItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                const isLast = index === primaryNavigationItems.length - 1;

                if (isLast) {
                  return (
                    <Fragment key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSectionChange?.('settings')}
                        className="relative p-2 hover:bg-dark-700 rounded-full transition-colors shrink-0"
                        title="Paramètres"
                      >
                        <Settings size={20} className="text-gray-400" />
                      </button>

                      <div
                        className={`hidden lg:flex items-center min-w-0 transition-all duration-300 ease-out flex-shrink-0 lg:min-w-[260px] lg:max-w-lg ${
                          isSearchActive ? 'scale-[1.02] drop-shadow-xl' : ''
                        }`}
                        ref={searchContainerRef}
                      >
                        <form onSubmit={handleSearchSubmit} className="relative w-full">
                          <Search
                            className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                              isSearchActive ? 'text-orange-400' : 'text-gray-500'
                            }`}
                            size={20}
                          />
                          <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => {
                              setSearchTerm(event.target.value);
                              setShowSearchResults(true);
                            }}
                            onFocus={() => {
                              setShowSearchResults(true);
                              setIsInputFocused(true);
                            }}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setIsInputFocused(false);
                              }, 120);
                            }}
                            placeholder="Rechercher un rider, un défi, un spot..."
                            className={`w-full pr-4 bg-dark-700/90 border border-dark-600 text-white rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 transition-all duration-300 ${
                              isSearchActive ? 'pl-12 py-3 shadow-lg shadow-orange-500/10' : 'pl-10 py-2'
                            }`}
                          />
                          {showSearchResults && filteredResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-dark-700/80 bg-dark-900/95 shadow-xl max-h-80 overflow-y-auto z-50">
                              <div className="py-2 text-xs uppercase tracking-wide text-gray-500 px-3">
                                {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''}
                              </div>
                              {filteredResults.map((result) => {
                                const IconResult = result.icon ?? Search;
                                return (
                                  <button
                                    key={result.key}
                                    type="button"
                                    onClick={() => handleResultSelect(result)}
                                    className="w-full px-3 py-2 flex items-center gap-3 text-left text-sm text-gray-200 hover:bg-dark-700/80 transition-colors"
                                  >
                                    <span className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center text-orange-400">
                                      <IconResult size={18} />
                                    </span>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-white">{result.label}</span>
                                      <span className="text-xs text-gray-500">
                                        {result.category}
                                        {result.description ? ` • ${result.description}` : ''}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {showSearchResults && filteredResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-dark-700/80 bg-dark-900/95 shadow-xl p-4 text-sm text-gray-400 z-50">
                              Aucun résultat pour « {searchTerm} »
                            </div>
                          )}
                        </form>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateToSection(item.id)}
                        className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm ${
                          isActive
                            ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30'
                            : 'text-gray-300 border-dark-700/40 bg-dark-800/60 hover:text-white hover:border-orange-500/40 hover:bg-dark-700/80'
                        }`}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </button>
                    </Fragment>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToSection(item.id)}
                    className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-full transition-all font-medium border shadow-sm ${
                      isActive
                        ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30'
                        : 'text-gray-300 border-dark-700/40 bg-dark-800/60 hover:text-white hover:border-orange-500/40 hover:bg-dark-700/80'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* ACTIONS */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
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
                  onClick={() => navigateToSection('profile')}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-full"
                  title="Mon profil"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={getUserDisplayName(profile)}
                      className="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-orange-500 transition-colors"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold border-2 border-orange-500">
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
