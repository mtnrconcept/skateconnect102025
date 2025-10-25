import type { PostgrestResponse } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isColumnMissingError } from './supabaseErrors';
import type { Section, ContentNavigationOptions } from '../types';
import type { SubscriptionPlan } from './subscription';
import { getRequiredPlanForSection } from './subscription';

type RiderSearchRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  role?: string | null;
  created_at: string | null;
};

export type SearchContentType = 'riders' | 'spots' | 'challenges' | 'hashtags';

export type SearchSort = 'relevance' | 'alphabetical' | 'recent';

export interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  category: SearchContentType;
  section: Section;
  options?: ContentNavigationOptions;
  metadata?: string;
  location?: string;
  plan: SubscriptionPlan;
  score: number;
  createdAt?: string;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  totalsByType: Record<SearchContentType, number>;
  page: number;
  pageSize: number;
  hasMore: boolean;
  queryTokens: string[];
}

export interface SearchQueryOptions {
  query?: string;
  contentTypes?: SearchContentType[];
  location?: string;
  subscriptionPlans?: SubscriptionPlan[];
  page?: number;
  pageSize?: number;
  sortBy?: SearchSort;
}

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export const normalizeSearchValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const tokenizeSearchQuery = (query: string): string[] =>
  query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildHighlightSegments = (text: string, tokens: string[]): HighlightSegment[] => {
  if (!text) {
    return [];
  }

  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return [{ text, isMatch: false }];
  }

  const pattern = uniqueTokens.map((token) => escapeRegExp(token)).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const normalizedTokens = uniqueTokens.map((token) => normalizeSearchValue(token));

  return text.split(regex).map((part) => ({
    text: part,
    isMatch: normalizedTokens.includes(normalizeSearchValue(part)),
  }));
};

const ALL_CONTENT_TYPES: SearchContentType[] = ['riders', 'spots', 'challenges', 'hashtags'];

const baseScores: Record<SearchContentType, number> = {
  riders: 120,
  spots: 100,
  challenges: 140,
  hashtags: 80,
};

interface SearchContext {
  query: string;
  tokens: string[];
  normalizedTokens: string[];
  locationFilter?: string;
  planFilter?: SubscriptionPlan[];
  sort: SearchSort;
}

interface SearchPagination {
  offset: number;
  pageSize: number;
  fetchLimit: number;
}

interface PartialSearchResult {
  type: SearchContentType;
  items: SearchResultItem[];
  total: number;
}

const computeMatchScore = (values: Array<string | null | undefined>, tokens: string[]): number => {
  if (!tokens.length) {
    return 0;
  }

  return values.reduce((total, rawValue) => {
    if (!rawValue) {
      return total;
    }

    const normalizedValue = normalizeSearchValue(rawValue);

    return (
      total +
      tokens.reduce((score, token) => {
        if (normalizedValue.includes(token)) {
          score += 10;
          if (normalizedValue.startsWith(token)) {
            score += 5;
          }
        }
        return score;
      }, 0)
    );
  }, 0);
};

const buildSearchUrl = (pathname: string, search: string) => {
  if (!search) {
    return pathname;
  }
  return `${pathname}${search.startsWith('?') ? search : `?${search}`}`;
};

