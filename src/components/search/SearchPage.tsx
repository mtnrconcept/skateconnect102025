import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Trophy,
  Hash,
  User as UserIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  searchContent,
  tokenizeSearchQuery,
  buildHighlightSegments,
  type SearchContentType,
  type SearchSort,
} from '../../lib/search';
import type { SearchResultItem } from '../../lib/search';
import type { SubscriptionPlan } from '../../lib/subscription';
import {
  subscriptionPlans,
  getPlanLabel,
  isSubscriptionPlan,
  canAccessSection,
} from '../../lib/subscription';
import type { ContentNavigationOptions, Section } from '../../types';
import { useRouter } from '../../lib/router';

interface SearchPageProps {
  onNavigateToContent: (section: Section, options?: ContentNavigationOptions) => void;
  currentPlan: SubscriptionPlan;
}

const ALL_CONTENT_TYPES: SearchContentType[] = ['riders', 'spots', 'challenges', 'hashtags'];

const isSearchContentType = (value: string): value is SearchContentType =>
  (ALL_CONTENT_TYPES as string[]).includes(value);

const isSearchSort = (value: string | null): value is SearchSort =>
  value === 'relevance' || value === 'alphabetical' || value === 'recent';

const categoryDetails: Record<
  SearchContentType,
  {
    label: string;
    description: string;
    icon: typeof UserIcon;
  }
> = {
  riders: { label: 'Riders', description: 'Profils riders & créateurs', icon: UserIcon },
  spots: { label: 'Spots', description: 'Lieux et cartes', icon: MapPin },
  challenges: { label: 'Défis', description: 'Challenges sponsorisés', icon: Trophy },
  hashtags: { label: 'Hashtags', description: 'Tendances communautaires', icon: Hash },
};

const sortOptions: Array<{ value: SearchSort; label: string }> = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'alphabetical', label: 'Alphabétique' },
  { value: 'recent', label: 'Récents' },
];

const normalizeContentTypes = (types: SearchContentType[]): SearchContentType[] =>
  types.length ? Array.from(new Set(types)) : [...ALL_CONTENT_TYPES];

const arraysAreEqual = <T,>(a: T[], b: T[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const parseSearchState = (search: string) => {
  const params = new URLSearchParams(search ?? '');
  const query = params.get('query') ?? '';

  const typeParam = params.get('type');
  let contentTypes = [...ALL_CONTENT_TYPES];
  if (typeParam) {
    const parsed = typeParam
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && isSearchContentType(value));
    if (parsed.length > 0) {
      contentTypes = parsed as SearchContentType[];
    }
  }

  const location = params.get('location') ?? '';

  const planParam = params.get('plan');
  const plans = planParam
    ? planParam
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is SubscriptionPlan => isSubscriptionPlan(value))
    : [];

  const pageParam = params.get('page');
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const sortParam = params.get('sort');
  const sort: SearchSort = isSearchSort(sortParam) ? sortParam : 'relevance';

  return {
    query,
    contentTypes,
    location,
    plans,
    page,
    sort,
  };
};

const buildResultDescription = (item: SearchResultItem) => {
  const parts: string[] = [];
  if (item.description) {
    parts.push(item.description);
  }
  if (item.metadata) {
    parts.push(item.metadata);
  }
  if (item.location && !parts.includes(item.location)) {
    parts.push(item.location);
  }
  return parts.join(' • ');
};

type SearchResponse = Awaited<ReturnType<typeof searchContent>>;

