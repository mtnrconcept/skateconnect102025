import { supabase, isSupabaseConfigured } from './supabase';
import { isSchemaMissing } from './postgrest';
import type { ShopFrontItem, ShopFrontSponsor, ShopFrontVariant } from '../types';
import {
  getFallbackCatalog,
  getFallbackShopItem,
  getFallbackVariantCheckoutUrl,
} from '../data/shopCatalog';

interface RawSponsorBranding {
  brand_name?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
}

interface RawShopItem {
  id: string;
  sponsor_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock: number | null;
  is_active: boolean;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  available_from: string | null;
  available_until: string | null;
  sponsor: {
    id: string;
    display_name: string | null;
    sponsor_branding: RawSponsorBranding | null;
    stripe_account_ready: boolean | null;
  } | null;
  variants?: Array<{
    id: string;
    name: string;
    size: string | null;
    color: string | null;
    price_cents: number | null;
    stock: number | null;
    is_active: boolean;
    image_url: string | null;
    availability_start: string | null;
    availability_end: string | null;
  }>;
}

function isWithinWindow(now: Date, start: string | null, end: string | null): boolean {
  if (start && new Date(start) > now) {
    return false;
  }
  if (end && new Date(end) < now) {
    return false;
  }
  return true;
}

function mapSponsor(raw: RawShopItem['sponsor']): ShopFrontSponsor {
  const branding = (raw?.sponsor_branding ?? {}) as RawSponsorBranding;
  return {
    id: raw?.id ?? '',
    displayName: raw?.display_name ?? null,
    brandName: branding.brand_name ?? raw?.display_name ?? null,
    primaryColor: branding.primary_color ?? null,
    secondaryColor: branding.secondary_color ?? null,
    logoUrl: branding.logo_url ?? null,
    stripeReady: Boolean(raw?.stripe_account_ready),
  } satisfies ShopFrontSponsor;
}

function mapVariant(raw: RawShopItem['variants'][number]): ShopFrontVariant {
  return {
    id: raw.id,
    name: raw.name,
    size: raw.size ?? null,
    color: raw.color ?? null,
    priceCents: raw.price_cents ?? null,
    stock: raw.stock ?? null,
    imageUrl: raw.image_url ?? null,
    availabilityStart: raw.availability_start ?? null,
    availabilityEnd: raw.availability_end ?? null,
  } satisfies ShopFrontVariant;
}

export async function fetchPublicShopCatalog(): Promise<ShopFrontItem[]> {
  if (!isSupabaseConfigured()) {
    return getFallbackCatalog();
  }

  try {
    const { data, error } = await supabase
      .from('sponsor_shop_items')
      .select(`
      id,
      sponsor_id,
      name,
      description,
      price_cents,
      currency,
      stock,
      is_active,
      image_url,
      metadata,
      available_from,
      available_until,
      sponsor:profiles!sponsor_shop_items_sponsor_id_fkey(
        id,
        display_name,
        sponsor_branding,
        stripe_account_ready
      ),
      variants:sponsor_shop_item_variants(
        id,
        name,
        size,
        color,
        price_cents,
        stock,
        is_active,
        image_url,
        availability_start,
        availability_end
      )
    `)
    .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isSchemaMissing(error)) {
        console.info('[shopfront] sponsor shop tables unavailable – returning fallback catalog');
        return getFallbackCatalog();
      }
      throw error;
    }

    const now = new Date();

    const mapped = (data ?? [])
      .map((raw) => raw as RawShopItem)
      .filter((raw) => isWithinWindow(now, raw.available_from, raw.available_until))
      .map((raw) => {
        const variants = (raw.variants ?? [])
          .filter((variant) => variant.is_active && isWithinWindow(now, variant.availability_start, variant.availability_end))
          .map(mapVariant);

        const stock = typeof raw.stock === 'number' ? raw.stock : null;
        const hasVariantStock = variants.some((variant) => (variant.stock ?? 0) > 0);
        const isSellable = (stock ?? 0) > 0 || hasVariantStock;
        if (!isSellable) {
          return null;
        }

        return {
          id: raw.id,
          sponsorId: raw.sponsor_id,
          name: raw.name,
          description: raw.description ?? null,
          priceCents: raw.price_cents,
          currency: raw.currency,
          stock,
          imageUrl: raw.image_url ?? null,
          availableFrom: raw.available_from ?? null,
          availableUntil: raw.available_until ?? null,
          metadata: raw.metadata ?? null,
          sponsor: mapSponsor(raw.sponsor),
          variants,
        } satisfies ShopFrontItem;
      })
      .filter((item): item is ShopFrontItem => Boolean(item));

    if (mapped.length === 0) {
      return getFallbackCatalog();
    }

    return mapped;
  } catch (cause) {
    console.error('[shopfront] Unable to load catalog from Supabase, using fallback data', cause);
    return getFallbackCatalog();
  }
}

interface CheckoutResponse {
  sessionId: string;
  url: string | null;
  orderId: string | null;
  mode: 'stripe' | 'external';
}

interface CheckoutInput {
  itemId: string;
  variantId?: string | null;
  quantity?: number;
  customerEmail?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}

function buildFallbackCheckoutResponse(payload: CheckoutInput): CheckoutResponse {
  const fallbackItem = getFallbackShopItem(payload.itemId);
  if (!fallbackItem) {
    throw new Error('Item not found in fallback catalog');
  }

  const checkoutUrl = getFallbackVariantCheckoutUrl(fallbackItem, payload.variantId);

  return {
    sessionId: `fallback-${fallbackItem.id}`,
    url: checkoutUrl,
    orderId: null,
    mode: 'external',
  } satisfies CheckoutResponse;
}

export async function createShopCheckoutSession(payload: CheckoutInput): Promise<CheckoutResponse> {
  if (!isSupabaseConfigured()) {
    return buildFallbackCheckoutResponse(payload);
  }

  try {
    const { data, error } = await supabase.functions.invoke('shop-checkout', {
      body: payload,
    });

    if (error) {
      throw new Error(error.message ?? 'Unable to start checkout');
    }

    const response = (data ?? { sessionId: '', url: null, orderId: null }) as {
      sessionId: string;
      url: string | null;
      orderId: string | null;
      mode?: 'stripe' | 'external';
    };
    return { ...response, mode: 'stripe' } satisfies CheckoutResponse;
  } catch (cause) {
    console.error('[shopfront] Falling back to Amazon checkout redirect', cause);
    return buildFallbackCheckoutResponse(payload);
  }
}

export interface OrderReceipt {
  id: string;
  status: 'pending' | 'paid' | 'cancelled' | string;
  createdAt: string;
  quantity: number;
  currency: string;
  amounts: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    commissionCents: number;
    netAmountCents: number;
  };
  customer: {
    email: string | null;
    name: string | null;
    city: string | null;
    country: string | null;
  };
  stripe: { sessionId: string; paymentIntentId: string | null };
  item: { id: string; name: string; imageUrl: string | null; currency: string | null } | null;
  variant: { id: string; name: string; size: string | null; color: string | null; imageUrl: string | null } | null;
  sponsor: { id: string | null; displayName: string | null; brandName: string | null };
}

export async function fetchOrderReceipt(sessionId: string): Promise<OrderReceipt> {
  if (!isSupabaseConfigured()) {
    throw new Error('Fonction Supabase indisponible (configuration manquante)');
  }

  const { data, error } = await supabase.functions.invoke('order-lookup', {
    body: { sessionId },
  });
  if (error) {
    throw new Error(error.message ?? 'Impossible de charger le reçu');
  }
  return data as OrderReceipt;
}
