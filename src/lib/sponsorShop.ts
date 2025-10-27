import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type {
  SponsorShopAnalyticsHistoryPoint,
  SponsorShopAnalyticsPerItem,
  SponsorShopAnalyticsSummary,
  SponsorShopAnalyticsTotals,
  SponsorShopBundle,
  SponsorShopCoupon,
  SponsorShopCouponDiscountType,
  SponsorShopItem,
  SponsorShopItemStat,
  SponsorShopItemVariant,
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
  available_from?: string | null;
  available_until?: string | null;
}

export interface SponsorShopVariantDraft {
  id?: string;
  name: string;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  price_cents?: number | null;
  stock: number;
  is_active: boolean;
  image_url?: string | null;
  availability_start?: string | null;
  availability_end?: string | null;
  metadata?: Record<string, string | number> | null;
}

export interface SponsorShopCouponDraft {
  id?: string;
  code: string;
  description?: string | null;
  discount_type: SponsorShopCouponDiscountType;
  discount_value: number;
  max_uses?: number | null;
  usage_count?: number;
  minimum_quantity?: number;
  is_active: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, string | number> | null;
}

export interface SponsorShopBundleDraft {
  id?: string;
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  available_from?: string | null;
  available_until?: string | null;
  metadata?: Record<string, string | number> | null;
  items: Array<{
    item_id: string;
    quantity: number;
  }>;
}

function missingShopTableError(): Error {
  return new Error(
    'La table Supabase "sponsor_shop_items" est introuvable. Exécute les migrations sponsor ou expose la vue adéquate.',
  );
}

function generateLocalId(prefix: string): string {
  const randomSegment =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11);
  return `${prefix}${randomSegment}`;
}

function buildEphemeralShopItem(payload: ShopItemPayload): SponsorShopItem {
  const now = new Date().toISOString();
  return {
    id: generateLocalId('local-shop-item-'),
    sponsor_id: payload.sponsor_id,
    name: payload.name,
    description: normalizeText(payload.description) ?? null,
    price_cents: payload.price_cents,
    currency: payload.currency ?? 'EUR',
    stock: payload.stock ?? 0,
    is_active: payload.is_active ?? true,
    image_url: normalizeText(payload.image_url) ?? null,
    metadata: (payload.metadata as SponsorShopItem['metadata']) ?? null,
    available_from: payload.available_from ?? null,
    available_until: payload.available_until ?? null,
    created_at: now,
    updated_at: now,
  } satisfies SponsorShopItem;
}

function ensureNonNegative(value: number | null | undefined, message: string): void {
  if (value == null) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(message);
  }
}

function ensureStrictlyPositive(value: number | null | undefined, message: string): void {
  if (value == null) {
    return;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
}

function validateAvailabilityWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  context: string,
): void {
  if (!start || !end) {
    return;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error(`Impossible de valider ${context} : format de date invalide.`);
  }
  if (endDate <= startDate) {
    throw new Error(`La date de fin doit être postérieure à la date de début pour ${context}.`);
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchSponsorShopItems(sponsorId: string): Promise<SponsorShopItem[]> {
  const rows = await withTableFallback<SponsorShopItem[] | null>(
    () =>
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
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (rows ?? []) as SponsorShopItem[];
}

export async function fetchSponsorShopItemVariants(
  sponsorId: string,
): Promise<SponsorShopItemVariant[]> {
  const rows = await withTableFallback<SponsorShopItemVariant[] | null>(
    () =>
      supabase
        .from('sponsor_shop_item_variants')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .order('updated_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_shop_item_variants table is missing. Returning an empty variant inventory.');
      },
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (rows ?? []) as SponsorShopItemVariant[];
}

export async function fetchSponsorShopBundles(sponsorId: string): Promise<SponsorShopBundle[]> {
  type RawBundle = Omit<SponsorShopBundle, 'items'> & {
    items?: Array<{
      item_id: string;
      quantity: number;
      sponsor_id: string;
    }>;
  };

  const rows = await withTableFallback<RawBundle[] | null>(
    () =>
      supabase
        .from('sponsor_shop_bundles')
        .select('*, items:sponsor_shop_bundle_items(item_id, quantity, sponsor_id)')
        .eq('sponsor_id', sponsorId)
        .order('updated_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_shop_bundles table is missing. Returning an empty bundle inventory.');
      },
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (rows ?? []).map((row) => ({
    id: row.id,
    sponsor_id: row.sponsor_id,
    primary_item_id: row.primary_item_id,
    name: row.name,
    description: row.description ?? null,
    price_cents: row.price_cents,
    currency: row.currency,
    is_active: row.is_active,
    metadata: (row.metadata as SponsorShopBundle['metadata']) ?? null,
    available_from: row.available_from ?? null,
    available_until: row.available_until ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          bundle_id: row.id,
          item_id: item.item_id,
          sponsor_id: item.sponsor_id,
          quantity: item.quantity ?? 1,
        }))
      : [],
  }));
}

