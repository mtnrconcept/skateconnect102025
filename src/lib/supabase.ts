import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement
const importMetaEnv =
  typeof import.meta !== 'undefined' && 'env' in import.meta
    ? (import.meta as ImportMeta).env
    : undefined;

// Variables d'environnement pour la connexion locale ou distante
const supabaseUrl = importMetaEnv?.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const supabaseAnonKey = importMetaEnv?.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseStorageCdnUrl = importMetaEnv?.VITE_SUPABASE_STORAGE_CDN_URL ?? null;

// Configuration du client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window?.localStorage,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Exports des URLs
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_STORAGE_PUBLIC_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public`
  : '';
export const SUPABASE_STORAGE_CDN_URL = supabaseStorageCdnUrl;

// Vérification de la configuration
export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Applique un token d'accès à la session Supabase
 * @param token - Le token d'accès JWT ou null pour se déconnecter
 * @param refreshToken - Le refresh token (optionnel)
 */
export async function applySupabaseAccessToken(
  token: string | null,
  refreshToken?: string
) {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase n\'est pas configuré');
    return;
  }

  if (!token) {
    await supabase.auth.signOut();
    return;
  }

  try {
    if (!refreshToken) {
      // Si pas de refresh token, définir manuellement le header
      console.log('Application du token sans refresh token');
      return;
    }

    // Avec refresh token, utiliser setSession
    const { data, error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Erreur lors de l\'application du token:', error);
      throw error;
    }

    console.log('Session établie avec succès');
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
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  
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
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  
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

// Log de la configuration au démarrage
if (typeof window !== 'undefined') {
  console.log('🔧 Configuration Supabase:', {
    url: supabaseUrl,
    isLocal: supabaseUrl.includes('localhost'),
    hasKey: Boolean(supabaseAnonKey),
  });
}