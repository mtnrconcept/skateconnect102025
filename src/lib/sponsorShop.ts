import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type { SponsorShopItem } from '../types';

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
