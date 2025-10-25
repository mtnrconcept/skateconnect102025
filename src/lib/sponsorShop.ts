import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type {
  SponsorShopAnalyticsHistoryPoint,
  SponsorShopAnalyticsPerItem,
  SponsorShopAnalyticsSummary,
  SponsorShopAnalyticsTotals,
  SponsorShopItem,
  SponsorShopItemStat,
} from '../types';

export interface ShopItemPayload {
  sponsor_id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  currency?: string;
  stock?: number;
  is_active?: boolean;
  image_url?: string | null;
  metadata?: Record<string, string | number> | null;
}

function missingShopTableError(): Error {
  return new Error(
    'La table Supabase "sponsor_shop_items" est introuvable. Exécute les migrations sponsor ou expose la vue adéquate.',
  );
}

export async function fetchSponsorShopItems(sponsorId: string): Promise<SponsorShopItem[]> {
  const rows = await withTableFallback<SponsorShopItem[] | null>(
    supabase
      .from('sponsor_shop_items')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('updated_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_shop_items table is missing. Returning an empty shop inventory.');
      },
    },
  );

  return (rows ?? []) as SponsorShopItem[];
}

export async function createSponsorShopItem(payload: ShopItemPayload): Promise<SponsorShopItem> {
  const { data, error } = await supabase
    .from('sponsor_shop_items')
    .insert({
      sponsor_id: payload.sponsor_id,
      name: payload.name,
      description: payload.description ?? '',
      price_cents: payload.price_cents,
      currency: payload.currency ?? 'EUR',
      stock: payload.stock ?? 0,
      is_active: payload.is_active ?? true,
      image_url: payload.image_url ?? null,
      metadata: payload.metadata ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingShopTableError();
    }
    throw error;
  }

  return data as SponsorShopItem;
}

export async function updateSponsorShopItem(
  id: string,
  updates: Partial<Omit<SponsorShopItem, 'id' | 'sponsor_id' | 'created_at'>>,
): Promise<SponsorShopItem> {
  const { data, error } = await supabase
    .from('sponsor_shop_items')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingShopTableError();
    }
    throw error;
  }

  return data as SponsorShopItem;
}

function createMutableTotals() {
  return {
    views: 0,
    carts: 0,
    orders: 0,
    units: 0,
    revenueCents: 0,
  } satisfies Omit<SponsorShopAnalyticsTotals, 'conversionRate'>;
}

function toAnalyticsTotals({
  views,
  carts,
  orders,
  units,
  revenueCents,
}: ReturnType<typeof createMutableTotals>): SponsorShopAnalyticsTotals {
  const conversionRate = views > 0 ? Number(((orders / views) * 100).toFixed(2)) : 0;
  return { views, carts, orders, units, revenueCents, conversionRate };
}

export async function fetchSponsorShopItemStats(sponsorId: string): Promise<SponsorShopItemStat[]> {
  const rows = await withTableFallback<SponsorShopItemStat[] | null>(
    supabase
      .from('sponsor_shop_item_stats')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('metric_date', { ascending: false })
      .limit(365),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_shop_item_stats table is missing. Returning empty analytics history.');
      },
    },
  );

  return (rows ?? []) as SponsorShopItemStat[];
}

export function buildShopAnalyticsSummary(rows: SponsorShopItemStat[]): SponsorShopAnalyticsSummary {
  const totals = createMutableTotals();
  const perItem = new Map<string, { totals: ReturnType<typeof createMutableTotals>; lastMetricDate: string | null }>();
  const historyMap = new Map<string, ReturnType<typeof createMutableTotals>>();
  let updatedAt: string | null = null;

  for (const row of rows) {
    totals.views += Number(row.views_count ?? 0);
    totals.carts += Number(row.cart_additions ?? 0);
    totals.orders += Number(row.orders_count ?? 0);
    totals.units += Number(row.units_sold ?? 0);
    totals.revenueCents += Number(row.revenue_cents ?? 0);

    const itemEntry = perItem.get(row.item_id) ?? {
      totals: createMutableTotals(),
      lastMetricDate: null,
    };

    itemEntry.totals.views += Number(row.views_count ?? 0);
    itemEntry.totals.carts += Number(row.cart_additions ?? 0);
    itemEntry.totals.orders += Number(row.orders_count ?? 0);
    itemEntry.totals.units += Number(row.units_sold ?? 0);
    itemEntry.totals.revenueCents += Number(row.revenue_cents ?? 0);
    if (!itemEntry.lastMetricDate || row.metric_date > itemEntry.lastMetricDate) {
      itemEntry.lastMetricDate = row.metric_date;
    }
    perItem.set(row.item_id, itemEntry);

    const historyEntry = historyMap.get(row.metric_date) ?? createMutableTotals();
    historyEntry.views += Number(row.views_count ?? 0);
    historyEntry.carts += Number(row.cart_additions ?? 0);
    historyEntry.orders += Number(row.orders_count ?? 0);
    historyEntry.units += Number(row.units_sold ?? 0);
    historyEntry.revenueCents += Number(row.revenue_cents ?? 0);
    historyMap.set(row.metric_date, historyEntry);

    if (!updatedAt || row.updated_at > updatedAt) {
      updatedAt = row.updated_at;
    }
  }

  const history: SponsorShopAnalyticsHistoryPoint[] = Array.from(historyMap.entries())
    .sort(([dateA], [dateB]) => (dateA < dateB ? -1 : dateA > dateB ? 1 : 0))
    .map(([metricDate, entry]) => ({ metricDate, ...toAnalyticsTotals(entry) }));

  const perItemSummary: Record<string, SponsorShopAnalyticsPerItem> = {};
  for (const [itemId, entry] of perItem.entries()) {
    perItemSummary[itemId] = {
      itemId,
      lastMetricDate: entry.lastMetricDate,
      ...toAnalyticsTotals(entry.totals),
    };
  }

  return {
    updatedAt,
    totals: toAnalyticsTotals(totals),
    history,
    perItem: perItemSummary,
  } satisfies SponsorShopAnalyticsSummary;
}