const fetchRiders = async (
  context: SearchContext,
  pagination: SearchPagination,
): Promise<PartialSearchResult> => {
  const plan = getRequiredPlanForSection('leaderboard');
  if (context.planFilter?.length && !context.planFilter.includes(plan)) {
    return { type: 'riders', items: [], total: 0 };
  }

  try {
    const createQuery = (selectColumns: string) => {
      let queryBuilder = supabase
        .from<RiderSearchRow>('profiles')
        .select(selectColumns, { count: 'exact' })
        .range(0, Math.max(pagination.fetchLimit - 1, 0));

      if (context.query) {
        const likeValue = `%${context.query}%`;
        queryBuilder = queryBuilder.or(
          ['display_name', 'username', 'bio'].map((column) => `${column}.ilike.${likeValue}`).join(','),
        );
      }

      if (context.locationFilter) {
        queryBuilder = queryBuilder.ilike('bio', `%${context.locationFilter}%`);
      }

      if (context.sort === 'alphabetical') {
        queryBuilder = queryBuilder.order('display_name', { ascending: true, nullsFirst: false });
      } else if (context.sort === 'recent') {
        queryBuilder = queryBuilder.order('created_at', { ascending: false, nullsLast: true });
      }

      return queryBuilder;
    };

    const withRoleColumns = 'id, display_name, username, bio, role, created_at';
    let fallbackRole = false;

    let result: PostgrestResponse<RiderSearchRow> = await createQuery(withRoleColumns);
    let { data, count, error } = result;

    if (error && isColumnMissingError(error, 'role')) {
      fallbackRole = true;
      console.info(
        '[search] profiles.role column is missing. Falling back to default rider role for search results.',
      );
      result = await createQuery('id, display_name, username, bio, created_at');
      data = result.data;
      count = result.count;
      error = result.error;
    }

    if (error) {
      throw error;
    }

    const normalizedTokens = context.normalizedTokens;
    const items: SearchResultItem[] = (data ?? []).map((profile) => {
      const title = profile.display_name || profile.username || 'Rider';
      const description = profile.username ?? undefined;
      const metadata = profile.bio ?? undefined;
      const score =
        baseScores.riders +
        computeMatchScore([title, description, metadata], normalizedTokens);

      if (fallbackRole) {
        (profile as { role?: string | null }).role = 'skater';
      }

      return {
        id: profile.id,
        title,
        description,
        metadata,
        category: 'riders',
        section: 'leaderboard',
        plan,
        score,
        createdAt: profile.created_at ?? undefined,
      };
    });

    return {
      type: 'riders',
      items,
      total: count ?? items.length,
    };
  } catch (error) {
    console.error('Error searching riders:', error);
    return { type: 'riders', items: [], total: 0 };
  }
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
      return undefined;
  }
};

const fetchSpots = async (
  context: SearchContext,
  pagination: SearchPagination,
): Promise<PartialSearchResult> => {
  const plan = getRequiredPlanForSection('map');
  if (context.planFilter?.length && !context.planFilter.includes(plan)) {
    return { type: 'spots', items: [], total: 0 };
  }

  try {
    let queryBuilder = supabase
      .from('spots')
      .select('id, name, description, address, spot_type, created_at', { count: 'exact' })
      .range(0, Math.max(pagination.fetchLimit - 1, 0));

    if (context.query) {
      const likeValue = `%${context.query}%`;
      queryBuilder = queryBuilder.or(
        ['name', 'description', 'address'].map((column) => `${column}.ilike.${likeValue}`).join(','),
      );
    }

    if (context.locationFilter) {
      queryBuilder = queryBuilder.ilike('address', `%${context.locationFilter}%`);
    }

    if (context.sort === 'alphabetical') {
      queryBuilder = queryBuilder.order('name', { ascending: true, nullsFirst: false });
    } else if (context.sort === 'recent') {
      queryBuilder = queryBuilder.order('created_at', { ascending: false, nullsLast: true });
    }

    const { data, count, error } = await queryBuilder;
    if (error) {
      throw error;
    }

    const normalizedTokens = context.normalizedTokens;
    const items: SearchResultItem[] = (data ?? []).map((spot) => {
      const title = spot.name ?? 'Spot';
      const description = spot.address ?? undefined;
      const metadata = getSpotTypeLabel(spot.spot_type);
      const score =
        baseScores.spots +
        computeMatchScore([title, description, metadata, spot.description ?? undefined], normalizedTokens);

      return {
        id: spot.id,
        title,
        description,
        metadata,
        location: spot.address ?? undefined,
        category: 'spots',
        section: 'map',
        options: { spotId: spot.id },
        plan,
        score,
        createdAt: spot.created_at ?? undefined,
      };
    });

    return {
      type: 'spots',
      items,
      total: count ?? items.length,
    };
  } catch (error) {
    console.error('Error searching spots:', error);
    return { type: 'spots', items: [], total: 0 };
  }
};

