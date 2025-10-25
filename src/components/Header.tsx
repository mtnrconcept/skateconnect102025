import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Hash,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { getUnreadCount } from '../lib/notifications';
import { getUserInitial, getUserDisplayName } from '../lib/userUtils';
import NotificationsPanel from './NotificationsPanel';
import { primaryNavigationItems, searchableNavigationItems } from '../data/navigation';
import { eventsCatalog } from '../data/eventsCatalog';
import { createFallbackChallenges, createFallbackDailyChallenges } from '../data/challengesCatalog';
import { settingsCategories, quickSettingsLinks } from '../data/settingsCatalog';
import type { Profile, Section, ContentNavigationOptions } from '../types';
import type { LucideIcon } from 'lucide-react';
import {
  searchContent,
  tokenizeSearchQuery,
  buildHighlightSegments,
  normalizeSearchValue,
  type SearchContentType,
  type SearchResultItem,
} from '../lib/search';
import { useRouter } from '../lib/router';

interface HeaderProps {
  profile: Profile | null;
  currentSection?: Section;
  onSectionChange?: (section: Section) => boolean | void;
  onNavigateToContent?: (section: Section, options?: ContentNavigationOptions) => boolean | void;
  onSearchFocusChange?: (isActive: boolean) => void;
  onSearchSubmit?: (query: string, results: GlobalSearchResult[]) => void;
}

type HeaderSearchResult = GlobalSearchResult & { onSelect?: () => void };

const dynamicCategoryMap: Record<SearchContentType, { label: string; icon: LucideIcon }> = {
  riders: { label: 'Riders', icon: UserIcon },
  spots: { label: 'Spots', icon: MapPin },
  challenges: { label: 'Défis', icon: Trophy },
  hashtags: { label: 'Hashtags', icon: Hash },
};

