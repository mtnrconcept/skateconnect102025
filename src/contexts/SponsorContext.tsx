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
  SponsorCallOpportunity,
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorEventOpportunity,
  SponsorPermissions,
  SponsorShopAnalyticsHistoryPoint,
  SponsorShopAnalyticsSummary,
  SponsorShopItem,
  SponsorShopItemVariant,
  SponsorShopBundle,
  SponsorShopCoupon,
  SponsorSpotlight,
  SponsorSpotlightPerformance,
  SpotlightPerformanceInsights,
} from '../types';
import {
  fetchCommunityAnalyticsHistory,
  fetchLatestCommunityAnalytics,
} from '../lib/sponsorAnalytics';
import {
  createSponsorSpotlight,
  fetchSponsorSpotlights,
  updateSponsorSpotlight,
  type SpotlightPayload,
} from '../lib/sponsorSpotlights';
import {
  buildShopAnalyticsSummary,
  createSponsorShopItem,
  fetchSponsorShopBundles,
  fetchSponsorShopCoupons,
  fetchSponsorShopItems,
  fetchSponsorShopItemVariants,
  fetchSponsorShopItemStats,
  syncSponsorShopBundles,
  syncSponsorShopCoupons,
  syncSponsorShopItemVariants,
  updateSponsorShopItem,
  type ShopItemPayload,
  type SponsorShopBundleDraft,
  type SponsorShopCouponDraft,
  type SponsorShopVariantDraft,
} from '../lib/sponsorShop';
import {
  fetchSponsorApiKeys,
  revokeSponsorApiKey,
  type CreateSponsorApiKeyParams,
  createSponsorApiKey,
} from '../lib/sponsorApiKeys';
import {
  deleteSponsorCall,
  deleteSponsorChallenge,
  deleteSponsorEvent,
  emptySponsorOpportunityCollections,
  fetchSponsorOpportunityCollections,
  updateSponsorCall,
  updateSponsorChallenge,
  updateSponsorEvent,
  type SponsorOpportunityCollections,
  type UpdateSponsorCallPayload,
  type UpdateSponsorChallengePayload,
  type UpdateSponsorEventPayload,
} from '../lib/sponsorOpportunities';
import {
  DEFAULT_ANALYTICS_PERIODS,
  buildSponsorAnalyticsInsights,
  type AnalyticsPeriodFilter,
  type SponsorAnalyticsBreakdowns,
  type SponsorAnalyticsSeriesPoint,
} from '../lib/sponsorAnalyticsInsights';
import { supabase, SUPABASE_URL } from '../lib/supabase';

/* ============ Améliorations robustesse ============ */

/** Log civilisé pour PGRST205 (avertissement unique, pas d’erreur rouge bruyante). */
function warnSchemaMissing(context: string, err: unknown) {
  // On évite console.error pour ne pas stresser le devtool, et on documente le contexte.
  // Le message reste actionnable.
  // @ts-expect-error libre ici
  const hint = err?.hint ? ` hint=${err.hint}` : '';
  console.warn(`[SponsorContext] ${context}: sponsor schema not available (PGRST205).${hint}`);
}

type PostgrestLikeError = {
  code?: string;
  message?: string;
  hint?: string;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
};

/** Détecte le cas “table manquante dans le schéma” (PGRST205) sans briser l’UX. */
function isSchemaMissing(err: unknown): boolean {
  const error = err as PostgrestLikeError | undefined;
  const code = error?.code ?? error?.error?.code;
  const message = error?.message ?? error?.error?.message ?? '';
  if (code === 'PGRST205' || /Could not find the table/.test(message)) {
    return true;
  }

  if (typeof err === 'string') {
    return /sponsor_shop_/i.test(err) || /schema not available/i.test(err);
  }

  if (err instanceof Error) {
    return /sponsor_shop_/i.test(err.message) || /schema not available/i.test(err.message);
  }

  return false;
}

const extractPostgrestError = (cause: unknown) => (cause as { error?: unknown })?.error ?? cause;

