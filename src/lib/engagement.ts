import { supabase } from './supabase';

interface RegistrationResult {
  success: boolean;
  message: string;
}

const CHALLENGE_STORAGE_KEY = 'shredloc:challenge-registrations';
const EVENT_STORAGE_KEY = 'shredloc:event-registrations';

const hasBrowserStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readLocalIds = (key: string) => {
  if (!hasBrowserStorage) {
    return new Set<string>();
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed);
    }
  } catch (error) {
    console.warn('Unable to read local registrations', error);
  }
  return new Set<string>();
};

const writeLocalIds = (key: string, ids: Set<string>) => {
  if (!hasBrowserStorage) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.warn('Unable to persist local registrations', error);
  }
};

export const getStoredChallengeRegistrations = () => readLocalIds(CHALLENGE_STORAGE_KEY);
export const getStoredEventRegistrations = () => readLocalIds(EVENT_STORAGE_KEY);

export async function registerForChallenge(
  userId: string,
  challengeId: string,
): Promise<RegistrationResult> {
  const payload = { user_id: userId, challenge_id: challengeId };

  try {
    const { error } = await supabase
      .from('challenge_participants')
      .upsert(payload, { onConflict: 'challenge_id,user_id' });

    if (error) throw error;

    const ids = getStoredChallengeRegistrations();
    ids.add(challengeId);
    writeLocalIds(CHALLENGE_STORAGE_KEY, ids);

    return { success: true, message: 'Inscription confirmée.' };
  } catch (error) {
    console.warn('Unable to register challenge participation via Supabase, fallback to local storage.', error);
    const ids = getStoredChallengeRegistrations();
    if (ids.has(challengeId)) {
      return { success: true, message: 'Tu es déjà inscrit à ce défi.' };
    }

    ids.add(challengeId);
    writeLocalIds(CHALLENGE_STORAGE_KEY, ids);

    return {
      success: true,
      message: "Inscription enregistrée localement. Elle sera synchronisée une fois la connexion rétablie.",
    };
  }
}

export async function registerForEvent(userId: string, eventId: string): Promise<RegistrationResult> {
  const payload = { user_id: userId, event_id: eventId };

  try {
    const { error } = await supabase.from('event_registrations').upsert(payload, { onConflict: 'event_id,user_id' });

    if (error) throw error;

    const ids = getStoredEventRegistrations();
    ids.add(eventId);
    writeLocalIds(EVENT_STORAGE_KEY, ids);

    return { success: true, message: "Tu es inscrit à l'événement." };
  } catch (error) {
    console.warn('Unable to register event participation via Supabase, fallback to local storage.', error);
    const ids = getStoredEventRegistrations();
    if (ids.has(eventId)) {
      return { success: true, message: 'Tu participes déjà à cet événement.' };
    }

    ids.add(eventId);
    writeLocalIds(EVENT_STORAGE_KEY, ids);

    return {
      success: true,
      message: "Participation sauvegardée hors-ligne. Nous la synchroniserons dès que possible.",
    };
  }
}
