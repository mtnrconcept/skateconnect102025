import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  CommunityAnalyticsSnapshot,
  Profile,
  SponsorApiKey,
  SponsorBranding,
  SponsorPermissions,
  SponsorShopItem,
  SponsorSpotlight,
  SponsorSpotlightPerformance,
  SpotlightPerformanceInsights,
} from '../types';
import {
  fetchCommunityAnalyticsHistory,
  fetchLatestCommunityAnalytics,
} from '../lib/sponsorAnalytics';
import {
  fetchSponsorSpotlights,
  updateSponsorSpotlight,
} from '../lib/sponsorSpotlights';
import {
  fetchSponsorShopItems,
  updateSponsorShopItem,
} from '../lib/sponsorShop';
import {
  fetchSponsorApiKeys,
  revokeSponsorApiKey,
  type CreateSponsorApiKeyParams,
  createSponsorApiKey,
} from '../lib/sponsorApiKeys';
import {
  DEFAULT_ANALYTICS_PERIODS,
  buildSponsorAnalyticsInsights,
  type AnalyticsPeriodFilter,
  type SponsorAnalyticsBreakdowns,
  type SponsorAnalyticsSeriesPoint,
} from '../lib/sponsorAnalyticsInsights';

/* ============ Améliorations robustesse ============ */

/** Détecte le cas “table manquante dans le schéma” (PGRST205) sans briser l’UX. */
function isSchemaMissing(err: unknown): boolean {
  // Les libs Supabase renvoient souvent { code, message, hint }
  const e = err as any;
  const code = e?.code ?? e?.error?.code;
  const message = (e?.message ?? e?.error?.message ?? '') as string;
  return code === 'PGRST205' || /Could not find the table/.test(message);
}

/** Log civilisé pour PGRST205 (avertissement unique, pas d’erreur rouge bruyante). */
function warnSchemaMissing(context: string, err: unknown) {
  // On évite console.error pour ne pas stresser le devtool, et on documente le contexte.
  // Le message reste actionnable.
  // @ts-expect-error libre ici
  const hint = err?.hint ? ` hint=${err.hint}` : '';
  console.warn(`[SponsorContext] ${context}: sponsor schema not available (PGRST205).${hint}`);
}

export type SponsorDashboardView = 'overview' | 'spotlights' | 'shop' | 'api-keys';

function roundTo(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function computePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    return null;
  }
  return roundTo(((current - previous) / Math.abs(previous)) * 100);
}

function buildSpotlightPerformanceInsights(
  performance: SponsorSpotlightPerformance | null,
): SpotlightPerformanceInsights | null {
  if (!performance) {
    return null;
  }

  const impressionsTrend = computePercentageChange(
    performance.last7Days.impressions,
    performance.previous7Days.impressions,
  );
  const clicksTrend = computePercentageChange(
    performance.last7Days.clicks,
    performance.previous7Days.clicks,
  );

  const currentCtr =
    performance.last7Days.impressions > 0
      ? (performance.last7Days.clicks / performance.last7Days.impressions) * 100
      : 0;
  const previousCtr =
    performance.previous7Days.impressions > 0
      ? (performance.previous7Days.clicks / performance.previous7Days.impressions) * 100
      : 0;
  const ctrTrend = computePercentageChange(currentCtr, previousCtr);

  return {
    trend: {
      impressions: impressionsTrend,
      clicks: clicksTrend,
      ctr: ctrTrend,
    },
    sparkline: performance.daily,
  } satisfies SpotlightPerformanceInsights;
}

function attachSpotlightInsights(spotlight: SponsorSpotlight): SponsorSpotlight {
  return {
    ...spotlight,
    performanceInsights: buildSpotlightPerformanceInsights(spotlight.performance),
  };
}

interface SponsorContextValue {
  isSponsor: boolean;
  loading: boolean;
  error: string | null;
  branding: SponsorBranding | null;
  contactEmail: string | null;
  contactPhone: string | null;
  permissions: SponsorPermissions;
  analytics: CommunityAnalyticsSnapshot | null;
  analyticsHistory: CommunityAnalyticsSnapshot[];
  analyticsSeries: SponsorAnalyticsSeriesPoint[];
  analyticsBreakdowns: SponsorAnalyticsBreakdowns;
  analyticsPeriods: AnalyticsPeriodFilter[];
  spotlights: SponsorSpotlight[];
  shopItems: SponsorShopItem[];
  apiKeys: SponsorApiKey[];
  activeView: SponsorDashboardView;
  setActiveView: (view: SponsorDashboardView) => void;
  refreshAll: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  refreshSpotlights: () => Promise<void>;
  refreshShop: () => Promise<void>;
  refreshApiKeys: () => Promise<void>;
  updateSpotlightStatus: (spotlightId: string, status: SponsorSpotlight['status']) => Promise<void>;
  updateShopItemAvailability: (shopItemId: string, isActive: boolean) => Promise<void>;
  revokeApiKey: (apiKeyId: string) => Promise<void>;
  createApiKey: (
    params: Omit<CreateSponsorApiKeyParams, 'sponsorId'>,
  ) => Promise<{ key: string; record: SponsorApiKey } | null>;
}