export type SponsorDashboardView =
  | 'overview'
  | 'planner'
  | 'opportunities'
  | 'spotlights'
  | 'shop'
  | 'api-keys';

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
  sponsorId: string | null;
  loading: boolean;
  error: string | null;
  profile: Profile | null;
  branding: SponsorBranding | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stripeAccountId: string | null;
  stripeAccountReady: boolean;
  defaultCommissionRate: number | null;
  permissions: SponsorPermissions;
  analytics: CommunityAnalyticsSnapshot | null;
  analyticsHistory: CommunityAnalyticsSnapshot[];
  analyticsSeries: SponsorAnalyticsSeriesPoint[];
  analyticsBreakdowns: SponsorAnalyticsBreakdowns;
  analyticsPeriods: AnalyticsPeriodFilter[];
  spotlights: SponsorSpotlight[];
  shopItems: SponsorShopItem[];
  shopVariants: SponsorShopItemVariant[];
  shopBundles: SponsorShopBundle[];
  shopCoupons: SponsorShopCoupon[];
  shopAnalytics: SponsorShopAnalyticsSummary | null;
  shopAnalyticsHistory: SponsorShopAnalyticsHistoryPoint[];
  shopAnalyticsExportUrl: string | null;
  apiKeys: SponsorApiKey[];
  opportunities: SponsorOpportunityCollections;
  activeView: SponsorDashboardView;
  setActiveView: (view: SponsorDashboardView) => void;
  refreshAll: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  refreshSpotlights: () => Promise<void>;
  refreshShop: () => Promise<void>;
  refreshShopAnalytics: () => Promise<void>;
  refreshApiKeys: () => Promise<void>;
  refreshOpportunities: () => Promise<void>;
  createStripeOnboardingLink: (params: { returnUrl?: string; refreshUrl?: string }) => Promise<string | null>;
  createSpotlight: (payload: Omit<SpotlightPayload, 'sponsor_id'>) => Promise<SponsorSpotlight | null>;
  editSpotlight: (
    spotlightId: string,
    updates: Partial<Omit<SponsorSpotlight, 'id' | 'sponsor_id' | 'created_at' | 'performance'>>,
  ) => Promise<SponsorSpotlight | null>;
  updateSpotlightStatus: (spotlightId: string, status: SponsorSpotlight['status']) => Promise<void>;
  updateShopItemAvailability: (shopItemId: string, isActive: boolean) => Promise<void>;
  createShopItem: (
    payload: Omit<ShopItemPayload, 'sponsor_id'>,
  ) => Promise<SponsorShopItem | null>;
  updateShopItem: (
    shopItemId: string,
    updates: Partial<Omit<SponsorShopItem, 'id' | 'sponsor_id' | 'created_at' | 'updated_at'>>,
  ) => Promise<SponsorShopItem | null>;
  syncShopItemVariants: (
    itemId: string,
    variants: SponsorShopVariantDraft[],
  ) => Promise<void>;
  syncShopItemCoupons: (
    itemId: string,
    coupons: SponsorShopCouponDraft[],
  ) => Promise<void>;
  syncShopItemBundles: (
    primaryItemId: string,
    bundles: SponsorShopBundleDraft[],
  ) => Promise<void>;
  revokeApiKey: (apiKeyId: string) => Promise<void>;
  createApiKey: (
    params: Omit<CreateSponsorApiKeyParams, 'sponsorId'>,
  ) => Promise<{ key: string; record: SponsorApiKey } | null>;
  upsertOpportunity: (
    type: SponsorEditableOpportunityType,
    record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
  ) => void;
  deleteOpportunity: (type: SponsorEditableOpportunityType, id: string) => Promise<void>;
  updateOpportunityStatus: (
    type: SponsorEditableOpportunityType,
    id: string,
    status: SponsorChallengeOpportunity['status'],
  ) => Promise<
    | SponsorChallengeOpportunity
    | SponsorEventOpportunity
    | SponsorCallOpportunity
    | null
  >;
  updateOpportunityOwner: (
    type: SponsorEditableOpportunityType,
    id: string,
    ownerId: string | null,
  ) => Promise<
    | SponsorChallengeOpportunity
    | SponsorEventOpportunity
    | SponsorCallOpportunity
    | null
  >;
}

