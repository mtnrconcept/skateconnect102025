import type { SponsorApiKey } from '../types';
import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';

export interface CreateSponsorApiKeyParams {
  sponsorId: string;
  name: string;
  scopes: string[];
}

const API_KEY_LENGTH = 48;
const KEY_PREFIX_LENGTH = 8;

function generateApiKey(length = API_KEY_LENGTH): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint32Array(length);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is unavailable in this environment.');
  }
  globalThis.crypto.getRandomValues(randomValues);
  let key = '';
  for (let i = 0; i < length; i += 1) {
    key += alphabet[randomValues[i] % alphabet.length];
  }
  return key;
}

async function hashKey(rawKey: string): Promise<string> {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) {
    throw new Error('Secure hashing is unavailable in this environment.');
  }
  const encoder = new TextEncoder();
  const digest = await cryptoApi.digest('SHA-256', encoder.encode(rawKey));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function missingApiKeyTableError(): Error {
  return new Error(
    'La table Supabase "sponsor_api_keys" est introuvable. Exécute les migrations sponsor ou expose la vue adéquate.',
  );
}

export async function fetchSponsorApiKeys(sponsorId: string): Promise<SponsorApiKey[]> {
  const rows = await withTableFallback<SponsorApiKey[] | null>(
    supabase
      .from('sponsor_api_keys')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_api_keys table is missing. Returning an empty API key list.');
      },
    },
  );

  return (rows ?? []) as SponsorApiKey[];
}

export async function createSponsorApiKey(
  params: CreateSponsorApiKeyParams,
): Promise<{ key: string; record: SponsorApiKey }> {
  const key = generateApiKey();
  const keyPrefix = key.substring(0, KEY_PREFIX_LENGTH);
  const keyHash = await hashKey(key);

  const { data, error } = await supabase
    .from('sponsor_api_keys')
    .insert({
      sponsor_id: params.sponsorId,
      name: params.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: params.scopes,
    })
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingApiKeyTableError();
    }
    throw error;
  }

  return { key, record: data as SponsorApiKey };
}

export async function revokeSponsorApiKey(id: string): Promise<SponsorApiKey> {
  const { data, error } = await supabase
    .from('sponsor_api_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingApiKeyTableError();
    }
    throw error;
  }

  return data as SponsorApiKey;
}