const defaultPermissions: SponsorPermissions = {
  canAccessAnalytics: false,
  canManageSpotlights: false,
  canManageShop: false,
  canManageApiKeys: false,
};

const SponsorContext = createContext<SponsorContextValue | undefined>(undefined);

interface SponsorProviderProps {
  profile: Profile | null;
  children: ReactNode;
}

export function SponsorProvider({ profile, children }: SponsorProviderProps) {
  const sponsorId = profile?.role === 'sponsor' ? profile.id : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CommunityAnalyticsSnapshot | null>(null);
  const [analyticsHistory, setAnalyticsHistory] = useState<CommunityAnalyticsSnapshot[]>([]);
  const [analyticsSeries, setAnalyticsSeries] = useState<SponsorAnalyticsSeriesPoint[]>([]);
  const [analyticsBreakdowns, setAnalyticsBreakdowns] = useState<SponsorAnalyticsBreakdowns>({
    periods: [],
    regions: [],
    hashtags: [],
  });
  const [spotlights, setSpotlights] = useState<SponsorSpotlight[]>([]);
  const [shopItems, setShopItems] = useState<SponsorShopItem[]>([]);
  const [apiKeys, setApiKeys] = useState<SponsorApiKey[]>([]);
  const [activeView, setActiveView] = useState<SponsorDashboardView>('overview');

  const permissions = profile?.sponsor_permissions ?? defaultPermissions;
  const branding = profile?.sponsor_branding ?? null;
  const contactEmail = profile?.sponsor_contact?.email ?? null;
  const contactPhone = profile?.sponsor_contact?.phone ?? null;

  const resetState = useCallback(() => {
    setAnalytics(null);
    setAnalyticsHistory([]);
    setAnalyticsSeries([]);
    setAnalyticsBreakdowns({ periods: [], regions: [], hashtags: [] });
    setSpotlights([]);
    setShopItems([]);
    setApiKeys([]);
    setActiveView('overview');
    setError(null);
  }, []);

  /* ------------ Loaders avec gestion “schema missing” silencieuse ------------ */

  const refreshAnalytics = useCallback(async () => {
    if (!sponsorId || !permissions.canAccessAnalytics) {
      setAnalytics(null);
      setAnalyticsHistory([]);
      setAnalyticsSeries([]);
      setAnalyticsBreakdowns({ periods: [], regions: [], hashtags: [] });
      return;
    }
    try {
      const [snapshot, history] = await Promise.all([
        fetchLatestCommunityAnalytics(sponsorId),
        fetchCommunityAnalyticsHistory(sponsorId),
      ]);

      setAnalytics(snapshot);
      setAnalyticsHistory(history);

      const insights = buildSponsorAnalyticsInsights(history);
      setAnalyticsSeries(insights.series);
      setAnalyticsBreakdowns(insights.breakdowns);
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        // Schéma sponsor non déployé : on reste silencieux, pas d’erreur UX.
        warnSchemaMissing('refreshAnalytics', cause);
        setAnalytics(null);
        setAnalyticsHistory([]);
        setAnalyticsSeries([]);
        setAnalyticsBreakdowns({ periods: [], regions: [], hashtags: [] });
        return;
      }
      console.error('Unable to load community analytics', cause);
      setError('Impossible de charger les analytics sponsor.');
    }
  }, [permissions.canAccessAnalytics, sponsorId]);

  const refreshSpotlights = useCallback(async () => {
    if (!sponsorId || !permissions.canManageSpotlights) {
      setSpotlights([]);
      return;
    }
    try {
      const data = await fetchSponsorSpotlights(sponsorId);
      setSpotlights(data.map(attachSpotlightInsights));
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        warnSchemaMissing('refreshSpotlights', cause);
        setSpotlights([]);
        return;
      }
      console.error('Unable to load sponsor spotlights', cause);
      setError('Impossible de charger les Spotlight.');
    }
  }, [permissions.canManageSpotlights, sponsorId]);

  const refreshShop = useCallback(async () => {
    if (!sponsorId || !permissions.canManageShop) {
      setShopItems([]);
      return;
    }
    try {
      const items = await fetchSponsorShopItems(sponsorId);
      setShopItems(items);
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        warnSchemaMissing('refreshShop', cause);
        setShopItems([]);
        return;
      }
      console.error('Unable to load sponsor shop', cause);
      setError('Impossible de charger la boutique.');
    }
  }, [permissions.canManageShop, sponsorId]);

  const refreshApiKeys = useCallback(async () => {
    if (!sponsorId || !permissions.canManageApiKeys) {
      setApiKeys([]);
      return;
    }
    try {
      const keys = await fetchSponsorApiKeys(sponsorId);
      setApiKeys(keys);
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        warnSchemaMissing('refreshApiKeys', cause);
        setApiKeys([]);
        return;
      }
      console.error('Unable to load sponsor API keys', cause);
      setError('Impossible de charger les clés API.');
    }
  }, [permissions.canManageApiKeys, sponsorId]);

  const refreshAll = useCallback(async () => {
    if (!sponsorId) {
      resetState();
      return;
    }
    setLoading(true);
    setError(null);
    await Promise.allSettled([
      refreshAnalytics(),
      refreshSpotlights(),
      refreshShop(),
      refreshApiKeys(),
    ]);
    setLoading(false);
  }, [refreshAnalytics, refreshSpotlights, refreshShop, refreshApiKeys, resetState, sponsorId]);

  /* ------------ Mutations avec traitement fail-soft PGRST205 ------------ */

  const updateSpotlightStatus = useCallback(
    async (spotlightId: string, status: SponsorSpotlight['status']) => {
      if (!sponsorId || !permissions.canManageSpotlights) return;
      try {
        const updated = attachSpotlightInsights(await updateSponsorSpotlight(spotlightId, { status }));
        setSpotlights((current) =>
          current.map((spotlight) => (spotlight.id === spotlightId ? updated : spotlight)),
        );
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('updateSpotlightStatus', cause);
          setError("Fonction indisponible tant que le schéma sponsor n'est pas déployé.");
          return;
        }
        console.error('Unable to update spotlight status', cause);
        setError("Impossible de mettre à jour le statut d'un Spotlight.");
      }
    },
    [permissions.canManageSpotlights, sponsorId],
  );

  const updateShopItemAvailability = useCallback(
    async (shopItemId: string, isActive: boolean) => {
      if (!sponsorId || !permissions.canManageShop) return;
      try {
        const updated = await updateSponsorShopItem(shopItemId, { is_active: isActive });
        setShopItems((current) =>
          current.map((item) => (item.id === shopItemId ? updated : item)),
        );
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('updateShopItemAvailability', cause);
          setError('Fonction boutique indisponible (schéma sponsor non déployé).');
          return;
        }
        console.error('Unable to update shop item', cause);
        setError("Impossible de mettre à jour un produit de la boutique.");
      }
    },
    [permissions.canManageShop, sponsorId],
  );

  const revokeApiKeyHandler = useCallback(
    async (apiKeyId: string) => {
      if (!sponsorId || !permissions.canManageApiKeys) return;
      try {
        const updated = await revokeSponsorApiKey(apiKeyId);
        setApiKeys((current) =>
          current.map((key) => (key.id === apiKeyId ? updated : key)),
        );
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('revokeApiKey', cause);
          setError('Gestion des clés indisponible (schéma sponsor non déployé).');
          return;
        }
        console.error('Unable to revoke API key', cause);
        setError("Impossible de révoquer la clé API.");
      }
    },
    [permissions.canManageApiKeys, sponsorId],
  );

  const createApiKeyHandler = useCallback(
    async (params: Omit<CreateSponsorApiKeyParams, 'sponsorId'>) => {
      if (!sponsorId || !permissions.canManageApiKeys) return null;
      try {
        const result = await createSponsorApiKey({ ...params, sponsorId });
        if (result) {
          setApiKeys((current) => [result.record, ...current]);
        }
        return result;
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('createApiKey', cause);
          setError('Création de clé indisponible (schéma sponsor non déployé).');
          return null;
        }
        console.error('Unable to create API key', cause);
        setError('Impossible de créer une nouvelle clé API.');
        return null;
      }
    },
    [permissions.canManageApiKeys, sponsorId],
  );

  /* ------------ Cycle de vie ------------ */

  useEffect(() => {
    if (!sponsorId) {
      resetState();
      return;
    }
    // Chargement initial
    void refreshAll();
  }, [refreshAll, resetState, sponsorId]);

  /* ------------ Valeur de contexte ------------ */

  const value = useMemo<SponsorContextValue>(() => ({
    isSponsor: Boolean(sponsorId),
    loading,
    error,
    branding,
    contactEmail,
    contactPhone,
    permissions,
    analytics,
    analyticsHistory,
    analyticsSeries,
    analyticsBreakdowns,
    analyticsPeriods: DEFAULT_ANALYTICS_PERIODS,
    spotlights,
    shopItems,
    apiKeys,
    activeView,
    setActiveView,
    refreshAll,
    refreshAnalytics,
    refreshSpotlights,
    refreshShop,
    refreshApiKeys,
    updateSpotlightStatus,
    updateShopItemAvailability,
    revokeApiKey: revokeApiKeyHandler,
    createApiKey: createApiKeyHandler,
  }), [
    sponsorId,
    loading,
    error,
    branding,
    contactEmail,
    contactPhone,
    permissions,
    analytics,
    spotlights,
    shopItems,
    apiKeys,
    activeView,
    refreshAll,
    refreshAnalytics,
    refreshSpotlights,
    refreshShop,
    refreshApiKeys,
    updateSpotlightStatus,
    updateShopItemAvailability,
    revokeApiKeyHandler,
    createApiKeyHandler,
  ]);

  return <SponsorContext.Provider value={value}>{children}</SponsorContext.Provider>;
}

export function useSponsorContext(): SponsorContextValue {
  const context = useContext(SponsorContext);
  if (!context) {
    throw new Error('useSponsorContext must be used within a SponsorProvider');
  }
  return context;
}
