import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  Download,
  KanbanSquare,
  KeyRound,
  Mail,
  Megaphone,
  Package,
  Pencil,
  PlusCircle,
  Phone,
  RefreshCw,
  Store,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSponsorContext } from '../../contexts/SponsorContext';
import SponsorAnalyticsSection from './analytics/SponsorAnalyticsSection';
import SponsorOpportunitiesView from './opportunities/SponsorOpportunitiesView';
import { SponsorPlanner } from './planner';
import type {
  SponsorChallengeOpportunity,
  SponsorEditableOpportunityType,
  SponsorShopItem,
  SponsorSpotlight,
} from '../../types';
import SponsorShopItemModal, {
  type SponsorShopItemFormValues,
} from './shop/SponsorShopItemModal';
import type { ShopItemPayload } from '../../lib/sponsorShop';
import { useRouter } from '../../lib/router';
import SponsorSpotlightModal, {
  type SponsorSpotlightFormValues,
} from './spotlights/SponsorSpotlightModal';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatNumber = (value: number) => numberFormatter.format(value);

const spotlightStatusMeta: Record<
  SponsorSpotlight['status'],
  { label: string; className: string; Icon: LucideIcon }
> = {
  draft: {
    label: 'Brouillon',
    className: 'bg-slate-500/10 text-slate-200 border border-slate-500/30',
    Icon: Clock,
  },
  scheduled: {
    label: 'Programmé',
    className: 'bg-blue-500/10 text-blue-200 border border-blue-500/30',
    Icon: CalendarDays,
  },
  active: {
    label: 'Actif',
    className: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
    Icon: CheckCircle,
  },
  completed: {
    label: 'Terminé',
    className: 'bg-purple-500/10 text-purple-200 border border-purple-500/30',
    Icon: TrendingUp,
  },
};

const viewDefinitions = [
  { id: 'overview' as const, label: "Vue d'ensemble", icon: BarChart3 },
  { id: 'planner' as const, label: 'Planner', icon: CalendarDays },
  { id: 'opportunities' as const, label: 'Opportunités', icon: KanbanSquare },
  { id: 'spotlights' as const, label: 'Spotlight', icon: Megaphone },
  { id: 'shop' as const, label: 'Boutique', icon: Store },
  { id: 'api-keys' as const, label: 'Clés API', icon: KeyRound },
];

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  active: 'Actif',
  completed: 'Terminé',
};

const availableScopes = [
  { id: 'analytics:read', label: 'Lecture analytics' },
  { id: 'spotlights:write', label: 'Gestion Spotlight' },
  { id: 'shop:write', label: 'Gestion boutique' },
  { id: 'shop:analytics', label: 'Analytics boutique / export' },
];

function renderStatusBadge(status: string) {
  const colorMap: Record<string, string> = {
    draft: 'bg-slate-800 text-slate-200 border border-slate-600',
    scheduled: 'bg-blue-900/60 text-blue-100 border border-blue-500/50',
    active: 'bg-emerald-900/60 text-emerald-100 border border-emerald-500/50',
    completed: 'bg-purple-900/60 text-purple-100 border border-purple-500/50',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorMap[status] ?? colorMap.draft}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (value === 0) {
    return <span className="text-xs text-slate-400">Stable</span>;
  }

  const isPositive = value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const colorClass = isPositive ? 'text-emerald-300' : 'text-rose-300';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon size={14} />
      {`${isPositive ? '+' : ''}${Math.abs(value).toFixed(1)} %`}
    </span>
  );
}

interface SparklinePoint {
  date: string;
  impressions: number;
  clicks: number;
}