export default function Header({
  profile,
  currentSection,
  onSectionChange,
  onNavigateToContent,
  onSearchFocusChange,
  onSearchSubmit,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [dynamicResults, setDynamicResults] = useState<SearchResult[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isSearchActive = isInputFocused || showSearchResults;
  const { navigate } = useRouter();
  const trimmedSearchTerm = searchTerm.trim();
  const hasSearchTerm = trimmedSearchTerm.length > 0;

  const sortResults = (results: HeaderSearchResult[]) =>
    [...results].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

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

  const staticResults = useMemo<SearchResult[]>(() => {
    const navigationResults: SearchResult[] = searchableNavigationItems.map((item) => ({
      key: `nav-${item.id}`,
      label: item.label,
      category: item.category,
      description: `Aller à ${item.label}`,
      section: item.id,
      icon: item.icon,
    }));

    const eventResults: HeaderSearchResult[] = eventsCatalog.map((event) => ({
      key: `event-${event.id}`,
      label: event.title,
      category: 'Événements',
      description: event.location,
      section: 'events',
      icon: CalendarDays,
      options: { scrollToId: `event-${event.id}` },
    }));

    const fallbackChallengeResults: HeaderSearchResult[] = createFallbackChallenges().map((challenge) => ({
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

    const fallbackDailyResults: HeaderSearchResult[] = createFallbackDailyChallenges().map((challenge) => ({
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

    const settingsResults: HeaderSearchResult[] = settingsCategories.flatMap((category) =>
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

    const quickLinkResults: HeaderSearchResult[] = quickSettingsLinks.map((link) => ({
      key: `quick-${link.id}`,
      label: link.title,
      category: 'Documentation',
      description: link.description,
      section: link.id === 'privacy' ? 'privacy' : 'terms',
      icon: link.icon as LucideIcon,
    }));

    return sortResults([
      ...navigationResults,
      ...eventResults,
      ...fallbackChallengeResults,
      ...fallbackDailyResults,
      ...settingsResults,
      ...quickLinkResults,
    ]);
  }, []);

  const mapSearchItemToResult = useCallback((item: SearchResultItem): SearchResult => {
    const meta = dynamicCategoryMap[item.category];
    const descriptionParts: string[] = [];
    if (item.description) {
      descriptionParts.push(item.description);
    }
    if (item.metadata) {
      descriptionParts.push(item.metadata);
    }
    if (item.location) {
      descriptionParts.push(item.location);
    }

    return {
      key: `dynamic-${item.category}-${item.id}`,
      label: item.title,
      category: meta?.label ?? 'Résultats',
      description: descriptionParts.join(' • ') || undefined,
      section: item.section,
      icon: meta?.icon,
      options: item.options,
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const timeout = window.setTimeout(() => {
      searchContent({
        query: trimmedSearchTerm,
        pageSize: 25,
        sortBy: trimmedSearchTerm ? 'relevance' : 'alphabetical',
      })
        .then((response) => {
          if (isCancelled) {
            return;
          }
          setDynamicResults(response.items.map(mapSearchItemToResult));
        })
        .catch((error) => {
          console.error('Error loading dynamic search results:', error);
          if (!isCancelled) {
            setDynamicResults([]);
          }
        });
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mapSearchItemToResult, trimmedSearchTerm]);

  const combinedResults = useMemo(() => {
    const seen = new Set<string>();
    const items: SearchResult[] = [];

    const append = (source: SearchResult[]) => {
      source.forEach((item) => {
        if (seen.has(item.key)) {
          return;
        }
        seen.add(item.key);
        items.push(item);
      });
    };

    if (trimmedSearchTerm) {
      append(dynamicResults);
      append(staticResults);
      return items;
    }

    append(staticResults);
    append(dynamicResults);
    return sortResults(items);
  }, [dynamicResults, staticResults, trimmedSearchTerm]);

  const highlightTokens = useMemo(() => tokenizeSearchQuery(searchTerm), [searchTerm]);
  const normalizedHighlightTokens = useMemo(
    () => highlightTokens.map((token) => normalizeSearchValue(token)),
    [highlightTokens],
  );

  const filteredResults = useMemo(() => {
    if (normalizedHighlightTokens.length === 0) {
      return combinedResults.slice(0, 20);
    }

    return combinedResults
      .filter((item) => {
        const haystack = normalizeSearchValue(`${item.label} ${item.description ?? ''} ${item.category}`);
        return normalizedHighlightTokens.every((token) => haystack.includes(token));
      })
      .slice(0, 20);
  }, [combinedResults, normalizedHighlightTokens]);

  const displayedResults = useMemo(() => filteredResults.slice(0, 20), [filteredResults]);

  useEffect(() => {
    if (hasSearchTerm) {
      setShowSearchResults(true);
    }
  }, [hasSearchTerm]);

  const renderHighlightedText = useCallback(
    (text: string) => {
      const segments = buildHighlightSegments(text, highlightTokens);
      return segments.map((segment, index) =>
        segment.isMatch ? (
          <span key={`${segment.text}-${index}`} className="text-orange-400">
            {segment.text}
          </span>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      );
    },
    [highlightTokens],
  );

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
    let navigationResult: boolean | void = undefined;
    if (onNavigateToContent) {
      navigationResult = onNavigateToContent(section, options);
    } else {
      navigationResult = onSectionChange?.(section);
    }

    if (navigationResult === false) {
      return;
    }

    setSearchTerm('');
    closeSearch();
  };

  const handleResultSelect = (result: HeaderSearchResult) => {
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

  const handleViewMore = useCallback(() => {
    const trimmed = searchTerm.trim();
    const params = new URLSearchParams();
    if (trimmed.length > 0) {
      params.set('query', trimmed);
    }

    const searchString = params.toString();
    const targetPath = searchString.length > 0 ? `/search?${searchString}` : '/search';
    navigate(targetPath);
    setSearchTerm('');
    closeSearch();
  }, [navigate, searchTerm]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleViewMore();
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-dark-700/80 bg-[#0e0e12]/95 backdrop-blur">
      <div className="grid w-full grid-cols-[auto,1fr,auto] items-center gap-4 px-4 py-3 lg:gap-6 lg:px-8">
        <div className="shrink-0">
          <div className="flex items-center gap-3 rounded-2xl border border-dark-700/80 bg-[#121219]/90 px-4 py-2">
            <img src="/logo2.png" className="neon-logo h-12 w-auto object-contain" />
          </div>
        </div>

        {onSectionChange && (
          <nav className="hidden min-w-0 md:flex items-center">
            <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar xl:gap-3">
              <div className="flex shrink-0 items-center gap-2 xl:gap-3">
                {primaryNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateToSection(item.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all shadow-sm ${
                        isActive
                          ? 'border-orange-400 bg-orange-500 text-white shadow-orange-500/30'
                          : 'border-dark-700/50 bg-[#181821] text-gray-300 hover:border-orange-500/50 hover:bg-[#1f1f29] hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                ref={searchContainerRef}
                className="hidden min-w-[260px] flex-1 items-center justify-end lg:flex"
              >
                <form
                  onSubmit={handleSearchSubmit}
                  className={`relative w-full transition-[max-width] duration-300 ease-out ${
                    isSearchActive ? 'max-w-[420px]' : 'max-w-[360px]'
                  }`}
                >
                  <Search
                    className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      isSearchActive ? 'text-orange-400' : 'text-gray-500'
                    }`}
                    size={20}
                  />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSearchTerm(value);
                      setShowSearchResults(value.trim().length > 0);
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
                    className={`w-full rounded-full border border-dark-600 bg-[#1f1f29]/95 pr-4 text-sm text-white placeholder-gray-500 transition-all duration-300 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20 ${
                      isSearchActive ? 'pl-14 py-3 shadow-lg shadow-orange-500/15' : 'pl-12 py-2.5'
                    }`}
                  />
                  {showSearchResults && filteredResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-dark-700/80 bg-[#121219]/95 shadow-xl">
                      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500">
                        {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''}
                      </div>
                      {displayedResults.map((result) => {
                        const IconResult = result.icon ?? Search;
                        return (
                          <button
                            key={result.key}
                            type="button"
                            onClick={() => handleResultSelect(result)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-dark-700/80"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f29] text-orange-400">
                              <IconResult size={18} />
                            </span>
                            <div className="flex flex-col">
                              <span className="font-medium text-white">{renderHighlightedText(result.label)}</span>
                              <span className="text-xs text-gray-500">
                                {renderHighlightedText(result.description ? `${result.category} • ${result.description}` : result.category)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      {hasSearchTerm && (
                        <div className="border-t border-dark-700/80 bg-[#101018] px-3 py-2">
                          <button
                            type="button"
                            onClick={handleViewMore}
                            className="w-full rounded-xl bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20"
                          >
                            Voir plus de résultats
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {showSearchResults && filteredResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-dark-700/80 bg-[#121219]/95 p-4 text-sm text-gray-400 shadow-xl">
                      Aucun résultat pour « {searchTerm} »
                    </div>
                  )}
                </form>
              </div>

              <button
                type="button"
                onClick={() => navigateToSection('settings')}
                className="relative shrink-0 rounded-full p-2 transition-colors hover:bg-[#1f1f29]"
                title="Paramètres"
              >
                <Settings size={20} className="text-gray-400" />
              </button>
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
            onClick={() => navigateToSection('messages')}
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

      {showNotifications &&
        createPortal(
          <NotificationsPanel
            onClose={() => {
              setShowNotifications(false);
              loadUnreadCount();
            }}
          />,
          document.body,
        )}
    </header>
  );
}
