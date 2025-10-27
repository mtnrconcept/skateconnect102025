import { supabase } from './supabase.js';
import { isSchemaMissing, withTableFallback } from './postgrest.js';
import type { CommunityEvent } from '../types';

export const COMMUNITY_EVENT_TYPES: CommunityEvent['type'][] = [
  'Compétition',
  'Contest',
  'Rencontre',
  'Avant-première',
  'Appel à projet',
  'Appel à sponsor',
];

type CommunityEventRow = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location: string;
  event_type: string;
  attendees_count: number | null;
  is_sponsor_event: boolean | null;
  sponsor_name: string | null;
};

type RegistrationRow = {
  event_id: string;
};

function missingCommunityEventsTableError(): Error {
  return new Error(
    'La table Supabase "community_events" est introuvable. Exécute les migrations communauté ou expose la vue correspondante.',
  );
}

function capitalizeFirstLetter(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatEventDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return capitalizeFirstLetter(formatter.format(parsed));
}

function isCommunityEventType(value: string): value is CommunityEvent['type'] {
  return COMMUNITY_EVENT_TYPES.includes(value as CommunityEvent['type']);
}

function mapRowToCommunityEvent(
  row: CommunityEventRow,
  registrationCounts: Map<string, number>,
): CommunityEvent | null {
  if (!isCommunityEventType(row.event_type)) {
    return null;
  }

  const attendees = registrationCounts.get(row.id) ?? row.attendees_count ?? 0;
  const sponsorName = row.sponsor_name?.trim();

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: formatEventDate(row.event_date),
    time: row.event_time,
    location: row.location,
    type: row.event_type,
    attendees,
    is_sponsor_event: row.is_sponsor_event ?? Boolean(sponsorName),
    sponsor_name: sponsorName || undefined,
  };
}

async function getRegistrationCounts(eventIds: string[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const { data, error } = await (supabase as any)
    .from('event_registrations')
    .select('event_id')
    .in('event_id', eventIds);

  if (error) {
    console.warn('Unable to load registration counts for community events', error);
    return new Map();
  }

  const rows = (data ?? []) as RegistrationRow[];

  return rows.reduce<Map<string, number>>((accumulator, row) => {
    const current = accumulator.get(row.event_id) ?? 0;
    accumulator.set(row.event_id, current + 1);
    return accumulator;
  }, new Map());
}

export async function fetchCommunityEvents(): Promise<CommunityEvent[]> {
  let rows: CommunityEventRow[] | null;

  try {
    const request = () =>
      (supabase as any)
        .from('community_events')
        .select(
          'id, title, description, event_date, event_time, location, event_type, attendees_count, is_sponsor_event, sponsor_name',
        )
        .order('event_date', { ascending: true });

    rows = await withTableFallback<CommunityEventRow[] | null>(
      request,
      () => [],
      {
        onMissing: () => {
          console.info('community_events table is missing. Returning an empty community events list.');
        },
        retry: { attempts: 2, delayMs: 500 },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message?: string }).message
        : null;

      if (message) {
        throw new Error(message);
      }
    }

    throw new Error("Impossible de récupérer les événements de la communauté.");
  }

  const safeRows = rows ?? [];
  const registrationCounts = await getRegistrationCounts(safeRows.map((row) => row.id));

  return safeRows
    .map((row) => mapRowToCommunityEvent(row, registrationCounts))
    .filter((event): event is CommunityEvent => event !== null);
}

export interface CommunityEventInput {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: CommunityEvent['type'];
  createdBy: string;
  sponsorName?: string;
}

export async function createCommunityEvent(input: CommunityEventInput): Promise<CommunityEvent> {
  const sponsorName = input.sponsorName?.trim();
  const payload = {
    title: input.title,
    description: input.description,
    event_date: input.date,
    event_time: input.time,
    location: input.location,
    event_type: input.type,
    sponsor_name: sponsorName || null,
    is_sponsor_event: sponsorName ? true : false,
    created_by: input.createdBy,
  };

  let data: CommunityEventRow | null;

  try {
    const request = () =>
      (supabase as any)
        .from('community_events')
        .insert(payload)
        .select(
          'id, title, description, event_date, event_time, location, event_type, attendees_count, is_sponsor_event, sponsor_name',
        )
        .single();

    data = await withTableFallback<CommunityEventRow | null>(
      request,
      () => {
        throw missingCommunityEventsTableError();
      },
      {
        onMissing: () => {
          console.info(
            'community_events table is missing. Throwing a descriptive error for community event creation.',
          );
        },
        retry: { attempts: 2, delayMs: 500 },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    if (isSchemaMissing(error as any)) {
      throw missingCommunityEventsTableError();
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const message = typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message?: string }).message
        : null;

      if (message) {
        throw new Error(message);
      }
    }

    throw new Error("Impossible de créer l'événement.");
  }

  if (!data) {
    throw new Error("Impossible de créer l'événement.");
  }

  const event = mapRowToCommunityEvent(data, new Map());

  if (!event) {
    throw new Error("Le type d'événement retourné n'est pas pris en charge.");
  }

  return event;
}