const defaultPermissions: SponsorPermissions = {
  canAccessAnalytics: false,
  canManageSpotlights: false,
  canManageShop: false,
  canManageApiKeys: false,
  canManageOpportunities: false,
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
  const [shopVariants, setShopVariants] = useState<SponsorShopItemVariant[]>([]);
  const [shopBundles, setShopBundles] = useState<SponsorShopBundle[]>([]);
  const [shopCoupons, setShopCoupons] = useState<SponsorShopCoupon[]>([]);
  const [shopAnalytics, setShopAnalytics] = useState<SponsorShopAnalyticsSummary | null>(null);
  const [shopAnalyticsHistory, setShopAnalyticsHistory] = useState<SponsorShopAnalyticsHistoryPoint[]>([]);
  const [apiKeys, setApiKeys] = useState<SponsorApiKey[]>([]);
  const [opportunities, setOpportunities] = useState<SponsorOpportunityCollections>(
    emptySponsorOpportunityCollections(),
  );
  const [activeView, setActiveView] = useState<SponsorDashboardView>('overview');

  const permissions = useMemo<SponsorPermissions>(
    () => ({ ...defaultPermissions, ...(profile?.sponsor_permissions ?? {}) }),
    [profile?.sponsor_permissions],
  );
  const branding = profile?.sponsor_branding ?? null;
  const contactEmail = profile?.sponsor_contact?.email ?? null;
  const contactPhone = profile?.sponsor_contact?.phone ?? null;
  const stripeAccountId = profile?.stripe_account_id ?? null;
  const stripeAccountReady = Boolean(profile?.stripe_account_ready);
  const defaultCommissionRate =
    typeof profile?.default_commission_rate === 'number' ? profile?.default_commission_rate : null;

  const resetState = useCallback(() => {
    setAnalytics(null);
    setAnalyticsHistory([]);
    setAnalyticsSeries([]);
    setAnalyticsBreakdowns({ periods: [], regions: [], hashtags: [] });
    setSpotlights([]);
    setShopItems([]);
    setShopVariants([]);
    setShopBundles([]);
    setShopCoupons([]);
    setShopAnalytics(null);
    setShopAnalyticsHistory([]);
    setApiKeys([]);
    setOpportunities(emptySponsorOpportunityCollections());
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
      setShopVariants([]);
      setShopBundles([]);
      setShopCoupons([]);
      return;
    }
    try {
      const [items, variants, bundles, coupons] = await Promise.all([
        fetchSponsorShopItems(sponsorId),
        fetchSponsorShopItemVariants(sponsorId),
        fetchSponsorShopBundles(sponsorId),
        fetchSponsorShopCoupons(sponsorId),
      ]);

      setShopItems(items);
      setShopVariants(variants);
      setShopBundles(bundles);
      setShopCoupons(coupons);
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        warnSchemaMissing('refreshShop', cause);
        setShopItems([]);
        setShopVariants([]);
        setShopBundles([]);
        setShopCoupons([]);
        return;
      }
      console.error('Unable to load sponsor shop', cause);
      setError('Impossible de charger la boutique.');
    }
  }, [permissions.canManageShop, sponsorId]);

  const refreshShopAnalytics = useCallback(async () => {
    if (!sponsorId || !permissions.canManageShop) {
      setShopAnalytics(null);
      setShopAnalyticsHistory([]);
      return;
    }
    try {
      const rows = await fetchSponsorShopItemStats(sponsorId);
      const summary = buildShopAnalyticsSummary(rows);
      setShopAnalytics(summary);
      setShopAnalyticsHistory(summary.history);
    } catch (cause) {
      if (isSchemaMissing(cause)) {
        warnSchemaMissing('refreshShopAnalytics', cause);
        setShopAnalytics(null);
        setShopAnalyticsHistory([]);
        return;
      }
      console.error('Unable to load sponsor shop analytics', cause);
      setError('Impossible de charger les analytics boutique.');
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

  const refreshOpportunities = useCallback(async () => {
    if (!sponsorId || !permissions.canManageOpportunities) {
      setOpportunities(emptySponsorOpportunityCollections());
      return;
    }
    try {
      const data = await fetchSponsorOpportunityCollections({ sponsorId, includeNews: false });
      setOpportunities(data);
    } catch (cause) {
      const postgrestError = extractPostgrestError(cause);
      if (isSchemaMissing(postgrestError)) {
        warnSchemaMissing('refreshOpportunities', cause);
        setOpportunities(emptySponsorOpportunityCollections());
        return;
      }
      console.error('Unable to load sponsor opportunities', cause);
      setError('Impossible de charger les opportunités sponsor.');
    }
  }, [permissions.canManageOpportunities, sponsorId]);

  const createStripeOnboardingLink = useCallback(
    async ({ returnUrl, refreshUrl }: { returnUrl?: string; refreshUrl?: string }) => {
      if (!sponsorId) {
        return null;
      }

      try {
        const { data, error } = await supabase.functions.invoke('shop-connect', {
          body: { returnUrl, refreshUrl },
        });

        if (error) {
          throw new Error(error.message ?? 'Stripe onboarding unavailable');
        }

        return (data as { url?: string } | null)?.url ?? null;
      } catch (cause) {
        console.error('Unable to create Stripe onboarding link', cause);
        setError("Impossible de générer le lien Stripe. Réessaie dans un instant.");
        return null;
      }
    },
    [sponsorId],
  );

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
      refreshShopAnalytics(),
      refreshApiKeys(),
      refreshOpportunities(),
    ]);
    setLoading(false);
  }, [
    refreshAnalytics,
    refreshSpotlights,
    refreshShop,
    refreshShopAnalytics,
    refreshApiKeys,
    refreshOpportunities,
    resetState,
    sponsorId,
  ]);

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

  const createSpotlightHandler = useCallback(
    async (payload: Omit<SpotlightPayload, 'sponsor_id'>) => {
      if (!sponsorId || !permissions.canManageSpotlights) {
        return null;
      }

      try {
        const created = attachSpotlightInsights(
          await createSponsorSpotlight({ ...payload, sponsor_id: sponsorId }),
        );
        setSpotlights((current) => [created, ...current]);
        setError(null);
        return created;
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('createSpotlight', cause);
          setError("Impossible de créer un Spotlight tant que le schéma sponsor n'est pas disponible.");
          return null;
        }
        console.error('Unable to create sponsor spotlight', cause);
        setError('Impossible de créer le Spotlight.');
        return null;
      }
    },
    [permissions.canManageSpotlights, sponsorId],
  );

  const editSpotlightHandler = useCallback(
    async (
      spotlightId: string,
      updates: Partial<Omit<SponsorSpotlight, 'id' | 'sponsor_id' | 'created_at' | 'performance'>>,
    ) => {
      if (!sponsorId || !permissions.canManageSpotlights) {
        return null;
      }

      try {
        const updated = attachSpotlightInsights(await updateSponsorSpotlight(spotlightId, updates));
        setSpotlights((current) =>
          current.map((spotlight) => (spotlight.id === spotlightId ? updated : spotlight)),
        );
        setError(null);
        return updated;
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('editSpotlight', cause);
          setError('Modification Spotlight indisponible sans schéma sponsor.');
          return null;
        }
        console.error('Unable to update sponsor spotlight', cause);
        setError('Impossible de modifier le Spotlight.');
        return null;
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

  const createShopItemHandler = useCallback(
    async (payload: Omit<ShopItemPayload, 'sponsor_id'>) => {
      if (!sponsorId || !permissions.canManageShop) {
        return null;
      }
      try {
        const created = await createSponsorShopItem({ ...payload, sponsor_id: sponsorId });
        setShopItems((current) => [created, ...current]);
        setError(null);
        void refreshShopAnalytics();
        return created;
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('createShopItem', cause);
          setError('Impossible de créer un produit : schéma sponsor indisponible.');
          return null;
        }
        console.error('Unable to create shop item', cause);
        setError('Impossible de créer un produit de la boutique.');
        return null;
      }
    },
    [permissions.canManageShop, refreshShopAnalytics, sponsorId],
  );

  const updateShopItemHandler = useCallback(
    async (
      shopItemId: string,
      updates: Partial<Omit<SponsorShopItem, 'id' | 'sponsor_id' | 'created_at' | 'updated_at'>>,
    ) => {
      if (!sponsorId || !permissions.canManageShop) {
        return null;
      }
      try {
        const updated = await updateSponsorShopItem(shopItemId, updates);
        setShopItems((current) =>
          current.map((item) => (item.id === shopItemId ? updated : item)),
        );
        setError(null);
        return updated;
      } catch (cause) {
        if (isSchemaMissing(cause)) {
          warnSchemaMissing('updateShopItem', cause);
          setError('Impossible de modifier le produit : schéma sponsor indisponible.');
          return null;
        }
        console.error('Unable to update sponsor shop item', cause);
        setError('Impossible de modifier ce produit.');
        return null;
      }
    },
    [permissions.canManageShop, sponsorId],
  );

  const syncShopItemVariantsHandler = useCallback(
    async (itemId: string, variants: SponsorShopVariantDraft[]) => {
      if (!sponsorId || !permissions.canManageShop) {
        return;
      }
      try {
        const existingVariantIds = shopVariants
          .filter((variant) => variant.item_id === itemId)
          .map((variant) => variant.id);

        const sanitizedVariants = variants.map((variant) => ({
          ...variant,
          name: variant.name.trim(),
        }));

        const variantIdsToDelete = existingVariantIds.filter(
          (id) => !sanitizedVariants.some((variant) => variant.id === id),
        );

        await syncSponsorShopItemVariants({
          sponsorId,
          itemId,
          variants: sanitizedVariants,
          variantIdsToDelete,
        });

        const refreshedVariants = await fetchSponsorShopItemVariants(sponsorId);
        setShopVariants(refreshedVariants);
        setError(null);
      } catch (cause) {
        const postgrestError = extractPostgrestError(cause);
        if (isSchemaMissing(postgrestError)) {
          warnSchemaMissing('syncShopItemVariants', cause);
          setError('Gestion des variantes indisponible tant que le schéma sponsor est absent.');
          throw cause;
        }
        console.error('Unable to synchronise sponsor shop variants', cause);
        setError('Impossible de synchroniser les variantes du produit.');
        throw cause;
      }
    },
    [permissions.canManageShop, shopVariants, sponsorId],
  );

  const syncShopItemCouponsHandler = useCallback(
    async (itemId: string, coupons: SponsorShopCouponDraft[]) => {
      if (!sponsorId || !permissions.canManageShop) {
        return;
      }
      try {
        const existingCouponIds = shopCoupons
          .filter((coupon) => coupon.item_id === itemId)
          .map((coupon) => coupon.id);

        const sanitizedCoupons = coupons.map((coupon) => ({
          ...coupon,
          code: coupon.code.trim(),
        }));

        const couponIdsToDelete = existingCouponIds.filter(
          (id) => !sanitizedCoupons.some((coupon) => coupon.id === id),
        );

        await syncSponsorShopCoupons({
          sponsorId,
          itemId,
          coupons: sanitizedCoupons,
          couponIdsToDelete,
        });

        const refreshedCoupons = await fetchSponsorShopCoupons(sponsorId);
        setShopCoupons(refreshedCoupons);
        setError(null);
      } catch (cause) {
        const postgrestError = extractPostgrestError(cause);
        if (isSchemaMissing(postgrestError)) {
          warnSchemaMissing('syncShopItemCoupons', cause);
          setError('Gestion des codes promo indisponible tant que le schéma sponsor est absent.');
          throw cause;
        }
        console.error('Unable to synchronise sponsor shop coupons', cause);
        setError('Impossible de synchroniser les codes promotionnels.');
        throw cause;
      }
    },
    [permissions.canManageShop, shopCoupons, sponsorId],
  );

  const syncShopItemBundlesHandler = useCallback(
    async (primaryItemId: string, bundles: SponsorShopBundleDraft[]) => {
      if (!sponsorId || !permissions.canManageShop) {
        return;
      }
      try {
        const existingBundleIds = shopBundles
          .filter((bundle) => bundle.primary_item_id === primaryItemId)
          .map((bundle) => bundle.id);

        const sanitizedBundles = bundles.map((bundle) => ({
          ...bundle,
          name: bundle.name.trim(),
        }));

        const bundleIdsToDelete = existingBundleIds.filter(
          (id) => !sanitizedBundles.some((bundle) => bundle.id === id),
        );

        await syncSponsorShopBundles({
          sponsorId,
          primaryItemId,
          bundles: sanitizedBundles,
          bundleIdsToDelete,
        });

        const refreshedBundles = await fetchSponsorShopBundles(sponsorId);
        setShopBundles(refreshedBundles);
        setError(null);
      } catch (cause) {
        const postgrestError = extractPostgrestError(cause);
        if (isSchemaMissing(postgrestError)) {
          warnSchemaMissing('syncShopItemBundles', cause);
          setError('Gestion des bundles indisponible tant que le schéma sponsor est absent.');
          throw cause;
        }
        console.error('Unable to synchronise sponsor shop bundles', cause);
        setError('Impossible de synchroniser les bundles du produit.');
        throw cause;
      }
    },
    [permissions.canManageShop, shopBundles, sponsorId],
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

  const upsertOpportunity = useCallback(
    (
      type: SponsorEditableOpportunityType,
      record: SponsorChallengeOpportunity | SponsorEventOpportunity | SponsorCallOpportunity,
    ) => {
      if (!permissions.canManageOpportunities) {
        return;
      }

      setOpportunities((current) => {
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
    },
    [permissions.canManageOpportunities],
  );

  const deleteOpportunityHandler = useCallback(
    async (type: SponsorEditableOpportunityType, id: string) => {
      if (!sponsorId || !permissions.canManageOpportunities) {
        return;
      }
      try {
        if (type === 'challenge') {
          await deleteSponsorChallenge(id);
          setOpportunities((current) => ({
            ...current,
            challenges: current.challenges.filter((item) => item.id !== id),
          }));
        } else if (type === 'event') {
          await deleteSponsorEvent(id);
          setOpportunities((current) => ({
            ...current,
            events: current.events.filter((item) => item.id !== id),
          }));
        } else {
          await deleteSponsorCall(id);
          setOpportunities((current) => ({
            ...current,
            calls: current.calls.filter((item) => item.id !== id),
          }));
        }
        setError(null);
      } catch (cause) {
        const postgrestError = extractPostgrestError(cause);
        if (isSchemaMissing(postgrestError)) {
          warnSchemaMissing('deleteOpportunity', cause);
          setOpportunities(emptySponsorOpportunityCollections());
          setError("Fonction opportunités indisponible (schéma sponsor non déployé).");
        } else {
          console.error('Unable to delete sponsor opportunity', cause);
          setError('Impossible de supprimer cette opportunité.');
        }
        throw cause;
      }
    },
    [permissions.canManageOpportunities, sponsorId],
  );

  const updateOpportunityHandler = useCallback(
    async (
      type: SponsorEditableOpportunityType,
      id: string,
      updates:
        | UpdateSponsorChallengePayload
        | UpdateSponsorEventPayload
        | UpdateSponsorCallPayload,
    ) => {
      if (!sponsorId || !permissions.canManageOpportunities) {
        return null;
      }

      try {
        let updated:
          | SponsorChallengeOpportunity
          | SponsorEventOpportunity
          | SponsorCallOpportunity;

        if (type === 'challenge') {
          updated = await updateSponsorChallenge(id, updates as UpdateSponsorChallengePayload);
        } else if (type === 'event') {
          updated = await updateSponsorEvent(id, updates as UpdateSponsorEventPayload);
        } else {
          updated = await updateSponsorCall(id, updates as UpdateSponsorCallPayload);
        }

        setOpportunities((current) => {
          if (type === 'challenge') {
            const value = updated as SponsorChallengeOpportunity;
            return {
              ...current,
              challenges: current.challenges.map((item) => (item.id === value.id ? value : item)),
            };
          }

          if (type === 'event') {
            const value = updated as SponsorEventOpportunity;
            return {
              ...current,
              events: current.events.map((item) => (item.id === value.id ? value : item)),
            };
          }

          const value = updated as SponsorCallOpportunity;
          return {
            ...current,
            calls: current.calls.map((item) => (item.id === value.id ? value : item)),
          };
        });
        setError(null);
        return updated;
      } catch (cause) {
        const postgrestError = extractPostgrestError(cause);
        if (isSchemaMissing(postgrestError)) {
          warnSchemaMissing('updateOpportunity', cause);
          setOpportunities(emptySponsorOpportunityCollections());
          setError("Fonction opportunités indisponible (schéma sponsor non déployé).");
        } else {
          console.error('Unable to update sponsor opportunity', cause);
          setError('Impossible de mettre à jour cette opportunité.');
        }
        return null;
      }
    },
    [permissions.canManageOpportunities, sponsorId],
  );

  const updateOpportunityStatus = useCallback(
    async (
      type: SponsorEditableOpportunityType,
      id: string,
      status: SponsorChallengeOpportunity['status'],
    ) => updateOpportunityHandler(type, id, { status }),
    [updateOpportunityHandler],
  );

  const updateOpportunityOwner = useCallback(
    async (
      type: SponsorEditableOpportunityType,
      id: string,
      ownerId: string | null,
    ) => updateOpportunityHandler(type, id, { owner_id: ownerId }),
    [updateOpportunityHandler],
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

  useEffect(() => {
    if (!sponsorId || !permissions.canManageShop) {
      return undefined;
    }

    const channel = supabase
      .channel(`sponsor-shop-analytics:${sponsorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sponsor_shop_item_stats',
          filter: `sponsor_id=eq.${sponsorId}`,
        },
        () => {
          void refreshShopAnalytics();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [permissions.canManageShop, refreshShopAnalytics, sponsorId]);

  const shopAnalyticsExportUrl = useMemo(() => {
    if (!sponsorId) {
      return null;
    }

    const selectedColumns = 'item_id,metric_date,views_count,cart_additions,orders_count,units_sold,revenue_cents,updated_at';
    return `${SUPABASE_URL}/rest/v1/sponsor_shop_item_stats?select=${selectedColumns}&sponsor_id=eq.${sponsorId}`;
  }, [sponsorId]);

  /* ------------ Valeur de contexte ------------ */

  const value = useMemo<SponsorContextValue>(() => ({
    isSponsor: Boolean(sponsorId),
    sponsorId,
    loading,
    error,
    profile,
    branding,
    contactEmail,
    contactPhone,
    stripeAccountId,
    stripeAccountReady,
    defaultCommissionRate,
    permissions,
    analytics,
    analyticsHistory,
    analyticsSeries,
    analyticsBreakdowns,
    analyticsPeriods: DEFAULT_ANALYTICS_PERIODS,
    spotlights,
    shopItems,
    shopVariants,
    shopBundles,
    shopCoupons,
    shopAnalytics,
    shopAnalyticsHistory,
    shopAnalyticsExportUrl,
    apiKeys,
    opportunities,
    activeView,
    setActiveView,
    refreshAll,
    refreshAnalytics,
    refreshSpotlights,
    refreshShop,
    refreshShopAnalytics,
    refreshApiKeys,
    refreshOpportunities,
    createStripeOnboardingLink,
    createSpotlight: createSpotlightHandler,
    editSpotlight: editSpotlightHandler,
    updateSpotlightStatus,
    updateShopItemAvailability,
    createShopItem: createShopItemHandler,
    updateShopItem: updateShopItemHandler,
    syncShopItemVariants: syncShopItemVariantsHandler,
    syncShopItemCoupons: syncShopItemCouponsHandler,
    syncShopItemBundles: syncShopItemBundlesHandler,
    revokeApiKey: revokeApiKeyHandler,
    createApiKey: createApiKeyHandler,
    upsertOpportunity,
    deleteOpportunity: deleteOpportunityHandler,
    updateOpportunityStatus,
    updateOpportunityOwner,
  }), [
    sponsorId,
    loading,
    error,
    profile,
    branding,
    contactEmail,
    contactPhone,
    stripeAccountId,
    stripeAccountReady,
    defaultCommissionRate,
    permissions,
    analytics,
    analyticsHistory,
    analyticsSeries,
    analyticsBreakdowns,
    opportunities,
    spotlights,
    shopItems,
    shopVariants,
    shopBundles,
    shopCoupons,
    shopAnalytics,
    shopAnalyticsHistory,
    shopAnalyticsExportUrl,
    apiKeys,
    activeView,
    refreshAll,
    refreshAnalytics,
    refreshSpotlights,
    refreshShop,
    refreshShopAnalytics,
    refreshApiKeys,
    refreshOpportunities,
    createStripeOnboardingLink,
    createSpotlightHandler,
    editSpotlightHandler,
    updateSpotlightStatus,
    updateShopItemAvailability,
    createShopItemHandler,
    updateShopItemHandler,
    syncShopItemVariantsHandler,
    syncShopItemCouponsHandler,
    syncShopItemBundlesHandler,
    revokeApiKeyHandler,
    createApiKeyHandler,
    upsertOpportunity,
    deleteOpportunityHandler,
    updateOpportunityStatus,
    updateOpportunityOwner,
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