export async function fetchSponsorShopCoupons(sponsorId: string): Promise<SponsorShopCoupon[]> {
  const rows = await withTableFallback<SponsorShopCoupon[] | null>(
    () =>
      supabase
        .from('sponsor_shop_item_coupons')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .order('updated_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_shop_item_coupons table is missing. Returning an empty coupon inventory.');
      },
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (rows ?? []) as SponsorShopCoupon[];
}

export async function syncSponsorShopItemVariants({
  sponsorId,
  itemId,
  variants,
  variantIdsToDelete = [],
}: {
  sponsorId: string;
  itemId: string;
  variants: SponsorShopVariantDraft[];
  variantIdsToDelete?: string[];
}): Promise<void> {
  for (const variant of variants) {
    if (!variant.name || variant.name.trim().length === 0) {
      throw new Error('Chaque variante doit avoir un nom.');
    }
    ensureNonNegative(variant.price_cents ?? null, 'Le prix d\'une variante ne peut pas être négatif.');
    ensureNonNegative(variant.stock, 'Le stock d\'une variante ne peut pas être négatif.');
    validateAvailabilityWindow(
      variant.availability_start ?? null,
      variant.availability_end ?? null,
      `la variante ${variant.name}`,
    );
  }

  if (variantIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('sponsor_shop_item_variants')
      .delete()
      .in('id', variantIdsToDelete);

    if (deleteError) {
      if (isSchemaMissing(deleteError)) {
        throw missingShopTableError();
      }
      throw deleteError;
    }
  }

  if (variants.length === 0) {
    return;
  }

  const payload = variants.map((variant) => ({
    ...(variant.id ? { id: variant.id } : {}),
    sponsor_id: sponsorId,
    item_id: itemId,
    name: variant.name.trim(),
    size: normalizeText(variant.size ?? null),
    color: normalizeText(variant.color ?? null),
    sku: normalizeText(variant.sku ?? null),
    price_cents: variant.price_cents ?? null,
    stock: variant.stock,
    is_active: variant.is_active,
    image_url: normalizeText(variant.image_url ?? null),
    metadata: variant.metadata ?? null,
    availability_start: variant.availability_start ?? null,
    availability_end: variant.availability_end ?? null,
  }));

  const { error } = await supabase
    .from('sponsor_shop_item_variants')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingShopTableError();
    }
    throw error;
  }
}

export async function syncSponsorShopCoupons({
  sponsorId,
  itemId,
  coupons,
  couponIdsToDelete = [],
}: {
  sponsorId: string;
  itemId: string;
  coupons: SponsorShopCouponDraft[];
  couponIdsToDelete?: string[];
}): Promise<void> {
  for (const coupon of coupons) {
    if (!coupon.code || coupon.code.trim().length === 0) {
      throw new Error('Chaque code promo doit avoir un identifiant.');
    }
    ensureStrictlyPositive(coupon.discount_value, 'La valeur de réduction doit être supérieure à 0.');
    ensureStrictlyPositive(
      coupon.minimum_quantity ?? 1,
      'La quantité minimale pour appliquer le coupon doit être supérieure à 0.',
    );
    ensureStrictlyPositive(
      coupon.max_uses ?? null,
      'Le nombre maximal d\'utilisations doit être strictement positif.',
    );
    validateAvailabilityWindow(
      coupon.starts_at ?? null,
      coupon.expires_at ?? null,
      `le coupon ${coupon.code}`,
    );
  }

  if (couponIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('sponsor_shop_item_coupons')
      .delete()
      .in('id', couponIdsToDelete);

    if (deleteError) {
      if (isSchemaMissing(deleteError)) {
        throw missingShopTableError();
      }
      throw deleteError;
    }
  }

  if (coupons.length === 0) {
    return;
  }

  const payload = coupons.map((coupon) => ({
    ...(coupon.id ? { id: coupon.id } : {}),
    sponsor_id: sponsorId,
    item_id: itemId,
    code: coupon.code.trim(),
    description: normalizeText(coupon.description ?? null),
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_uses: coupon.max_uses ?? null,
    usage_count: coupon.usage_count ?? 0,
    minimum_quantity: coupon.minimum_quantity ?? 1,
    is_active: coupon.is_active,
    starts_at: coupon.starts_at ?? null,
    expires_at: coupon.expires_at ?? null,
    metadata: coupon.metadata ?? null,
  }));

  const { error } = await supabase.from('sponsor_shop_item_coupons').upsert(payload, { onConflict: 'id' });

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingShopTableError();
    }
    throw error;
  }
}

