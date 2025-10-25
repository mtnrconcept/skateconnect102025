import { supabase } from './supabase.js';
import type { SponsorSpotlight } from '../types';

export interface SpotlightPayload {
  sponsor_id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  call_to_action?: string | null;
  call_to_action_url?: string | null;
  status?: SponsorSpotlight['status'];
  start_date?: string | null;
  end_date?: string | null;
}

export async function fetchSponsorSpotlights(sponsorId: string): Promise<SponsorSpotlight[]> {
  const { data, error } = await supabase
    .from('sponsor_spotlights')
    .select('*')
    .eq('sponsor_id', sponsorId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SponsorSpotlight[];
}

export async function createSponsorSpotlight(payload: SpotlightPayload): Promise<SponsorSpotlight> {
  const { data, error } = await supabase
    .from('sponsor_spotlights')
    .insert({
      sponsor_id: payload.sponsor_id,
      title: payload.title,
      description: payload.description ?? '',
      media_url: payload.media_url ?? null,
      call_to_action: payload.call_to_action ?? null,
      call_to_action_url: payload.call_to_action_url ?? null,
      status: payload.status ?? 'draft',
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as SponsorSpotlight;
}

export async function updateSponsorSpotlight(
  id: string,
  updates: Partial<Omit<SponsorSpotlight, 'id' | 'sponsor_id' | 'created_at'>>,
): Promise<SponsorSpotlight> {
  const { data, error } = await supabase
    .from('sponsor_spotlights')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as SponsorSpotlight;
}

export async function deleteSponsorSpotlight(id: string): Promise<void> {
  const { error } = await supabase.from('sponsor_spotlights').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
