import { supabase, isSupabaseConfigured } from './supabase';

export type MarketplaceCategory =
  | 'boards'
  | 'completes'
  | 'wheels'
  | 'trucks'
  | 'bearings'
  | 'protection'
  | 'clothing'
  | 'shoes'
  | 'accessories'
  | 'other';

export type MarketplaceCondition = 'new' | 'like-new' | 'used' | 'for-parts';

export interface MarketplaceListing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  shipping_available: boolean;
  city: string | null;
  country: string | null;
  image_url: string | null;
  attributes?: Record<string, unknown> | null;
  created_at: string;
  status: 'active' | 'sold' | 'archived';
}

const LS_KEY = 'shredloc:marketplace:listings';

function loadLocal(): MarketplaceListing[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as MarketplaceListing[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(items: MarketplaceListing[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* noop */
  }
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  if (!isSupabaseConfigured()) {
    return loadLocal().filter((x) => x.status === 'active');
  }
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MarketplaceListing[];
  } catch (cause) {
    console.warn('[marketplace] falling back to local listings', cause);
    return loadLocal().filter((x) => x.status === 'active');
  }
}

export async function fetchListingById(id: string): Promise<MarketplaceListing | null> {
  if (!isSupabaseConfigured()) {
    const item = loadLocal().find((l) => l.id === id) ?? null;
    return item ?? null;
  }
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as MarketplaceListing) ?? null;
  } catch (cause) {
    console.warn('[marketplace] fetch by id failed, fallback local', cause);
    const item = loadLocal().find((l) => l.id === id) ?? null;
    return item ?? null;
  }
}

export async function createMarketplaceListing(
  payload: Omit<MarketplaceListing, 'id' | 'created_at' | 'status'> & { status?: MarketplaceListing['status'] },
): Promise<MarketplaceListing> {
  const item: MarketplaceListing = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: payload.status ?? 'active',
    ...payload,
  };

  if (!isSupabaseConfigured()) {
    const current = loadLocal();
    saveLocal([item, ...current]);
    return item;
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      id: item.id,
      user_id: item.user_id,
      title: item.title,
      description: item.description,
      price_cents: item.price_cents,
      currency: item.currency,
      category: item.category,
      condition: item.condition,
      shipping_available: item.shipping_available,
      city: item.city,
      country: item.country,
      image_url: item.image_url,
      attributes: item.attributes ?? {},
      created_at: item.created_at,
      status: item.status,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[marketplace] insert failed, using local', error);
    const current = loadLocal();
    saveLocal([item, ...current]);
    return item;
  }

  return (data ?? item) as MarketplaceListing;
}

// Categories source pour le front
export const MARKETPLACE_CATEGORIES: Array<{ id: MarketplaceCategory; label: string }> = [
  { id: 'boards', label: 'Planches' },
  { id: 'completes', label: 'Complets' },
  { id: 'wheels', label: 'Roues' },
  { id: 'trucks', label: 'Trucks' },
  { id: 'bearings', label: 'Roulements' },
  { id: 'protection', label: 'Protections' },
  { id: 'clothing', label: 'VÃªtements' },
  { id: 'shoes', label: 'Chaussures' },
  { id: 'accessories', label: 'Accessoires' },
  { id: 'other', label: 'Autre' },
];

