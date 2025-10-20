import type { Profile } from '../types';

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
