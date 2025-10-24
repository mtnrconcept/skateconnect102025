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
} from '../types';
import { fetchLatestCommunityAnalytics } from '../lib/sponsorAnalytics';
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

export type SponsorDashboardView = 'overview' | 'spotlights' | 'shop' | 'api-keys';

interface SponsorContextValue {
  isSponsor: boolean;
  loading: boolean;
  error: string | null;
  branding: SponsorBranding | null;
  contactEmail: string | null;
  contactPhone: string | null;
  permissions: SponsorPermissions;
  analytics: CommunityAnalyticsSnapshot | null;
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
    setSpotlights([]);
    setShopItems([]);
    setApiKeys([]);
    setActiveView('overview');
    setError(null);
  }, []);

  const refreshAnalytics = useCallback(async () => {
    if (!sponsorId || !permissions.canAccessAnalytics) {
      setAnalytics(null);
      return;
    }

    try {
      const snapshot = await fetchLatestCommunityAnalytics(sponsorId);
      setAnalytics(snapshot);
    } catch (cause) {
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
      setSpotlights(data);
    } catch (cause) {
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

  const updateSpotlightStatus = useCallback(
    async (spotlightId: string, status: SponsorSpotlight['status']) => {
      if (!sponsorId || !permissions.canManageSpotlights) {
        return;
      }

      try {
        const updated = await updateSponsorSpotlight(spotlightId, { status });
        setSpotlights((current) =>
          current.map((spotlight) => (spotlight.id === spotlightId ? updated : spotlight)),
        );
      } catch (cause) {
        console.error('Unable to update spotlight status', cause);
        setError("Impossible de mettre à jour le statut d'un Spotlight.");
      }
    },
    [permissions.canManageSpotlights, sponsorId],
  );

  const updateShopItemAvailability = useCallback(
    async (shopItemId: string, isActive: boolean) => {
      if (!sponsorId || !permissions.canManageShop) {
        return;
      }

      try {
        const updated = await updateSponsorShopItem(shopItemId, { is_active: isActive });
        setShopItems((current) =>
          current.map((item) => (item.id === shopItemId ? updated : item)),
        );
      } catch (cause) {
        console.error('Unable to update shop item', cause);
        setError("Impossible de mettre à jour un produit de la boutique.");
      }
    },
    [permissions.canManageShop, sponsorId],
  );

  const revokeApiKeyHandler = useCallback(
    async (apiKeyId: string) => {
      if (!sponsorId || !permissions.canManageApiKeys) {
        return;
      }

      try {
        const updated = await revokeSponsorApiKey(apiKeyId);
        setApiKeys((current) =>
          current.map((key) => (key.id === apiKeyId ? updated : key)),
        );
      } catch (cause) {
        console.error('Unable to revoke API key', cause);
        setError("Impossible de révoquer la clé API.");
      }
    },
    [permissions.canManageApiKeys, sponsorId],
  );

  const createApiKeyHandler = useCallback(
    async (params: Omit<CreateSponsorApiKeyParams, 'sponsorId'>) => {
      if (!sponsorId || !permissions.canManageApiKeys) {
        return null;
      }

      try {
        const result = await createSponsorApiKey({ ...params, sponsorId });
        if (result) {
          setApiKeys((current) => [result.record, ...current]);
        }
        return result;
      } catch (cause) {
        console.error('Unable to create API key', cause);
        setError('Impossible de créer une nouvelle clé API.');
        return null;
      }
    },
    [permissions.canManageApiKeys, sponsorId],
  );

  useEffect(() => {
    if (!sponsorId) {
      resetState();
      return;
    }

    refreshAll();
  }, [refreshAll, resetState, sponsorId]);

  const value = useMemo<SponsorContextValue>(() => ({
    isSponsor: Boolean(sponsorId),
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