function SpotlightSparkline({ points }: { points: SparklinePoint[] }) {
  if (!points || points.length === 0) {
    return <div className="text-xs text-slate-500">Collecte en cours</div>;
  }

  const width = 140;
  const height = 48;
  const maxValue = Math.max(...points.map((point) => Math.max(point.impressions, point.clicks)), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const buildPath = (accessor: (point: SparklinePoint) => number) =>
    points
      .map((point, index) => {
        const value = accessor(point);
        const x = index * step;
        const y = height - (value / maxValue) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const impressionsPath = buildPath((point) => point.impressions);
  const clicksPath = buildPath((point) => point.clicks);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={impressionsPath} fill="none" stroke="rgba(56,189,248,0.85)" strokeWidth={2} />
      <path d={clicksPath} fill="none" stroke="rgba(249,115,22,0.9)" strokeWidth={2} />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  trend,
  helper,
}: {
  label: string;
  value: string;
  trend: number | null;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <TrendBadge value={trend} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

export default function SponsorDashboard() {
  const {
    isSponsor: isSponsorAccount,
    branding,
    contactEmail,
    contactPhone,
    stripeAccountId,
    stripeAccountReady,
    defaultCommissionRate,
    permissions,
    analytics,
    spotlights,
    shopItems,
    shopVariants,
    shopBundles,
    shopCoupons,
    shopAnalytics,
    shopAnalyticsHistory,
    shopAnalyticsExportUrl,
    apiKeys,
    loading,
    error,
    activeView,
    setActiveView,
    refreshAll,
    refreshSpotlights,
    refreshShopAnalytics,
    createStripeOnboardingLink,
    createSpotlight,
    editSpotlight,
    updateSpotlightStatus,
    updateShopItemAvailability,
    createShopItem,
    updateShopItem,
    syncShopItemVariants,
    syncShopItemCoupons,
    syncShopItemBundles,
    revokeApiKey,
    createApiKey,
    profile,
    opportunities,
    updateOpportunityStatus,
    updateOpportunityOwner,
  } = useSponsorContext();
  const { navigate } = useRouter();
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>(['analytics:read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [shopCopyFeedback, setShopCopyFeedback] = useState<string | null>(null);
  const [spotlightFeedback, setSpotlightFeedback] = useState<
    | { type: 'success' | 'error' | 'info'; message: string }
    | null
  >(null);
  const [isSpotlightModalOpen, setIsSpotlightModalOpen] = useState(false);
  const [spotlightModalMode, setSpotlightModalMode] = useState<'create' | 'edit'>('create');
  const [spotlightBeingEdited, setSpotlightBeingEdited] = useState<SponsorSpotlight | null>(null);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopModalMode, setShopModalMode] = useState<'create' | 'edit'>('create');
  const [shopItemBeingEdited, setShopItemBeingEdited] = useState<SponsorShopItem | null>(null);
  const [isRequestingStripeLink, setIsRequestingStripeLink] = useState(false);
  const [stripeSetupError, setStripeSetupError] = useState<string | null>(null);

  const primaryColor = branding?.primary_color ?? '#0ea5e9';
  const secondaryColor = branding?.secondary_color ?? '#1e293b';
  const shopItemsById = useMemo(() => new Map(shopItems.map((entry) => [entry.id, entry])), [shopItems]);

  const openCreateSpotlightModal = () => {
    setSpotlightModalMode('create');
    setSpotlightBeingEdited(null);
    setIsSpotlightModalOpen(true);
  };

  const openEditSpotlightModal = (spotlight: SponsorSpotlight) => {
    setSpotlightModalMode('edit');
    setSpotlightBeingEdited(spotlight);
    setIsSpotlightModalOpen(true);
  };

  const closeSpotlightModal = () => {
    setIsSpotlightModalOpen(false);
    setSpotlightBeingEdited(null);
  };

  const openCreateShopItemModal = () => {
    setShopModalMode('create');
    setShopItemBeingEdited(null);
    setIsShopModalOpen(true);
  };

  const openEditShopItemModal = (item: SponsorShopItem) => {
    setShopModalMode('edit');
    setShopItemBeingEdited(item);
    setIsShopModalOpen(true);
  };

  const closeShopItemModal = () => {
    setIsShopModalOpen(false);
    setShopItemBeingEdited(null);
    setShopModalMode('create');
  };

  const handlePlannerStatusChange = useCallback(
    async (
      type: SponsorEditableOpportunityType,
      id: string,
      status: SponsorChallengeOpportunity['status'],
    ) => {
      if (!permissions.canManageOpportunities) {
        return;
      }
      try {
        await updateOpportunityStatus(type, id, status);
      } catch (cause) {
        console.error('Unable to update planner status', cause);
      }
    },
    [permissions.canManageOpportunities, updateOpportunityStatus],
  );

  const handlePlannerOwnerChange = useCallback(
    async (
      type: SponsorEditableOpportunityType,
      id: string,
      ownerId: string | null,
    ) => {
      if (!permissions.canManageOpportunities) {
        return;
      }
      try {
        await updateOpportunityOwner(type, id, ownerId);
      } catch (cause) {
        console.error('Unable to update planner owner', cause);
      }
    },
    [permissions.canManageOpportunities, updateOpportunityOwner],
  );

  const overviewMetrics = useMemo(() => {
    const parseMetricDate = (value: string) => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    };

    const history = shopAnalyticsHistory
      .map((entry) => ({ ...entry, parsedDate: parseMetricDate(entry.metricDate) }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const computeRange = (days: number) => {
      const rangeEnd = todayUtc;
      const rangeStart = new Date(rangeEnd);
      rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

      const previousEnd = new Date(rangeStart);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

      return history.reduce(
        (acc, entry) => {
          const timestamp = entry.parsedDate.getTime();
          if (timestamp >= rangeStart.getTime() && timestamp <= rangeEnd.getTime()) {
            acc.current.revenue += entry.revenueCents;
            acc.current.orders += entry.orders;
          } else if (timestamp >= previousStart.getTime() && timestamp <= previousEnd.getTime()) {
            acc.previous.revenue += entry.revenueCents;
            acc.previous.orders += entry.orders;
          }
          return acc;
        },
        {
          current: { revenue: 0, orders: 0 },
          previous: { revenue: 0, orders: 0 },
        },
      );
    };

    const computeTrend = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? null : 0;
      }
      return ((current - previous) / previous) * 100;
    };

    const dayRange = computeRange(1);
    const weekRange = computeRange(7);
    const monthRange = computeRange(30);

    const toEuros = (value: number) => value / 100;

    const lowStockThreshold = 5;
    const pendingActivations = spotlights.filter((spotlight) => spotlight.status === 'draft' || spotlight.status === 'scheduled').length;
    const activeActivations = spotlights.filter((spotlight) => spotlight.status === 'active').length;

    return {
      todaySales: toEuros(dayRange.current.revenue),
      todayOrders: dayRange.current.orders,
      todayTrend: computeTrend(dayRange.current.revenue, dayRange.previous.revenue),
      weekSales: toEuros(weekRange.current.revenue),
      weekTrend: computeTrend(weekRange.current.revenue, weekRange.previous.revenue),
      monthSales: toEuros(monthRange.current.revenue),
      monthTrend: computeTrend(monthRange.current.revenue, monthRange.previous.revenue),
      totalProducts: shopItems.length,
      lowStock: shopItems.filter((item) => item.stock <= lowStockThreshold).length,
      pendingActivations,
      activeActivations,
      averageEngagement: analytics?.engagement_rate ?? null,
    };
  }, [analytics?.engagement_rate, shopAnalyticsHistory, shopItems, spotlights]);

  const recentSpotlights = useMemo(
    () =>
      [...spotlights]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4),
    [spotlights],
  );

  const handleCreateApiKey = async () => {
    if (!apiKeyName.trim()) {
      return;
    }
    setIsCreatingKey(true);
    setCreatedKey(null);
    try {
      const result = await createApiKey({ name: apiKeyName.trim(), scopes: apiKeyScopes });
      if (result) {
        setCreatedKey(result.key);
        setApiKeyName('');
      }
    } finally {
      setIsCreatingKey(false);
    }
  };

  useEffect(() => {
    if (!copyFeedback) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopyFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!spotlightFeedback) {
      return undefined;
    }
    const timer = window.setTimeout(() => setSpotlightFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [spotlightFeedback]);

  const handleSpotlightSubmit = useCallback(
    async (values: SponsorSpotlightFormValues) => {
      const sanitizedDescription = values.description.trim();
      const sanitizedCta = values.callToAction.trim();
      const sanitizedCtaUrl = values.callToActionUrl.trim();

      const payload: Parameters<typeof createSpotlight>[0] = {
        title: values.title.trim(),
        description: sanitizedDescription || null,
        call_to_action: sanitizedCta || null,
        call_to_action_url: sanitizedCtaUrl || null,
        status: values.status,
        start_date: values.startDate,
        end_date: values.endDate,
        media_url: values.mediaUrl,
      };

      try {
        if (spotlightModalMode === 'create') {
          const created = await createSpotlight(payload);
          if (!created) {
            throw new Error('create-spotlight-failed');
          }
          const isLocalPlaceholder = created.id.startsWith('local-');
          setSpotlightFeedback({
            type: isLocalPlaceholder ? 'info' : 'success',
            message: isLocalPlaceholder
              ?
                "Spotlight créé en mode démo. Applique les migrations sponsor pour l'activer définitivement."
              : 'Spotlight créé avec succès.',
          });
          if (!isLocalPlaceholder) {
            await refreshSpotlights();
          }
        } else {
          if (!spotlightBeingEdited) {
            throw new Error('missing-spotlight-reference');
          }
          const updates: Parameters<typeof editSpotlight>[1] = { ...payload };
          const updated = await editSpotlight(spotlightBeingEdited.id, updates);
          if (!updated) {
            throw new Error('update-spotlight-failed');
          }
          setSpotlightFeedback({ type: 'success', message: 'Spotlight mis à jour.' });
          await refreshSpotlights();
        }
      } catch (cause) {
        setSpotlightFeedback({
          type: 'error',
          message: "Impossible d'enregistrer le Spotlight. Réessaie dans quelques instants.",
        });
        throw cause;
      }
    },
    [
      createSpotlight,
      editSpotlight,
      refreshSpotlights,
      spotlightBeingEdited,
      spotlightModalMode,
    ],
  );

  const handleShopItemSubmit = useCallback(
    async (values: SponsorShopItemFormValues) => {
      const basePayload = {
        name: values.name.trim(),
        description: values.description.trim(),
        price_cents: values.priceCents,
        currency: values.currency,
        stock: values.stock,
        is_active: values.isActive,
        image_url: values.imageUrl,
        available_from: values.availableFrom,
        available_until: values.availableUntil,
      } satisfies Omit<ShopItemPayload, 'sponsor_id'>;

      let targetItemId: string;

      if (shopModalMode === 'create') {
        const created = await createShopItem(basePayload);
        if (!created) {
          throw new Error('Unable to create shop item');
        }
        targetItemId = created.id;
      } else {
        if (!shopItemBeingEdited) {
          throw new Error('Missing shop item reference');
        }

        const updated = await updateShopItem(shopItemBeingEdited.id, basePayload);

        if (!updated) {
          throw new Error('Unable to update shop item');
        }

        targetItemId = updated.id;
      }

      await syncShopItemVariants(targetItemId, values.variants);
      await syncShopItemCoupons(targetItemId, values.coupons);
      await syncShopItemBundles(targetItemId, values.bundles);
    },
    [
      createShopItem,
      shopItemBeingEdited,
      shopModalMode,
      syncShopItemBundles,
      syncShopItemCoupons,
      syncShopItemVariants,
      updateShopItem,
    ],
  );

  const handleStripeOnboarding = useCallback(async () => {
    setStripeSetupError(null);
    setIsRequestingStripeLink(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const url = await createStripeOnboardingLink({
        returnUrl: baseUrl ? `${baseUrl}/sponsors?stripe=return` : undefined,
        refreshUrl: baseUrl ? `${baseUrl}/sponsors?stripe=refresh` : undefined,
      });

      if (!url) {
        throw new Error('missing-url');
      }

      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (cause) {
      console.error('Unable to launch Stripe onboarding', cause);
      setStripeSetupError("Impossible de générer le lien Stripe. Réessaie dans un instant.");
    } finally {
      setIsRequestingStripeLink(false);
    }
  }, [createStripeOnboardingLink]);

  const serializeSpotlightForExport = useCallback((spotlight: SponsorSpotlight) => {
      const performance = spotlight.performance;
      const insights = spotlight.performanceInsights;
      const last7Impressions = performance?.last7Days.impressions ?? 0;
      const last7Clicks = performance?.last7Days.clicks ?? 0;
      const last7Ctr =
        performance && performance.last7Days.impressions > 0
          ? ((performance.last7Days.clicks / performance.last7Days.impressions) * 100).toFixed(2)
          : '0.00';
      const totals = performance?.totals ?? { impressions: 0, clicks: 0, ctr: 0 };
      const trend = insights?.trend;

      return [
        spotlight.title,
        statusLabels[spotlight.status] ?? spotlight.status,
        spotlight.start_date ? new Date(spotlight.start_date).toISOString() : '',
        spotlight.end_date ? new Date(spotlight.end_date).toISOString() : '',
        totals.impressions.toString(),
        totals.clicks.toString(),
        totals.ctr.toFixed(2),
        last7Impressions.toString(),
        last7Clicks.toString(),
        last7Ctr,
        trend?.impressions != null ? trend.impressions.toFixed(2) : '',
        trend?.clicks != null ? trend.clicks.toFixed(2) : '',
        trend?.ctr != null ? trend.ctr.toFixed(2) : '',
        spotlight.call_to_action ?? '',
        spotlight.call_to_action_url ?? '',
      ];
    }, []);

  const handleExportSpotlights = useCallback(() => {
    if (spotlights.length === 0) {
      setCopyFeedback('Aucune donnée à exporter pour le moment.');
      return;
    }

    const headers = [
      'Titre',
      'Statut',
      'Début',
      'Fin',
      'Impressions totales',
      'Clics totaux',
      'CTR global (%)',
      'Impressions (7j)',
      'Clics (7j)',
      'CTR (7j)',
      'Tendance impressions (%)',
      'Tendance clics (%)',
      'Tendance CTR (%)',
      'CTA',
      'URL CTA',
    ];

    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = spotlights.map(serializeSpotlightForExport);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCell(cell ?? '')).join(';'))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'skateconnect-spotlights.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopyFeedback('Export CSV généré.');
  }, [serializeSpotlightForExport, spotlights]);

  const handleCopySpotlights = useCallback(async () => {
    if (spotlights.length === 0) {
      setCopyFeedback('Aucune donnée à copier pour le moment.');
      return;
    }

    const rows = [
      ['Spotlight', 'Statut', 'Impressions (7j)', 'Clics (7j)', 'CTR (7j)', 'Tendance impressions', 'Tendance clics', 'Tendance CTR'],
      ...spotlights.map((spotlight) => {
        const performance = spotlight.performance;
        const insights = spotlight.performanceInsights;
        const last7Impressions = performance?.last7Days.impressions ?? 0;
        const last7Clicks = performance?.last7Days.clicks ?? 0;
        const last7Ctr =
          performance && performance.last7Days.impressions > 0
            ? ((performance.last7Days.clicks / performance.last7Days.impressions) * 100).toFixed(2)
            : '0.00';
        const trend = insights?.trend;

        const formatTrend = (value: number | null | undefined) =>
          value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

        return [
          spotlight.title,
          statusLabels[spotlight.status] ?? spotlight.status,
          last7Impressions.toString(),
          last7Clicks.toString(),
          `${last7Ctr}%`,
          formatTrend(trend?.impressions ?? null),
          formatTrend(trend?.clicks ?? null),
          formatTrend(trend?.ctr ?? null),
        ];
      }),
    ];

    const textPayload = rows.map((row) => row.join(' \t ')).join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textPayload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textPayload;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyFeedback('Données KPI copiées dans le presse-papier.');
    } catch (err) {
      console.error('Unable to copy spotlight metrics', err);
      setCopyFeedback('Impossible de copier les données.');
    }
  }, [spotlights]);

  const scrollToAnalyticsSection = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('sponsor-analytics-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const renderOverview = () => {
    const engagementHelper =
      overviewMetrics.averageEngagement != null
        ? `Engagement moyen ${overviewMetrics.averageEngagement.toFixed(1)} %`
        : 'Performance détaillée';

    return (
      <div className="space-y-8">
        <div
          className="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/80"
          style={{ boxShadow: `0 40px 90px -45px ${primaryColor}55` }}
        >
          <div
            className="relative px-8 py-10 text-white md:px-10"
            style={{ background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})` }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 55%)' }}
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Sponsor cockpit</p>
                <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                  Pilotage des activations
                </h1>
                <p className="mt-3 text-sm text-white/80">
                  {branding?.tagline ?? 'Campagnes créatives pour rider la scène.'}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/sponsor/ads')}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/30"
                  >
                    <Megaphone size={18} />
                    Planifier une campagne
                  </button>
                  <button
                    type="button"
                    onClick={openCreateShopItemModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/25"
                  >
                    <PlusCircle size={18} />
                    Ajouter un produit
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-sm text-white/80">
                  {contactEmail && (
                    <span className="inline-flex items-center gap-2">
                      <Mail size={16} />
                      {contactEmail}
                    </span>
                  )}
                  {contactPhone && (
                    <span className="inline-flex items-center gap-2">
                      <Phone size={16} />
                      {contactPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-950/80 px-6 py-8 md:px-10">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300">
                    <DollarSign size={20} />
                  </span>
                  <TrendBadge value={overviewMetrics.todayTrend} />
                </div>
                <p className="text-sm text-slate-400">CA du jour</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatCurrency(overviewMetrics.todaySales)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatNumber(overviewMetrics.todayOrders)} commande(s)
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-xl bg-purple-500/15 p-3 text-purple-300">
                    <TrendingUp size={20} />
                  </span>
                  <TrendBadge value={overviewMetrics.monthTrend} />
                </div>
                <p className="text-sm text-slate-400">CA 30 derniers jours</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatCurrency(overviewMetrics.monthSales)}
                </p>
                <p className="mt-2 text-xs text-slate-500">Comparé au mois précédent</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-xl bg-sky-500/15 p-3 text-sky-300">
                    <Megaphone size={20} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                    Activations
                  </span>
                </div>
                <p className="text-sm text-slate-400">Spotlights actifs</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatNumber(overviewMetrics.activeActivations)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatNumber(overviewMetrics.pendingActivations)} à lancer
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 shadow-inner shadow-black/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-xl bg-blue-500/15 p-3 text-blue-300">
                    <Package size={20} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                    Catalogue
                  </span>
                </div>
                <p className="text-sm text-slate-400">Produits actifs</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatNumber(overviewMetrics.totalProducts)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatNumber(overviewMetrics.lowStock)} stock critique
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-white">Actions rapides</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              onClick={openCreateShopItemModal}
              className="group rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/0 p-5 text-left transition hover:border-purple-400/60 hover:bg-purple-500/15"
            >
              <span className="flex items-center justify-between">
                <span className="rounded-xl bg-purple-500/20 p-3 text-purple-200">
                  <PlusCircle className="h-6 w-6" />
                </span>
              </span>
              <p className="mt-4 text-base font-semibold text-white">Ajouter un produit</p>
              <p className="mt-1 text-sm text-slate-400">Optimise ton catalogue boutique.</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('spotlights')}
              className="group rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-sky-500/0 p-5 text-left transition hover:border-sky-400/60 hover:bg-sky-500/15"
            >
              <span className="flex items-center justify-between">
                <span className="rounded-xl bg-sky-500/20 p-3 text-sky-200">
                  <Megaphone className="h-6 w-6" />
                </span>
              </span>
              <p className="mt-4 text-base font-semibold text-white">Piloter les activations</p>
              <p className="mt-1 text-sm text-slate-400">
                {formatNumber(overviewMetrics.pendingActivations)} campagne(s) à préparer
              </p>
            </button>
            <button
              type="button"
              onClick={scrollToAnalyticsSection}
              className="group rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/0 p-5 text-left transition hover:border-emerald-400/60 hover:bg-emerald-500/15"
            >
              <span className="flex items-center justify-between">
                <span className="rounded-xl bg-emerald-500/20 p-3 text-emerald-200">
                  <BarChart3 className="h-6 w-6" />
                </span>
              </span>
              <p className="mt-4 text-base font-semibold text-white">Analyser les performances</p>
              <p className="mt-1 text-sm text-slate-400">{engagementHelper}</p>
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Activations récentes</h2>
              <p className="text-sm text-slate-400">Suivi temps réel de tes dernières campagnes Spotlight.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateSpotlightModal}
                className="inline-flex items-center gap-2 rounded-full border border-purple-400/60 px-4 py-2 text-sm text-purple-200 transition hover:border-purple-300 hover:bg-purple-500/10"
              >
                <PlusCircle size={16} />
                Nouveau Spotlight
              </button>
              <button
                type="button"
                onClick={() => setActiveView('spotlights')}
                className="text-sm font-medium text-purple-300 transition hover:text-purple-200"
              >
                Voir tout →
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {recentSpotlights.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-6 py-6 text-sm text-slate-300">
                Aucune activation récente. Lance ton premier Spotlight pour apparaître ici.
              </div>
            ) : (
              recentSpotlights.map((spotlight) => {
                const meta = spotlightStatusMeta[spotlight.status];
                const last7Days = spotlight.performance?.last7Days;
                const impressions = last7Days?.impressions ?? 0;
                const clicks = last7Days?.clicks ?? 0;
                const ctr =
                  last7Days && last7Days.impressions > 0
                    ? (last7Days.clicks / last7Days.impressions) * 100
                    : null;

                return (
                  <div
                    key={spotlight.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-base font-semibold text-white">{spotlight.title}</p>
                      <p className="text-sm text-slate-400">
                        {spotlight.start_date
                          ? new Date(spotlight.start_date).toLocaleDateString('fr-FR')
                          : 'Début à définir'}
                        {spotlight.end_date
                          ? ` → ${new Date(spotlight.end_date).toLocaleDateString('fr-FR')}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 text-sm text-slate-300 md:flex-row md:items-center md:gap-6">
                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Impressions 7j</p>
                        <p className="text-base font-semibold text-white">{formatNumber(impressions)}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Clics 7j</p>
                        <p className="text-base font-semibold text-white">{formatNumber(clicks)}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-widest text-slate-500">CTR 7j</p>
                        <p className="text-base font-semibold text-white">
                          {ctr == null ? '—' : `${ctr.toFixed(1)} %`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
                      >
                        <meta.Icon size={14} />
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditSpotlightModal(spotlight)}
                        className="rounded-full border border-slate-700/70 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          id="sponsor-analytics-section"
          className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 md:p-8"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Analyses détaillées</h2>
              <p className="text-sm text-slate-400">
                Explore la performance complète de ta boutique et de tes activations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshShopAnalytics}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                <RefreshCw size={16} />
                Actualiser
              </button>
              {shopAnalyticsExportUrl && (
                <a
                  href={shopAnalyticsExportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  <Download size={16} />
                  Export CSV
                </a>
              )}
            </div>
          </div>
          <div className="mt-6">
            <SponsorAnalyticsSection />
          </div>
        </div>
      </div>
    );
  };

  const renderSpotlights = () => (
    <div className="space-y-6">
      {!permissions.canManageSpotlights ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-rose-200">
          Ta marque n'a pas encore accès à la gestion des Spotlight. Contacte ton chargé de compte pour activer l'option.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold text-white">Spotlight actifs</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySpotlights}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
              >
                <Copy size={16} /> Copier KPI
              </button>
              <button
                type="button"
                onClick={handleExportSpotlights}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                type="button"
                onClick={openCreateSpotlightModal}
                className="inline-flex items-center gap-2 rounded-full border border-sky-500/70 px-4 py-2 text-sm text-sky-100 hover:border-sky-400 hover:bg-sky-500/10"
              >
                <PlusCircle size={16} /> Nouveau Spotlight
              </button>
              <button
                type="button"
                onClick={refreshAll}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
              >
                <RefreshCw size={16} /> Rafraîchir
              </button>
            </div>
          </div>
          {spotlightFeedback && (
            <p
              className={`text-xs ${
                spotlightFeedback.type === 'success'
                  ? 'text-emerald-300'
                  : spotlightFeedback.type === 'info'
                    ? 'text-sky-300'
                    : 'text-rose-300'
              }`}
            >
              {spotlightFeedback.message}
            </p>
          )}
          {copyFeedback && <p className="text-xs text-emerald-300">{copyFeedback}</p>}
          <div className="grid gap-4">
            {spotlights.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-300">
                Aucun Spotlight pour le moment. Publie ton premier projet sponsorisé pour apparaître ici.
              </div>
            ) : (
              spotlights.map((spotlight) => (
                <div
                  key={spotlight.id}
                  className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 flex flex-col gap-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {renderStatusBadge(spotlight.status)}
                        {spotlight.start_date && (
                          <span className="text-xs text-slate-400">
                            {new Date(spotlight.start_date).toLocaleDateString('fr-FR')}
                            {spotlight.end_date ? ` → ${new Date(spotlight.end_date).toLocaleDateString('fr-FR')}` : ''}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold text-white">{spotlight.title}</h3>
                      {spotlight.description && (
                        <p className="text-sm text-slate-300 max-w-3xl">{spotlight.description}</p>
                      )}
                      {spotlight.call_to_action && (
                        <p className="text-sm text-slate-400">
                          CTA : <span className="text-slate-200">{spotlight.call_to_action}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 self-start">
                      <button
                        type="button"
                        onClick={() => openEditSpotlightModal(spotlight)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400 hover:text-white"
                      >
                        <Pencil size={16} /> Modifier
                      </button>
                      {spotlight.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => updateSpotlightStatus(spotlight.id, 'active')}
                          className="rounded-full border border-emerald-500/60 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
                        >
                          Activer
                        </button>
                      )}
                      {spotlight.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => updateSpotlightStatus(spotlight.id, 'completed')}
                          className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          Terminer
                        </button>
                      )}
                    </div>
                  </div>
                  {spotlight.performance && (
                    <div className="grid gap-4 md:grid-cols-5">
                      <div className="md:col-span-3 grid gap-4 sm:grid-cols-3">
                        <MetricCard
                          label="Impressions (7j)"
                          value={spotlight.performance.last7Days.impressions.toLocaleString('fr-FR')}
                          trend={spotlight.performanceInsights?.trend.impressions ?? null}
                          helper={`Total : ${spotlight.performance.totals.impressions.toLocaleString('fr-FR')}`}
                        />
                        <MetricCard
                          label="Clics (7j)"
                          value={spotlight.performance.last7Days.clicks.toLocaleString('fr-FR')}
                          trend={spotlight.performanceInsights?.trend.clicks ?? null}
                          helper={`Total : ${spotlight.performance.totals.clicks.toLocaleString('fr-FR')}`}
                        />
                        <MetricCard
                          label="CTR (7j)"
                          value={
                            spotlight.performance.last7Days.impressions > 0
                              ? `${(
                                  (spotlight.performance.last7Days.clicks /
                                    spotlight.performance.last7Days.impressions) *
                                  100
                                ).toFixed(2)} %`
                              : '0.00 %'
                          }
                          trend={spotlight.performanceInsights?.trend.ctr ?? null}
                          helper={`CTR global : ${spotlight.performance.totals.ctr.toFixed(2)} %`}
                        />
                      </div>
                      <div className="md:col-span-2 rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-wider text-slate-500">Tendance 30 jours</p>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                            <span className="inline-flex items-center gap-1 text-cyan-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Impressions
                            </span>
                            <span className="inline-flex items-center gap-1 text-orange-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-300" /> Clics
                            </span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <SpotlightSparkline points={spotlight.performanceInsights?.sparkline ?? []} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  const shopTotals = useMemo(
    () =>
      shopAnalytics?.totals ?? {
        views: 0,
        carts: 0,
        orders: 0,
        units: 0,
        revenueCents: 0,
        conversionRate: 0,
      },
    [shopAnalytics],
  );

  const shopPrimaryCurrency = useMemo(
    () => shopItems.find((item) => item.is_active)?.currency ?? shopItems[0]?.currency ?? 'EUR',
    [shopItems],
  );

  const shopLastUpdatedLabel = useMemo(() => {
    if (!shopAnalytics?.updatedAt) {
      return null;
    }
    return new Date(shopAnalytics.updatedAt).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [shopAnalytics?.updatedAt]);

  const recentShopHistory = useMemo(
    () =>
      shopAnalyticsHistory.length === 0
        ? []
        : [...shopAnalyticsHistory].slice(-7).reverse(),
    [shopAnalyticsHistory],
  );

  const lowStockItems = useMemo(() => shopItems.filter((item) => item.stock <= 5), [shopItems]);

  const perItemAnalytics = shopAnalytics?.perItem ?? {};

  const formatRevenue = useCallback(
    (value: number, currency: string = shopPrimaryCurrency) =>
      (value / 100).toLocaleString('fr-FR', { style: 'currency', currency }),
    [shopPrimaryCurrency],
  );

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }, []);

  const renderShop = () => (
    <div className="space-y-6">
      {!permissions.canManageShop ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-6 text-amber-100">
          La gestion de la boutique n'est pas incluse dans ton pack actuel.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Inventaire boutique</h2>
              <p className="text-sm text-slate-400">
                Gère les produits mis à disposition des riders et partenaires. Mets à jour le stock et l'état en un clic.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={() => void refreshShopAnalytics()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
              >
                <RefreshCw size={16} /> Rafraîchir analytics
              </button>
              <button
                type="button"
                onClick={openCreateShopItemModal}
                className="inline-flex items-center gap-2 rounded-full border border-sky-500/70 px-4 py-2 text-sm text-sky-100 hover:border-sky-400 hover:bg-sky-500/10"
              >
                <PlusCircle size={18} /> Ajouter un produit
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Stripe Connect</p>
                <h3 className="text-lg font-semibold text-white">Statut des paiements</h3>
                <p className="text-sm text-slate-400">
                  Active le tunnel de paiement sécurisé Stripe pour encaisser les commandes et laisser SkateConnect appliquer
                  sa commission ({defaultCommissionRate != null ? `${(defaultCommissionRate * 100).toFixed(1)} %` : '10 % par défaut'}).
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  stripeAccountReady
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                }`}
              >
                {stripeAccountReady ? 'Connecté' : 'Connexion requise'}
              </span>
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              {stripeAccountReady ? (
                <>
                  <p>
                    Compte Stripe :{' '}
                    <code className="rounded bg-slate-800/80 px-2 py-1 text-xs text-slate-100">
                      {stripeAccountId ?? 'non défini'}
                    </code>
                  </p>
                  <p>
                    Les paiements sont actifs et les commissions sont automatiquement déduites avant virement vers ton compte
                    Stripe.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Connecte-toi pour générer ton compte Express et compléter l'onboarding réglementaire. Tu pourras encaisser
                    les commandes dès validation par Stripe.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleStripeOnboarding}
                      disabled={isRequestingStripeLink}
                      className="inline-flex items-center gap-2 rounded-full border border-orange-500/70 px-4 py-2 text-sm text-orange-100 hover:bg-orange-500/10 disabled:opacity-50"
                    >
                      {isRequestingStripeLink ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          Génération...
                        </>
                      ) : (
                        <>
                          <Store size={16} />
                          Connecter Stripe
                        </>
                      )}
                    </button>
                    {stripeSetupError && <p className="text-xs text-rose-300">{stripeSetupError}</p>}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Ventes cumulées</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formatRevenue(shopTotals.revenueCents)}</p>
                <p className="mt-1 text-xs text-slate-400">{shopTotals.orders} commandes confirmées</p>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Taux de conversion</p>
                <p className="mt-2 text-2xl font-semibold text-white">{shopTotals.conversionRate.toFixed(2)} %</p>
                <p className="mt-1 text-xs text-slate-400">{shopTotals.views.toLocaleString('fr-FR')} vues produit</p>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Ajouts au panier</p>
                <p className="mt-2 text-2xl font-semibold text-white">{shopTotals.carts.toLocaleString('fr-FR')}</p>
                <p className="mt-1 text-xs text-slate-400">Suivis des intentions d'achat</p>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Unités vendues</p>
                <p className="mt-2 text-2xl font-semibold text-white">{shopTotals.units.toLocaleString('fr-FR')}</p>
                <p className="mt-1 text-xs text-slate-400">Stock restant mis à jour en temps réel</p>
              </div>
            </div>
            {shopLastUpdatedLabel && (
              <p className="text-xs text-slate-500">Dernière synchronisation : {shopLastUpdatedLabel}</p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Historique des performances</h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">7 derniers points</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                {recentShopHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">Pas encore de données enregistrées sur la boutique.</p>
                ) : (
                  <table className="min-w-full text-left text-xs text-slate-300">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Vues</th>
                        <th className="pb-2 pr-4">Paniers</th>
                        <th className="pb-2 pr-4">Commandes</th>
                        <th className="pb-2 pr-4">Unités</th>
                        <th className="pb-2">CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentShopHistory.map((entry) => (
                        <tr key={entry.metricDate} className="border-t border-slate-800/60">
                          <td className="py-2 pr-4 text-slate-200">
                            {new Date(entry.metricDate).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-2 pr-4">{entry.views.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-4">{entry.carts.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-4">{entry.orders.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-4">{entry.units.toLocaleString('fr-FR')}</td>
                          <td className="py-2 text-slate-200">{formatRevenue(entry.revenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Export & CRM</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Utilise tes clés API existantes avec le scope <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">shop:analytics</code>{' '}
                  pour synchroniser les KPI vers ton CRM ou outil BI.
                </p>
              </div>
              {shopAnalyticsExportUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-3">
                    <pre className="whitespace-pre-wrap text-xs text-slate-300">
{`curl "${shopAnalyticsExportUrl}" \
  -H "apikey: VOTRE_CLE_API" \
  -H "Authorization: Bearer VOTRE_CLE_API"`}
                    </pre>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(shopAnalyticsExportUrl);
                          } else {
                            const textarea = document.createElement('textarea');
                            textarea.value = shopAnalyticsExportUrl;
                            textarea.setAttribute('readonly', '');
                            textarea.style.position = 'absolute';
                            textarea.style.left = '-9999px';
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                          }
                          setShopCopyFeedback('Endpoint API copié.');
                        } catch (err) {
                          console.error('Unable to copy shop analytics endpoint', err);
                          setShopCopyFeedback('Impossible de copier le lien.');
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
                    >
                      <Copy size={16} /> Copier le endpoint
                    </button>
                    <span className="text-xs text-slate-500">
                      Inclure l'en-tête{' '}
                      <code className="rounded bg-slate-800 px-1 py-0.5">apikey: &lt;clé&gt;</code>
                    </span>
                  </div>
                  {shopCopyFeedback && <p className="text-xs text-emerald-300">{shopCopyFeedback}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Connecte-toi avec un compte sponsor pour générer l'endpoint d'export.</p>
              )}
            </div>
          </div>

          {lowStockItems.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100">
              <h3 className="text-sm font-semibold">Stock critique</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {lowStockItems.map((item) => (
                  <li key={item.id}>
                    {item.name} — <span className="font-semibold">{item.stock}</span> unités restantes
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {shopItems.length === 0 ? (
              <div className="md:col-span-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-center text-slate-300">
                Aucun produit listé pour l'instant. Lance ta première offre pour activer la boutique.
              </div>
            ) : (
              shopItems.map((item) => {
                const analyticsByItem = perItemAnalytics[item.id];
                const revenue = formatRevenue(analyticsByItem?.revenueCents ?? 0, item.currency);
                const variantsForItem = shopVariants.filter((variant) => variant.item_id === item.id);
                const couponsForItem = shopCoupons.filter((coupon) => coupon.item_id === item.id);
                const bundlesForItem = shopBundles.filter((bundle) => bundle.primary_item_id === item.id);
                return (
                  <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                          <p className="text-xs uppercase tracking-widest text-slate-500">
                            {item.is_active ? 'Actif' : 'En pause'}
                          </p>
                          {item.stock <= 5 && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-2 py-0.5 text-[11px] text-amber-200">
                              <Tag size={12} /> Stock bas
                            </span>
                          )}
                        </div>
                        <span className="text-base font-medium text-slate-200">
                          {(item.price_cents / 100).toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: item.currency,
                        })}
                      </span>
                    </div>
                    {item.description && <p className="text-sm text-slate-300">{item.description}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      <span>Stock : {item.stock}</span>
                      {item.image_url && (
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                        >
                          Aperçu visuel
                        </a>
                      )}
                    </div>
                    <div className="grid gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-300 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Vues</p>
                        <p className="text-sm text-white">
                          {analyticsByItem ? analyticsByItem.views.toLocaleString('fr-FR') : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Ajouts panier</p>
                        <p className="text-sm text-white">
                          {analyticsByItem ? analyticsByItem.carts.toLocaleString('fr-FR') : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Commandes</p>
                        <p className="text-sm text-white">
                          {analyticsByItem ? analyticsByItem.orders.toLocaleString('fr-FR') : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Conversion</p>
                        <p className="text-sm text-white">{analyticsByItem ? `${analyticsByItem.conversionRate.toFixed(2)} %` : '0.00 %'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">Chiffre d'affaires</p>
                        <p className="text-sm text-white">{revenue}</p>
                        {analyticsByItem?.lastMetricDate && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            MAJ : {new Date(analyticsByItem.lastMetricDate).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <details className="rounded-xl border border-slate-800 bg-slate-950/40" open={variantsForItem.length > 0}>
                        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm text-slate-200">
                          <span>Variantes ({variantsForItem.length})</span>
                          <span className="text-xs text-slate-500">Stocks dédiés et tarifs différenciés</span>
                        </summary>
                        <div className="overflow-x-auto px-4 py-3">
                          {variantsForItem.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucune variante pour ce produit.</p>
                          ) : (
                            <table className="min-w-full text-left text-xs text-slate-300">
                              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="pb-2 pr-3">Nom</th>
                                  <th className="pb-2 pr-3">SKU</th>
                                  <th className="pb-2 pr-3">Stock</th>
                                  <th className="pb-2 pr-3">Prix</th>
                                  <th className="pb-2 pr-3">Fenêtre</th>
                                  <th className="pb-2">Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {variantsForItem.map((variant) => (
                                  <tr key={variant.id} className="border-t border-slate-800/60">
                                    <td className="py-2 pr-3 text-slate-200">
                                      <div className="flex flex-col">
                                        <span>{variant.name}</span>
                                        <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                          {[variant.size, variant.color].filter(Boolean).join(' · ') || '—'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3">{variant.sku ?? '—'}</td>
                                    <td className="py-2 pr-3">{variant.stock}</td>
                                    <td className="py-2 pr-3">
                                      {variant.price_cents != null
                                        ? formatRevenue(variant.price_cents, item.currency)
                                        : '—'}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {variant.availability_start || variant.availability_end
                                        ? `${formatDateTime(variant.availability_start)} → ${formatDateTime(variant.availability_end)}`
                                        : '—'}
                                    </td>
                                    <td className="py-2 text-slate-200">
                                      {variant.is_active ? 'Active' : 'En pause'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </details>

                      <details className="rounded-xl border border-slate-800 bg-slate-950/40" open={couponsForItem.length > 0}>
                        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm text-slate-200">
                          <span>Codes promo ({couponsForItem.length})</span>
                          <span className="text-xs text-slate-500">Suivi des remises actives</span>
                        </summary>
                        <div className="overflow-x-auto px-4 py-3">
                          {couponsForItem.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucun code promotionnel configuré.</p>
                          ) : (
                            <table className="min-w-full text-left text-xs text-slate-300">
                              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="pb-2 pr-3">Code</th>
                                  <th className="pb-2 pr-3">Type</th>
                                  <th className="pb-2 pr-3">Valeur</th>
                                  <th className="pb-2 pr-3">Min.</th>
                                  <th className="pb-2 pr-3">Max</th>
                                  <th className="pb-2 pr-3">Utilisations</th>
                                  <th className="pb-2 pr-3">Fenêtre</th>
                                  <th className="pb-2">Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {couponsForItem.map((coupon) => (
                                  <tr key={coupon.id} className="border-t border-slate-800/60">
                                    <td className="py-2 pr-3 text-slate-200">{coupon.code}</td>
                                    <td className="py-2 pr-3">{coupon.discount_type === 'percentage' ? '% remise' : 'Montant fixe'}</td>
                                    <td className="py-2 pr-3">
                                      {coupon.discount_type === 'percentage'
                                        ? `${coupon.discount_value}%`
                                        : formatRevenue(coupon.discount_value, item.currency)}
                                    </td>
                                    <td className="py-2 pr-3">{coupon.minimum_quantity}</td>
                                    <td className="py-2 pr-3">{coupon.max_uses ?? '∞'}</td>
                                    <td className="py-2 pr-3">{coupon.usage_count}</td>
                                    <td className="py-2 pr-3">
                                      {coupon.starts_at || coupon.expires_at
                                        ? `${formatDateTime(coupon.starts_at)} → ${formatDateTime(coupon.expires_at)}`
                                        : '—'}
                                    </td>
                                    <td className="py-2 text-slate-200">{coupon.is_active ? 'Actif' : 'Archivé'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </details>

                      <details className="rounded-xl border border-slate-800 bg-slate-950/40" open={bundlesForItem.length > 0}>
                        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm text-slate-200">
                          <span>Bundles ({bundlesForItem.length})</span>
                          <span className="text-xs text-slate-500">Packs incluant ce produit</span>
                        </summary>
                        <div className="overflow-x-auto px-4 py-3">
                          {bundlesForItem.length === 0 ? (
                            <p className="text-xs text-slate-500">Aucun bundle n'inclut ce produit.</p>
                          ) : (
                            <table className="min-w-full text-left text-xs text-slate-300">
                              <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="pb-2 pr-3">Nom</th>
                                  <th className="pb-2 pr-3">Prix</th>
                                  <th className="pb-2 pr-3">Produits</th>
                                  <th className="pb-2 pr-3">Fenêtre</th>
                                  <th className="pb-2">Statut</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bundlesForItem.map((bundle) => {
                                  const productsLabel = bundle.items
                                    .map((bundleItem) => shopItemsById.get(bundleItem.item_id)?.name ?? 'Produit inconnu')
                                    .join(', ');
                                  return (
                                    <tr key={bundle.id} className="border-t border-slate-800/60">
                                      <td className="py-2 pr-3 text-slate-200">{bundle.name}</td>
                                      <td className="py-2 pr-3">{formatRevenue(bundle.price_cents, bundle.currency)}</td>
                                      <td className="py-2 pr-3 text-slate-200">{productsLabel || '—'}</td>
                                      <td className="py-2 pr-3">
                                        {bundle.available_from || bundle.available_until
                                          ? `${formatDateTime(bundle.available_from)} → ${formatDateTime(bundle.available_until)}`
                                          : '—'}
                                      </td>
                                      <td className="py-2 text-slate-200">{bundle.is_active ? 'Actif' : 'En pause'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </details>
                    </div>

                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openEditShopItemModal(item)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:border-slate-400 hover:text-white"
                    >
                      <Pencil size={16} /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => updateShopItemAvailability(item.id, !item.is_active)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                        item.is_active
                          ? 'border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10'
                          : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item.is_active ? 'Mettre en pause' : 'Réactiver'}
                    </button>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderApiKeys = () => (
    <div className="space-y-8">
      {!permissions.canManageApiKeys ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-300">
          Les clés API sont réservées aux partenaires Enterprise.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Générer une nouvelle clé</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm text-slate-300">
                Nom interne
                <input
                  className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                  value={apiKeyName}
                  onChange={(event) => setApiKeyName(event.target.value)}
                  placeholder="Activation Q4 retail"
                />
              </label>
              <fieldset className="flex flex-col gap-2 text-sm text-slate-300">
                <legend className="font-medium text-slate-200">Scopes autorisés</legend>
                {availableScopes.map((scope) => {
                  const checked = apiKeyScopes.includes(scope.id);
                  return (
                    <label key={scope.id} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setApiKeyScopes((current) =>
                            checked ? current.filter((value) => value !== scope.id) : [...current, scope.id],
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                      />
                      {scope.label}
                    </label>
                  );
                })}
              </fieldset>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateApiKey}
                disabled={isCreatingKey || apiKeyName.trim().length === 0 || apiKeyScopes.length === 0}
                className="inline-flex items-center gap-2 rounded-full border border-sky-500/70 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {isCreatingKey ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer une clé'
                )}
              </button>
              {createdKey && (
                <span className="text-xs text-emerald-300">
                  Copie la clé en lieu sûr : <code className="font-mono text-emerald-200">{createdKey}</code>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70">
            <div className="border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Clés existantes</h3>
              <span className="text-xs uppercase tracking-widest text-slate-500">{apiKeys.length} clé(s)</span>
            </div>
            <ul className="divide-y divide-slate-800/80">
              {apiKeys.length === 0 ? (
                <li className="px-6 py-6 text-sm text-slate-300">Aucune clé active.</li>
              ) : (
                apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{apiKey.name}</p>
                      <p className="text-xs text-slate-500">
                        Préfixe : {apiKey.key_prefix}•••• · Scopes : {apiKey.scopes.join(', ') || 'aucun'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs uppercase tracking-widest ${
                        apiKey.status === 'active' ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                      >
                        {apiKey.status === 'active' ? 'active' : 'révoquée'}
                      </span>
                      {apiKey.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => revokeApiKey(apiKey.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                        >
                          <X size={14} /> Révoquer
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );

  if (!isSponsorAccount) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-200">
        <h2 className="text-3xl font-semibold mb-4">Accès sponsor requis</h2>
        <p className="text-slate-400">
          Connecte-toi avec un compte sponsor pour accéder au cockpit de pilotage des campagnes.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Sponsor cockpit</p>
              <h1 className="text-3xl font-semibold text-white mt-2">Pilotage des activations</h1>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
            >
              <RefreshCw size={16} />
              Synchroniser
            </button>
          </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-6 py-4 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <nav className="flex flex-wrap gap-3">
          {viewDefinitions.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? 'border-sky-500/80 bg-sky-500/10 text-sky-100 shadow-[0_0_20px_rgba(14,165,233,0.25)]'
                    : 'border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {view.label}
              </button>
            );
          })}
        </nav>

          <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
            {activeView === 'overview' && renderOverview()}
            {activeView === 'planner' && (
              <SponsorPlanner
                challenges={opportunities.challenges}
                events={opportunities.events}
                calls={opportunities.calls}
                currentUserId={profile?.id ?? null}
                readOnly={!permissions.canManageOpportunities}
                loading={loading}
                onStatusChange={
                  permissions.canManageOpportunities ? handlePlannerStatusChange : undefined
                }
                onOwnerChange={
                  permissions.canManageOpportunities ? handlePlannerOwnerChange : undefined
                }
              />
            )}
            {activeView === 'opportunities' && <SponsorOpportunitiesView />}
            {activeView === 'spotlights' && renderSpotlights()}
            {activeView === 'shop' && renderShop()}
            {activeView === 'api-keys' && renderApiKeys()}
          </div>
        </div>
      </div>
      {isSpotlightModalOpen && (
        <SponsorSpotlightModal
          mode={spotlightModalMode}
          spotlight={spotlightBeingEdited ?? undefined}
          onClose={closeSpotlightModal}
          onSubmit={handleSpotlightSubmit}
        />
      )}
      {isShopModalOpen && (
        <SponsorShopItemModal
          mode={shopModalMode}
          item={shopItemBeingEdited ?? undefined}
          onClose={closeShopItemModal}
          onSubmit={handleShopItemSubmit}
        />
      )}
    </div>
  );
}
