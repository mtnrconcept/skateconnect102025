import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorNewsItem,
} from '../types';
import {
  deleteSponsorCall,
  deleteSponsorChallenge,
  deleteSponsorEvent,
  emptySponsorOpportunityCollections,
  fetchSponsorOpportunityCollections,
  type FetchSponsorOpportunitiesOptions,
  type SponsorOpportunityCollections,
} from '../lib/sponsorOpportunities';
import { isSchemaMissing } from '../lib/postgrest';

export interface UseSponsorOpportunitiesOptions extends FetchSponsorOpportunitiesOptions {
  autoRefresh?: boolean;
}

export interface UseSponsorOpportunitiesResult {
  challenges: SponsorChallengeOpportunity[];
  events: SponsorEventOpportunity[];
  calls: SponsorCallOpportunity[];
  news: SponsorNewsItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
  upsertOpportunity: (
    type: SponsorEditableOpportunityType,
    record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
  ) => void;
  deleteOpportunity: (type: SponsorEditableOpportunityType, id: string) => Promise<void>;
}

const DEFAULT_ERROR_MESSAGE = 'Impossible de charger les opportunités sponsor pour le moment.';

const extractPostgrestError = (cause: unknown) =>
  (cause as { error?: Parameters<typeof isSchemaMissing>[0] })?.error ??
  (cause as Parameters<typeof isSchemaMissing>[0]);

export function useSponsorOpportunities(
  options: UseSponsorOpportunitiesOptions = {},
): UseSponsorOpportunitiesResult {
  const { sponsorId, includeNews = true, autoRefresh = true } = options;
  const [collections, setCollections] = useState<SponsorOpportunityCollections>(
    () => emptySponsorOpportunityCollections(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCollections(emptySponsorOpportunityCollections());
    setError(null);
    setLoading(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchSponsorOpportunityCollections({ sponsorId, includeNews });
      setCollections(data);
    } catch (cause) {
      const postgrestError = extractPostgrestError(cause);

      if (isSchemaMissing(postgrestError)) {
        console.warn(
          '[useSponsorOpportunities] refresh: sponsor schema not available (PGRST205).',
        );
        setCollections(emptySponsorOpportunityCollections());
        setError(null);
      } else {
        console.error('Unable to load sponsor opportunities', cause);
        setError(DEFAULT_ERROR_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
  }, [includeNews, sponsorId]);

  useEffect(() => {
    if (autoRefresh) {
      void refresh();
    }
  }, [autoRefresh, refresh]);

  const upsertOpportunity = useCallback<
    UseSponsorOpportunitiesResult['upsertOpportunity']
  >((type, record) => {
    setCollections((current) => {
      if (!current) {
        return current;
      }

      if (type === 'challenge') {
        const value = record as SponsorChallengeOpportunity;
        const exists = current.challenges.some((item) => item.id === value.id);
        return {
          ...current,
          challenges: exists
            ? current.challenges.map((item) => (item.id === value.id ? value : item))
            : [value, ...current.challenges],
        };
      }

      if (type === 'event') {
        const value = record as SponsorEventOpportunity;
        const exists = current.events.some((item) => item.id === value.id);
        return {
          ...current,
          events: exists
            ? current.events.map((item) => (item.id === value.id ? value : item))
            : [value, ...current.events],
        };
      }

      const value = record as SponsorCallOpportunity;
      const exists = current.calls.some((item) => item.id === value.id);
      return {
        ...current,
        calls: exists
          ? current.calls.map((item) => (item.id === value.id ? value : item))
          : [value, ...current.calls],
      };
    });
    setError(null);
  }, []);

  const deleteOpportunity = useCallback<
    UseSponsorOpportunitiesResult['deleteOpportunity']
  >(async (type, id) => {
    try {
      if (type === 'challenge') {
        await deleteSponsorChallenge(id);
        setCollections((current) => ({
          ...current,
          challenges: current.challenges.filter((item) => item.id !== id),
        }));
      } else if (type === 'event') {
        await deleteSponsorEvent(id);
        setCollections((current) => ({
          ...current,
          events: current.events.filter((item) => item.id !== id),
        }));
      } else {
        await deleteSponsorCall(id);
        setCollections((current) => ({
          ...current,
          calls: current.calls.filter((item) => item.id !== id),
        }));
      }
      setError(null);
    } catch (cause) {
      const postgrestError = extractPostgrestError(cause);
      if (isSchemaMissing(postgrestError)) {
        console.warn(
          '[useSponsorOpportunities] deleteOpportunity: sponsor schema not available (PGRST205).',
        );
        setCollections(emptySponsorOpportunityCollections());
        setError("Fonction indisponible tant que le schéma sponsor n'est pas déployé.");
      } else {
        console.error('Unable to delete sponsor opportunity', cause);
        setError('Impossible de supprimer cette opportunité. Réessaie plus tard.');
      }
      throw cause;
    }
  }, []);

  const value = useMemo<UseSponsorOpportunitiesResult>(
    () => ({
      challenges: collections.challenges,
      events: collections.events,
      calls: collections.calls,
      news: collections.news,
      loading,
      error,
      refresh,
      reset,
      clearError,
      upsertOpportunity,
      deleteOpportunity,
    }),
    [
      collections.calls,
      collections.challenges,
      collections.events,
      collections.news,
      loading,
      error,
      refresh,
      reset,
      clearError,
      upsertOpportunity,
      deleteOpportunity,
    ],
  );

  return value;
}
