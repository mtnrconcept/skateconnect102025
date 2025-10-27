import type { Session } from '@supabase/supabase-js';

const REMEMBER_ME_PREFERENCE_KEY = 'shredloc:auth:remember-me';
const REMEMBERED_SESSION_KEY = 'shredloc:auth:session';

export type PersistedSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
};

const isBrowser = typeof window !== 'undefined';

const getStorage = () => {
  if (!isBrowser) {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.error('Impossible d\'accéder au stockage local :', error);
    return null;
  }
};

export const getRememberMePreference = (): boolean => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  const value = storage.getItem(REMEMBER_ME_PREFERENCE_KEY);
  return value === 'true';
};

export const setRememberMePreference = (value: boolean) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    if (value) {
      storage.setItem(REMEMBER_ME_PREFERENCE_KEY, 'true');
    } else {
      storage.removeItem(REMEMBER_ME_PREFERENCE_KEY);
    }
  } catch (error) {
    console.error('Impossible de mettre à jour la préférence "rester connecté" :', error);
  }
};

export const persistSession = (session: Session | null) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!session?.access_token || !session.refresh_token) {
    storage.removeItem(REMEMBERED_SESSION_KEY);
    return;
  }

  const payload: PersistedSessionPayload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };

  try {
    storage.setItem(REMEMBERED_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Impossible de sauvegarder la session :', error);
  }
};

export const clearPersistedSession = () => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(REMEMBERED_SESSION_KEY);
  } catch (error) {
    console.error('Impossible de nettoyer la session persistée :', error);
  }
};

export const loadPersistedSession = (): PersistedSessionPayload | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(REMEMBERED_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedSessionPayload;
    if (typeof parsed?.access_token === 'string' && typeof parsed?.refresh_token === 'string') {
      return parsed;
    }
  } catch (error) {
    console.error('Impossible de lire la session persistée :', error);
  }

  clearPersistedSession();
  return null;
};
