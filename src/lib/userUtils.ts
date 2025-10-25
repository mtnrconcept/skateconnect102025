import type { Profile } from '../types';
import { supabase } from './supabase.js';

export function getUserInitial(user: Profile | null | undefined, fallback: string = 'U'): string {
  if (!user) return fallback;

  const displayName = user.display_name || user.username || '';
  const trimmed = displayName.trim();

  if (trimmed.length === 0) return fallback;

  return trimmed.charAt(0).toUpperCase();
}

export function getUserDisplayName(user: Profile | null | undefined, fallback: string = 'Utilisateur'): string {
  if (!user) return fallback;

  return user.display_name || user.username || fallback;
}

export async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) {
    return new Map();
  }

  const uniqueIds = Array.from(new Set(ids));
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, Profile>();
  for (const row of data ?? []) {
    const profile = row as Profile;
    map.set(profile.id, profile);
  }

  return map;
}