// Favoris (local)
const FAV_KEY = 'shredloc:marketplace:favorites';
export function getFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
export function toggleFavorite(id: string): string[] {
  const current = new Set(getFavorites());
  if (current.has(id)) current.delete(id);
  else current.add(id);
  const next = Array.from(current);
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

// Sauvegarde de recherches (local)
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  created_at: string;
  user_id?: string;
  alert_email?: boolean;
  alert_push?: boolean;
}
const SAVED_SEARCH_KEY = 'shredloc:marketplace:saved-searches';
export function getSavedSearches(): SavedSearch[] {
  try {
    const raw = window.localStorage.getItem(SAVED_SEARCH_KEY);
    return raw ? (JSON.parse(raw) as SavedSearch[]) : [];
  } catch {
    return [];
  }
}
export function addSavedSearch(name: string, query: string): SavedSearch[] {
  const entry: SavedSearch = { id: crypto.randomUUID(), name, query, created_at: new Date().toISOString() };
  const next = [entry, ...getSavedSearches()].slice(0, 50);
  try { window.localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(next)); } catch {}
  return next;
}
export function removeSavedSearch(id: string): SavedSearch[] {
  const next = getSavedSearches().filter((s) => s.id !== id);
  try { window.localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// DB-backed saved searches (fallback to local when Supabase is not configured)
export async function fetchSavedSearches(userId: string): Promise<SavedSearch[]> {
  if (!isSupabaseConfigured()) {
    return getSavedSearches();
  }
  const { data, error } = await supabase
    .from('marketplace_saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[marketplace] fetchSavedSearches failed, fallback local', error);
    return getSavedSearches();
  }
  return (data ?? []) as unknown as SavedSearch[];
}

export async function createSavedSearch(
  userId: string,
  name: string,
  query: string,
  options?: { alert_email?: boolean; alert_push?: boolean },
): Promise<SavedSearch> {
  if (!isSupabaseConfigured()) {
    const list = addSavedSearch(name, query);
    return list[0]!;
  }
  const { data, error } = await supabase
    .from('marketplace_saved_searches')
    .insert({ user_id: userId, name, query, alert_email: options?.alert_email ?? false, alert_push: options?.alert_push ?? false })
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[marketplace] createSavedSearch failed, using local', error);
    const list = addSavedSearch(name, query);
    return list[0]!;
  }
  return (data as unknown as SavedSearch) ?? { id: crypto.randomUUID(), name, query, created_at: new Date().toISOString(), user_id: userId };
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    removeSavedSearch(id);
    return;
  }
  const { error } = await supabase
    .from('marketplace_saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    console.warn('[marketplace] deleteSavedSearch failed, using local', error);
    removeSavedSearch(id);
  }
}

export async function updateSavedSearch(
  userId: string,
  id: string,
  patch: Partial<Pick<SavedSearch, 'name' | 'query' | 'alert_email' | 'alert_push'>>,
): Promise<SavedSearch | null> {
  if (!isSupabaseConfigured()) {
    const all = getSavedSearches();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const updated = { ...all[idx], ...patch } as SavedSearch;
      const next = [...all];
      next[idx] = updated;
      try { window.localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(next)); } catch {}
      return updated;
    }
    return null;
  }
  const { data, error } = await supabase
    .from('marketplace_saved_searches')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[marketplace] updateSavedSearch failed; falling back to local', error);
    return null;
  }
  return (data as unknown as SavedSearch) ?? null;
}

// Admin listing simple ops
export async function updateListingStatus(id: string, status: MarketplaceListing['status']): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = loadLocal();
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx].status = status;
      saveLocal(items);
    }
    return;
  }
  await supabase.from('marketplace_listings').update({ status }).eq('id', id);
}

export async function deleteListing(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const items = loadLocal().filter((i) => i.id !== id);
    saveLocal(items);
    return;
  }
  await supabase.from('marketplace_listings').delete().eq('id', id);
}

// Listing images (gallery)
const LS_IMAGES_KEY = 'shredloc:marketplace:listing-images';
function loadLocalImages(): Record<string, string[]> {
  try { const raw = window.localStorage.getItem(LS_IMAGES_KEY); return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}; } catch { return {}; }
}
function saveLocalImages(map: Record<string, string[]>): void { try { window.localStorage.setItem(LS_IMAGES_KEY, JSON.stringify(map)); } catch {} }

export async function saveListingImages(listingId: string, urls: string[]): Promise<void> {
  const cleaned = urls.filter(Boolean);
  if (!cleaned.length) return;
  if (!isSupabaseConfigured()) {
    const map = loadLocalImages();
    map[listingId] = cleaned;
    saveLocalImages(map);
    return;
  }
  const rows = cleaned.map((url, i) => ({ listing_id: listingId, url, sort_order: i }));
  const { error } = await supabase.from('marketplace_listing_images').insert(rows);
  if (error) console.warn('[marketplace] saveListingImages insert failed', error);
}

export async function getListingImages(listingId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    const map = loadLocalImages();
    return map[listingId] ?? [];
  }
  const { data, error } = await supabase
    .from('marketplace_listing_images')
    .select('url, sort_order, created_at')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r: any) => r.url as string);
}
