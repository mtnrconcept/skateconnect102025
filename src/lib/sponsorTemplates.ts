import type { PostgrestError } from '@supabase/supabase-js';
import type { SponsorTemplate, SponsorTemplateAsset, SponsorTemplateType } from '../types';
import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';

export interface CreateSponsorTemplateParams {
  sponsorId: string;
  name: string;
  type: SponsorTemplateType;
  defaultFields: Record<string, unknown>;
  assets?: SponsorTemplateAsset[];
  isPublic?: boolean;
}

export interface UpdateSponsorTemplateParams {
  name?: string;
  defaultFields?: Record<string, unknown>;
  assets?: SponsorTemplateAsset[];
  isPublic?: boolean;
}

export interface DuplicateSponsorTemplateParams {
  templateId: string;
  sponsorId: string;
  name?: string;
}

export interface ImportSponsorTemplateParams {
  shareKey: string;
  sponsorId: string;
  name?: string;
}

const SHARE_KEY_LENGTH = 32;
const SHARE_KEY_PREFIX = 'tmpl_';
const MAX_SHARE_KEY_ATTEMPTS = 5;

function missingSponsorTemplatesTableError(): Error {
  return new Error(
    'La table Supabase "sponsor_templates" est introuvable. Exécute les migrations sponsor ou expose la vue correspondante.',
  );
}

function ensureCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generation is unavailable in this environment.');
  }
  return cryptoApi;
}

function generateShareKey(length = SHARE_KEY_LENGTH): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const cryptoApi = ensureCrypto();
  const randomValues = new Uint32Array(length);
  cryptoApi.getRandomValues(randomValues);
  let key = SHARE_KEY_PREFIX;
  for (let index = 0; index < length; index += 1) {
    key += alphabet[randomValues[index] % alphabet.length];
  }
  return key;
}

function isUniqueViolation(error: PostgrestError | null): boolean {
  return Boolean(error?.code === '23505');
}

export async function listSponsorTemplates(sponsorId: string): Promise<SponsorTemplate[]> {
  const rows = await withTableFallback<SponsorTemplate[] | null>(
    () =>
      supabase
        .from('sponsor_templates')
        .select('*')
        .eq('sponsor_id', sponsorId)
        .order('updated_at', { ascending: false }),
    () => [],
    {
      onMissing: () => {
        console.info('sponsor_templates table is missing. Returning an empty template list.');
      },
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return (rows ?? []) as SponsorTemplate[];
}

export async function getSponsorTemplate(id: string): Promise<SponsorTemplate | null> {
  const row = await withTableFallback<SponsorTemplate | null>(
    () => supabase.from('sponsor_templates').select('*').eq('id', id).maybeSingle(),
    () => null,
    {
      onMissing: () => {
        console.info('sponsor_templates table is missing. Returning null.');
      },
      retry: { attempts: 2, delayMs: 500 },
    },
  );

  return row as SponsorTemplate | null;
}

export async function createSponsorTemplate({
  sponsorId,
  name,
  type,
  defaultFields,
  assets = [],
  isPublic = false,
}: CreateSponsorTemplateParams): Promise<SponsorTemplate> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .insert({
      sponsor_id: sponsorId,
      name,
      type,
      default_fields: defaultFields,
      assets,
      is_public: isPublic,
    })
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }

  return data as SponsorTemplate;
}

export async function updateSponsorTemplate(
  id: string,
  params: UpdateSponsorTemplateParams,
): Promise<SponsorTemplate> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .update({
      ...(params.name ? { name: params.name } : {}),
      ...(params.defaultFields ? { default_fields: params.defaultFields } : {}),
      ...(params.assets ? { assets: params.assets } : {}),
      ...(params.isPublic !== undefined ? { is_public: params.isPublic } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }

  return data as SponsorTemplate;
}

export async function deleteSponsorTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_templates').delete().eq('id', id);

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }
}

export async function duplicateSponsorTemplate({
  templateId,
  sponsorId,
  name,
}: DuplicateSponsorTemplateParams): Promise<SponsorTemplate> {
  const source = await getSponsorTemplate(templateId);

  if (!source) {
    throw new Error('Template introuvable ou inaccessible.');
  }

  return await createSponsorTemplate({
    sponsorId,
    name: name ?? `${source.name} (copie)`,
    type: source.type,
    defaultFields: source.default_fields,
    assets: source.assets,
    isPublic: false,
  });
}

async function tryUpdateShareKey(id: string, shareKey: string): Promise<string> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .update({ share_key: shareKey })
    .eq('id', id)
    .select('share_key')
    .single();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    if (isUniqueViolation(error)) {
      throw error;
    }
    throw error;
  }

  return (data as { share_key: string }).share_key;
}

export async function ensureSponsorTemplateShareKey(id: string): Promise<string> {
  const existing = await getSponsorTemplate(id);
  if (!existing) {
    throw new Error('Template introuvable ou inaccessible.');
  }
  if (existing.share_key) {
    return existing.share_key;
  }
  return await rotateSponsorTemplateShareKey(id);
}

export async function rotateSponsorTemplateShareKey(id: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_SHARE_KEY_ATTEMPTS; attempt += 1) {
    try {
      const newKey = generateShareKey();
      return await tryUpdateShareKey(id, newKey);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in (error as PostgrestError)) {
        if (isUniqueViolation(error as PostgrestError)) {
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error("Impossible de générer une clé de partage unique après plusieurs tentatives.");
}

export async function revokeSponsorTemplateShareKey(id: string): Promise<void> {
  const { error } = await supabase
    .from('sponsor_templates')
    .update({ share_key: null })
    .eq('id', id);

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }
}

export async function importSponsorTemplate({
  shareKey,
  sponsorId,
  name,
}: ImportSponsorTemplateParams): Promise<SponsorTemplate> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .select('*')
    .eq('share_key', shareKey)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }

  if (!data) {
    throw new Error('Aucun template disponible pour cette clé de partage.');
  }

  return await createSponsorTemplate({
    sponsorId,
    name: name ?? `${(data as SponsorTemplate).name} (importé)`,
    type: (data as SponsorTemplate).type,
    defaultFields: (data as SponsorTemplate).default_fields,
    assets: (data as SponsorTemplate).assets,
    isPublic: false,
  });
}

export async function fetchSponsorTemplateByShareKey(shareKey: string): Promise<SponsorTemplate | null> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .select('*')
    .eq('share_key', shareKey)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      throw missingSponsorTemplatesTableError();
    }
    throw error;
  }

  return (data as SponsorTemplate) ?? null;
}