export default function SearchPage({ onNavigateToContent, currentPlan }: SearchPageProps) {
  const { location, navigate } = useRouter();

  const initialState = useMemo(() => parseSearchState(location.search), [location.search]);

  const [inputValue, setInputValue] = useState(initialState.query);
  const [query, setQuery] = useState(initialState.query);
  const [selectedTypes, setSelectedTypes] = useState<SearchContentType[]>(
    normalizeContentTypes(initialState.contentTypes),
  );
  const [locationFilter, setLocationFilter] = useState(initialState.location);
  const [locationDraft, setLocationDraft] = useState(initialState.location);
  const [selectedPlans, setSelectedPlans] = useState<SubscriptionPlan[]>(initialState.plans);
  const [sortBy, setSortBy] = useState<SearchSort>(initialState.sort);
  const [page, setPage] = useState<number>(initialState.page);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);

  useEffect(() => {
    const nextState = parseSearchState(location.search);

    setInputValue((current) => (current === nextState.query ? current : nextState.query));
    setQuery((current) => (current === nextState.query ? current : nextState.query));

    setSelectedTypes((current) =>
      arraysAreEqual(current, normalizeContentTypes(nextState.contentTypes))
        ? current
        : normalizeContentTypes(nextState.contentTypes),
    );

    setLocationFilter((current) => (current === nextState.location ? current : nextState.location));
    setLocationDraft((current) => (current === nextState.location ? current : nextState.location));

    setSelectedPlans((current) => {
      const normalized = [...nextState.plans];
      return arraysAreEqual(current, normalized) ? current : normalized;
    });

    setSortBy((current) => (current === nextState.sort ? current : nextState.sort));
    setPage((current) => (current === nextState.page ? current : nextState.page));
  }, [location.search]);

  const syncParams = useCallback(
    (state: {
      query: string;
      contentTypes: SearchContentType[];
      location: string;
      plans: SubscriptionPlan[];
      page: number;
      sort: SearchSort;
    }) => {
      const params = new URLSearchParams();
      const trimmedQuery = state.query.trim();
      if (trimmedQuery.length > 0) {
        params.set('query', trimmedQuery);
      }

      const normalizedTypes = normalizeContentTypes(state.contentTypes);
      if (normalizedTypes.length && normalizedTypes.length < ALL_CONTENT_TYPES.length) {
        params.set('type', normalizedTypes.join(','));
      }

      const trimmedLocation = state.location.trim();
      if (trimmedLocation.length > 0) {
        params.set('location', trimmedLocation);
      }

      if (state.plans.length > 0) {
        params.set('plan', state.plans.join(','));
      }

      if (state.page > 1) {
        params.set('page', String(state.page));
      }

      if (state.sort !== 'relevance') {
        params.set('sort', state.sort);
      }

      const searchString = params.toString();
      const targetPath = searchString.length > 0 ? `/search?${searchString}` : '/search';
      navigate(targetPath, { replace: false });
    },
    [navigate],
  );

  useEffect(() => {
    let isCancelled = false;
    const activeTypes = normalizeContentTypes(selectedTypes);

    setLoading(true);
    setError(null);

    searchContent({
      query,
      contentTypes: activeTypes,
      location: locationFilter,
      subscriptionPlans: selectedPlans,
      page,
      pageSize: 20,
      sortBy,
    })
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setResults(response);
      })
      .catch((searchError) => {
        console.error('Search error:', searchError);
        if (!isCancelled) {
          setError("Impossible de charger les résultats de recherche.");
          setResults(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [query, selectedTypes, locationFilter, selectedPlans, page, sortBy]);

  const highlightTokens = useMemo(() => tokenizeSearchQuery(query), [query]);

  const renderHighlightedText = useCallback(
    (value?: string) => {
      if (!value) {
        return null;
      }
      const segments = buildHighlightSegments(value, highlightTokens);
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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    setPage(1);
    syncParams({
      query: trimmed,
      contentTypes: selectedTypes,
      location: locationFilter,
      plans: selectedPlans,
      page: 1,
      sort: sortBy,
    });
  };

  const handleResetFilters = () => {
    setInputValue('');
    setQuery('');
    setSelectedTypes([...ALL_CONTENT_TYPES]);
    setLocationFilter('');
    setLocationDraft('');
    setSelectedPlans([]);
    setSortBy('relevance');
    setPage(1);
    syncParams({
      query: '',
      contentTypes: [...ALL_CONTENT_TYPES],
      location: '',
      plans: [],
      page: 1,
      sort: 'relevance',
    });
  };

  const handleToggleContentType = (type: SearchContentType) => {
    setSelectedTypes((previous) => {
      let next = previous.includes(type)
        ? previous.filter((value) => value !== type)
        : [...previous, type];
      next = normalizeContentTypes(next);
      const normalizedNext = [...next];
      setPage(1);
      syncParams({
        query,
        contentTypes: normalizedNext,
        location: locationFilter,
        plans: selectedPlans,
        page: 1,
        sort: sortBy,
      });
      return normalizedNext;
    });
  };

  const handleTogglePlan = (plan: SubscriptionPlan) => {
    setSelectedPlans((previous) => {
      const exists = previous.includes(plan);
      const next = exists ? previous.filter((value) => value !== plan) : [...previous, plan];
      const normalized = [...next];
      setPage(1);
      syncParams({
        query,
        contentTypes: selectedTypes,
        location: locationFilter,
        plans: normalized,
        page: 1,
        sort: sortBy,
      });
      return normalized;
    });
  };

  const applyLocationFilter = useCallback(
    (value: string) => {
      setLocationFilter(value);
      setPage(1);
      syncParams({
        query,
        contentTypes: selectedTypes,
        location: value,
        plans: selectedPlans,
        page: 1,
        sort: sortBy,
      });
    },
    [query, selectedTypes, selectedPlans, sortBy, syncParams],
  );

  const handleLocationInputBlur = () => {
    if (locationDraft !== locationFilter) {
      applyLocationFilter(locationDraft);
    }
  };

  const handleSortChange = (value: SearchSort) => {
    setSortBy(value);
    setPage(1);
    syncParams({
      query,
      contentTypes: selectedTypes,
      location: locationFilter,
      plans: selectedPlans,
      page: 1,
      sort: value,
    });
  };

  const handlePreviousPage = () => {
    if (page <= 1) {
      return;
    }
    const nextPage = page - 1;
    setPage(nextPage);
    syncParams({
      query,
      contentTypes: selectedTypes,
      location: locationFilter,
      plans: selectedPlans,
      page: nextPage,
      sort: sortBy,
    });
  };

  const handleNextPage = () => {
    if (!results?.hasMore) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    syncParams({
      query,
      contentTypes: selectedTypes,
      location: locationFilter,
      plans: selectedPlans,
      page: nextPage,
      sort: sortBy,
    });
  };

  const totalsByType = results?.totalsByType ?? {
    riders: 0,
    spots: 0,
    challenges: 0,
    hashtags: 0,
  };

  const totalResults = results?.total ?? 0;

  const handleNavigate = (item: SearchResultItem) => {
    onNavigateToContent(item.section, item.options);
  };

  const currentResults = results?.items ?? [];

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-24 pt-20 text-white lg:pt-24">
      <header className="flex flex-col gap-6 rounded-3xl border border-dark-700/70 bg-[#121219]/80 p-6 shadow-lg shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-wide text-orange-400">Recherche avancée</p>
          <h1 className="text-3xl font-semibold">Explore toute la communauté</h1>
          <p className="max-w-2xl text-sm text-gray-400">
            Riders, spots, défis, hashtags : filtre par type de contenu, localisation ou plan d&apos;abonnement pour trouver la bonne info en quelques secondes.
          </p>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Rechercher un rider, un spot, un défi, un hashtag..."
            className="w-full rounded-full border border-dark-600 bg-[#1a1a24]/95 py-3 pl-12 pr-4 text-sm text-white transition-all focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {inputValue && (
              <button
                type="button"
                className="rounded-full p-1 text-gray-500 transition hover:bg-dark-700 hover:text-gray-300"
                onClick={() => setInputValue('')}
                title="Effacer la recherche"
              >
                <XCircle size={18} />
              </button>
            )}
            <button
              type="submit"
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              Rechercher
            </button>
          </div>
        </form>
      </header>

      <div className="grid gap-6 rounded-3xl border border-dark-700/70 bg-[#121219]/80 p-6 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span className="flex items-center gap-2 rounded-full border border-dark-600 bg-[#1a1a24] px-4 py-2 text-xs uppercase tracking-wide text-orange-300">
              <Filter size={14} /> Filtres intelligents
            </span>
            <span className="text-gray-400">{totalResults} résultat{totalResults > 1 ? 's' : ''}</span>
            {loading && (
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Mise à jour...
              </span>
            )}
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSortChange(option.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  sortBy === option.value
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                    : 'border border-dark-600 bg-[#1a1a24] text-gray-300 hover:border-orange-500/50 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-full border border-dark-600 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-orange-500/60 hover:text-white"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type de contenu</span>
            <div className="flex flex-wrap gap-2">
              {ALL_CONTENT_TYPES.map((type) => {
                const details = categoryDetails[type];
                const isActive = selectedTypes.includes(type);
                const count = totalsByType[type] ?? 0;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleToggleContentType(type)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
                      isActive
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-dark-600 bg-[#1a1a24] text-gray-300 hover:border-orange-500/50 hover:text-white'
                    }`}
                  >
                    <details.icon size={16} />
                    <span>{details.label}</span>
                    <span className="rounded-full bg-dark-700 px-2 py-0.5 text-[11px] text-gray-300">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Localisation</span>
            <input
              value={locationDraft}
              onChange={(event) => setLocationDraft(event.target.value)}
              onBlur={handleLocationInputBlur}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleLocationInputBlur();
                }
              }}
              placeholder="Ville, pays, quartier..."
              className="rounded-2xl border border-dark-600 bg-[#1a1a24] px-4 py-2 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <span className="text-xs text-gray-500">Utilise des mots clés (ex : « Paris », « bowl », « Marseille »).</span>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plan d&apos;abonnement</span>
            <div className="flex flex-wrap gap-2">
              {subscriptionPlans.map((plan) => {
                const isSelected = selectedPlans.includes(plan.id);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handleTogglePlan(plan.id)}
                    className={`rounded-full border px-3 py-2 text-xs transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/20 text-white'
                        : 'border-dark-600 bg-[#1a1a24] text-gray-300 hover:border-orange-500/50 hover:text-white'
                    }`}
                  >
                    {plan.label}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-gray-500">Affiche uniquement les contenus pensés pour ces plans.</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-dark-700/70 bg-[#121219]/80 p-6 shadow-lg shadow-black/20">
        {currentResults.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <Hash size={36} className="text-gray-600" />
            <div className="text-lg font-semibold text-white">Aucun résultat trouvé</div>
            <p className="max-w-md text-sm text-gray-400">
              Ajuste ta recherche ou retire certains filtres pour explorer davantage de riders, de spots et de défis.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-4">
              {currentResults.map((item) => {
                const details = categoryDetails[item.category];
                const accessible = canAccessSection(currentPlan, item.section);
                const description = buildResultDescription(item);
                return (
                  <li
                    key={`${item.category}-${item.id}`}
                    className="flex flex-col gap-4 rounded-2xl border border-dark-700 bg-[#181821]/80 p-5 transition hover:border-orange-500/40 hover:bg-[#1f1f29]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex flex-1 gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f29] text-orange-400">
                          <details.icon size={22} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                            <span>{details.label}</span>
                            <span className="text-gray-600">•</span>
                            <span>{results?.totalsByType[item.category] ?? 0} match{(results?.totalsByType[item.category] ?? 0) > 1 ? 's' : ''}</span>
                          </div>
                          <h2 className="text-lg font-semibold text-white">{renderHighlightedText(item.title)}</h2>
                          {description && (
                            <p className="text-sm text-gray-400">{renderHighlightedText(description)}</p>
                          )}
                          <div className="flex flex-wrap gap-2 pt-2 text-xs text-gray-400">
                            <span className="rounded-full border border-dark-600 px-3 py-1 text-gray-300">
                              Plan : {getPlanLabel(item.plan)}
                            </span>
                            {!accessible && (
                              <span className="rounded-full border border-orange-500/60 bg-orange-500/10 px-3 py-1 text-orange-300">
                                Mise à niveau requise
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item)}
                        className="self-start rounded-full border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-400 transition hover:bg-orange-500 hover:text-white"
                      >
                        Ouvrir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col items-center justify-between gap-4 border-t border-dark-700 pt-4 text-sm text-gray-400 md:flex-row">
              <div>
                Page {page} · {currentResults.length} résultat{currentResults.length > 1 ? 's' : ''} affiché{currentResults.length > 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={page <= 1}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    page <= 1
                      ? 'cursor-not-allowed border-dark-700 text-gray-600'
                      : 'border-dark-600 text-gray-300 hover:border-orange-500/50 hover:text-white'
                  }`}
                >
                  <ChevronLeft size={16} /> Précédent
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!results?.hasMore}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    results?.hasMore
                      ? 'border-dark-600 text-gray-300 hover:border-orange-500/50 hover:text-white'
                      : 'cursor-not-allowed border-dark-700 text-gray-600'
                  }`}
                >
                  Suivant <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

