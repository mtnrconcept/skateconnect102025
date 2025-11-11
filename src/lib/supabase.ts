import { supabase as supabaseClient } from './supabaseClient';

const fallbackSupabaseUrl = 'https://stub.supabase.local';
const fallbackSupabaseAnonKey = 'stub-anon-key';

const supabaseUrlEnv = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKeyEnv = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = supabaseUrlEnv ?? fallbackSupabaseUrl;
export const SUPABASE_STORAGE_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public`;
export const SUPABASE_STORAGE_CDN_URL =
  (import.meta.env.VITE_SUPABASE_STORAGE_CDN_URL as string | undefined) ?? null;

const hasSupabaseConfig = Boolean(supabaseUrlEnv && supabaseAnonKeyEnv);

export const isSupabaseConfigured = () => hasSupabaseConfig;

export const supabase = supabaseClient;

/**
 * Applique un token d'accès à la session Supabase
 * @param token - Le token d'accès JWT ou null pour se déconnecter
 * @param refreshToken - Le refresh token (optionnel)
 */
export async function applySupabaseAccessToken(
  token: string | null,
  refreshToken?: string
) {
  if (!hasSupabaseConfig) {
    console.warn('Supabase n\'est pas configuré');
    return;
  }

  if (!token) {
    await supabaseClient.auth.signOut();
    return;
  }

  try {
    // Si pas de refresh token, on essaie juste de définir le header Authorization
    if (!refreshToken) {
      // Méthode alternative: définir manuellement le token dans les headers
      (supabaseClient as any).rest.headers['Authorization'] = `Bearer ${token}`;
      (supabaseClient as any).realtime.accessToken = token;
      return;
    }

    // Avec refresh token, utiliser setSession
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: token,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Erreur lors de l\'application du token:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erreur setSession:', error);
    throw error;
  }
}

/**
 * Récupère la session active
 */
export async function getSession() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  
  if (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    return null;
  }

  return data.session;
}

/**
 * Récupère l'utilisateur actuel
 */
export async function getUser() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getUser();
  
  if (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }

  return data.user;
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}