export async function syncSponsorShopBundles({
  sponsorId,
  primaryItemId,
  bundles,
  bundleIdsToDelete = [],
}: {
  sponsorId: string;
  primaryItemId: string;
  bundles: SponsorShopBundleDraft[];
  bundleIdsToDelete?: string[];
}): Promise<void> {
  for (const bundle of bundles) {
    if (!bundle.name || bundle.name.trim().length === 0) {
      throw new Error('Chaque bundle doit avoir un nom.');
    }
    ensureStrictlyPositive(bundle.price_cents, 'Le prix d\'un bundle doit être supérieur à 0.');
    validateAvailabilityWindow(
      bundle.available_from ?? null,
      bundle.available_until ?? null,
      `le bundle ${bundle.name}`,
    );

    if (bundle.items.length === 0) {
      throw new Error('Un bundle doit contenir au moins un produit associé.');
    }

    for (const item of bundle.items) {
      if (!item.item_id) {
        throw new Error('Chaque élément du bundle doit référencer un produit valide.');
      }
      ensureStrictlyPositive(item.quantity, 'La quantité doit être supérieure à 0 pour chaque produit du bundle.');
    }
  }

  if (bundleIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('sponsor_shop_bundles')
      .delete()
      .in('id', bundleIdsToDelete);

    if (deleteError) {
      if (isSchemaMissing(deleteError)) {
        throw missingShopTableError();
      }
      throw deleteError;
    }
  }

  for (const bundle of bundles) {
    const payload = {
      sponsor_id: sponsorId,
      primary_item_id: primaryItemId,
      name: bundle.name.trim(),
      description: normalizeText(bundle.description ?? null),
      price_cents: bundle.price_cents,
      currency: bundle.currency,
      is_active: bundle.is_active,
      metadata: bundle.metadata ?? null,
      available_from: bundle.available_from ?? null,
      available_until: bundle.available_until ?? null,
    };

    let bundleId = bundle.id ?? null;

    if (bundleId) {
      const { error: updateError } = await supabase
        .from('sponsor_shop_bundles')
        .update(payload)
        .eq('id', bundleId);

      if (updateError) {
        if (isSchemaMissing(updateError)) {
          throw missingShopTableError();
        }
        throw updateError;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('sponsor_shop_bundles')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) {
        if (isSchemaMissing(insertError)) {
          throw missingShopTableError();
        }
        throw insertError;
      }
      bundleId = data?.id ?? null;
    }

    if (!bundleId) {
      continue;
    }

    const { error: clearItemsError } = await supabase
      .from('sponsor_shop_bundle_items')
      .delete()
      .eq('bundle_id', bundleId);

    if (clearItemsError) {
      if (isSchemaMissing(clearItemsError)) {
        throw missingShopTableError();
      }
      throw clearItemsError;
    }

    if (bundle.items.length > 0) {
      const itemPayload = bundle.items.map((item) => ({
        bundle_id: bundleId!,
        item_id: item.item_id,
        sponsor_id: sponsorId,
        quantity: item.quantity,
      }));

      const { error: insertItemsError } = await supabase
        .from('sponsor_shop_bundle_items')
        .insert(itemPayload);

      if (insertItemsError) {
        if (isSchemaMissing(insertItemsError)) {
          throw missingShopTableError();
        }
        throw insertItemsError;
      }
    }
  }
}

export async function createSponsorShopItem(payload: ShopItemPayload): Promise<SponsorShopItem> {
  ensureStrictlyPositive(payload.price_cents, 'Le prix doit être supérieur à 0.');
  ensureNonNegative(payload.stock ?? null, 'Le stock ne peut pas être négatif.');
  validateAvailabilityWindow(payload.available_from ?? null, payload.available_until ?? null, 'cet article');

  const normalizedDescription = normalizeText(payload.description) ?? '';
  const normalizedImage = normalizeText(payload.image_url);

  const { data, error } = await supabase
    .from('sponsor_shop_items')
    .insert({
      sponsor_id: payload.sponsor_id,
      name: payload.name,
      description: normalizedDescription,
      price_cents: payload.price_cents,
      currency: payload.currency ?? 'EUR',
      stock: payload.stock ?? 0,
      is_active: payload.is_active ?? true,
      image_url: normalizedImage ?? null,
      metadata: payload.metadata ?? null,
      available_from: payload.available_from ?? null,
      available_until: payload.available_until ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      console.info(
        'Supabase sponsor_shop_items table missing. Returning an ephemeral item for local preview.',
      );
      return buildEphemeralShopItem({
        ...payload,
        description: normalizedDescription || null,
        image_url: normalizedImage ?? null,
      });
    }
    throw error;
  }

  return data as SponsorShopItem;
}

export async function updateSponsorShopItem(
  id: string,
  updates: Partial<Omit<SponsorShopItem, 'id' | 'sponsor_id' | 'created_at'>>,
): Promise<SponsorShopItem> {
  if (updates.price_cents != null) {
    ensureStrictlyPositive(updates.price_cents, 'Le prix doit être supérieur à 0.');
  }
  if (updates.stock != null) {
    ensureNonNegative(updates.stock, 'Le stock ne peut pas être négatif.');
  }
  validateAvailabilityWindow(updates.available_from, updates.available_until, 'cet article');

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
    () =>
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
      retry: { attempts: 2, delayMs: 500 },
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
