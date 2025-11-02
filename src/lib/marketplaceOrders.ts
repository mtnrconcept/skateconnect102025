import { supabase, isSupabaseConfigured } from './supabase';
import { isSchemaMissing } from './postgrest';

export interface MarketplaceOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  quantity: number;
  currency: string;
  subtotal_cents: number | null;
  shipping_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  commission_cents: number | null;
  net_amount_cents: number | null;
  shipping_carrier: string | null;
  shipping_tracking: string | null;
  shipping_label_url: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export async function createMarketplaceCheckout(params: { listingId: string; quantity?: number; successUrl?: string; cancelUrl?: string; buyerEmail?: string | null }): Promise<{ sessionId: string; url: string | null; orderId: string | null }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase non configuré');
  const { data, error } = await supabase.functions.invoke('marketplace-checkout', { body: params });
  if (error) throw new Error(error.message ?? 'Checkout indisponible');
  return (data ?? {}) as { sessionId: string; url: string | null; orderId: string | null };
}

export async function fetchBuyerOrders(userId: string): Promise<MarketplaceOrder[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isSchemaMissing(error)) return [];
      throw error;
    }
    return (data ?? []) as MarketplaceOrder[];
  } catch {
    return [];
  }
}

export async function fetchSellerOrders(userId: string): Promise<MarketplaceOrder[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isSchemaMissing(error)) return [];
      throw error;
    }
    return (data ?? []) as MarketplaceOrder[];
  } catch {
    return [];
  }
}

export async function requestShippingLabel(orderId: string): Promise<{ tracking: string; labelUrl: string } | null> {
  if (!isSupabaseConfigured()) return { tracking: `TRK-${orderId.slice(0,6)}`, labelUrl: '#' };
  const { data, error } = await supabase.functions.invoke('shipping-label', { body: { orderId, carrier: 'sendcloud' } });
  if (error) throw new Error(error.message ?? 'Erreur étiquette');
  return data as { tracking: string; labelUrl: string };
}