const fetchChallenges = async (
  context: SearchContext,
  pagination: SearchPagination,
): Promise<PartialSearchResult> => {
  const plan = getRequiredPlanForSection('challenges');
  if (context.planFilter?.length && !context.planFilter.includes(plan)) {
    return { type: 'challenges', items: [], total: 0 };
  }

  try {
    let queryBuilder = supabase
      .from('challenges')
      .select('id, title, description, challenge_type, prize, created_at, start_date', { count: 'exact' })
      .range(0, Math.max(pagination.fetchLimit - 1, 0));

    if (context.query) {
      const likeValue = `%${context.query}%`;
      queryBuilder = queryBuilder.or(
        ['title', 'description', 'challenge_type', 'prize']
          .map((column) => `${column}.ilike.${likeValue}`)
          .join(','),
      );
    }

    if (context.locationFilter) {
      queryBuilder = queryBuilder.ilike('description', `%${context.locationFilter}%`);
    }

    if (context.sort === 'alphabetical') {
      queryBuilder = queryBuilder.order('title', { ascending: true, nullsFirst: false });
    } else if (context.sort === 'recent') {
      queryBuilder = queryBuilder.order('start_date', { ascending: false, nullsLast: true });
    }

    const { data, count, error } = await queryBuilder;
    if (error) {
      throw error;
    }

    const normalizedTokens = context.normalizedTokens;
    const items: SearchResultItem[] = (data ?? []).map((challenge) => {
      const metadata = challenge.challenge_type ? `Type : ${challenge.challenge_type}` : undefined;
      const score =
        baseScores.challenges +
        computeMatchScore([challenge.title, challenge.description, metadata, challenge.prize], normalizedTokens);

      return {
        id: challenge.id,
        title: challenge.title ?? 'Défi',
        description: challenge.description ?? undefined,
        metadata,
        category: 'challenges',
        section: 'challenges',
        options: { scrollToId: `challenge-${challenge.id}`, challengeTab: 'community' },
        plan,
        score,
        createdAt: challenge.start_date ?? challenge.created_at ?? undefined,
      };
    });

    return {
      type: 'challenges',
      items,
      total: count ?? items.length,
    };
  } catch (error) {
    console.error('Error searching challenges:', error);
    return { type: 'challenges', items: [], total: 0 };
  }
};

const hashtagPattern = /#[\p{L}0-9_]+/gu;

const fetchHashtags = async (
  context: SearchContext,
  pagination: SearchPagination,
): Promise<PartialSearchResult> => {
  const plan = getRequiredPlanForSection('feed');
  if (context.planFilter?.length && !context.planFilter.includes(plan)) {
    return { type: 'hashtags', items: [], total: 0 };
  }

  try {
    const fetchSpan = Math.max(pagination.fetchLimit * 2, pagination.pageSize);
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, created_at', { count: 'exact' })
      .range(0, Math.max(fetchSpan - 1, 0));

    if (error) {
      throw error;
    }

    const tagMap = new Map<
      string,
      {
        count: number;
        lastUsedAt?: string;
      }
    >();

    for (const post of data ?? []) {
      if (!post?.content) {
        continue;
      }
      const matches = post.content.match(hashtagPattern);
      if (!matches) {
        continue;
      }

      for (const match of matches) {
        const normalized = match.replace(/^#+/, '').toLowerCase();
        const entry = tagMap.get(normalized) ?? { count: 0, lastUsedAt: post.created_at ?? undefined };
        entry.count += 1;
        if (post.created_at && (!entry.lastUsedAt || new Date(post.created_at) > new Date(entry.lastUsedAt))) {
          entry.lastUsedAt = post.created_at;
        }
        tagMap.set(normalized, entry);
      }
    }

    let items: SearchResultItem[] = Array.from(tagMap.entries()).map(([tag, info]) => {
      const title = `#${tag}`;
      const description = `${info.count} publication${info.count > 1 ? 's' : ''}`;
      const score = baseScores.hashtags + computeMatchScore([title, description], context.normalizedTokens);

      return {
        id: tag,
        title,
        description,
        category: 'hashtags',
        section: 'feed',
        plan,
        score,
        createdAt: info.lastUsedAt,
      };
    });

    if (context.query) {
      const queryValue = normalizeSearchValue(context.query);
      items = items.filter((item) => normalizeSearchValue(item.title).includes(queryValue));
    }

    items.sort((a, b) => b.score - a.score);
    const total = items.length;
    const limited = items.slice(0, Math.max(pagination.fetchLimit, pagination.pageSize));

    return {
      type: 'hashtags',
      items: limited,
      total,
    };
  } catch (error) {
    console.error('Error searching hashtags:', error);
    return { type: 'hashtags', items: [], total: 0 };
  }
};

export async function searchContent(options: SearchQueryOptions = {}): Promise<SearchResponse> {
  const {
    query = '',
    contentTypes = ALL_CONTENT_TYPES,
    location,
    subscriptionPlans,
    page = 1,
    pageSize = 20,
    sortBy = 'relevance',
  } = options;

  const sanitizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const sanitizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20;

  const tokens = tokenizeSearchQuery(query);
  const normalizedTokens = tokens.map((token) => normalizeSearchValue(token));
  const offset = (sanitizedPage - 1) * sanitizedPageSize;
  const fetchLimit = Math.max(offset + sanitizedPageSize * 2, sanitizedPageSize);

  const context: SearchContext = {
    query,
    tokens,
    normalizedTokens,
    locationFilter: location?.trim() || undefined,
    planFilter: subscriptionPlans && subscriptionPlans.length > 0 ? subscriptionPlans : undefined,
    sort: sortBy,
  };

  const pagination: SearchPagination = {
    offset,
    pageSize: sanitizedPageSize,
    fetchLimit,
  };

  const typeSet = new Set<SearchContentType>(contentTypes.length ? contentTypes : ALL_CONTENT_TYPES);
  const tasks: Array<Promise<PartialSearchResult>> = [];

  if (typeSet.has('riders')) {
    tasks.push(fetchRiders(context, pagination));
  }
  if (typeSet.has('spots')) {
    tasks.push(fetchSpots(context, pagination));
  }
  if (typeSet.has('challenges')) {
    tasks.push(fetchChallenges(context, pagination));
  }
  if (typeSet.has('hashtags')) {
    tasks.push(fetchHashtags(context, pagination));
  }

  const partialResults = await Promise.all(tasks);

  const totalsByType: Record<SearchContentType, number> = {
    riders: 0,
    spots: 0,
    challenges: 0,
    hashtags: 0,
  };

  const aggregated: SearchResultItem[] = [];
  for (const result of partialResults) {
    totalsByType[result.type] = result.total;
    aggregated.push(...result.items);
  }

  const compare = (a: SearchResultItem, b: SearchResultItem) => {
    if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
    }

    if (sortBy === 'recent') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }

    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  };

  aggregated.sort(compare);

  const paginated = aggregated.slice(offset, offset + sanitizedPageSize);
  const total = Array.from(typeSet).reduce((sum, type) => sum + (totalsByType[type] ?? 0), 0);
  const hasMore = offset + sanitizedPageSize < total;

  return {
    items: paginated,
    total,
    totalsByType,
    page: sanitizedPage,
    pageSize: sanitizedPageSize,
    hasMore,
    queryTokens: tokens,
  };
}

export const buildSearchPath = (pathname: string, params: URLSearchParams) => buildSearchUrl(pathname, params.toString());

