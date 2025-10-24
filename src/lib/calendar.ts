import type { CommunityEvent } from '../types';

type MonthMap = Record<string, number>;

interface DateComponent {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

interface ParsedEventDateTime {
  start: DateComponent;
  end: DateComponent;
  allDay: boolean;
}

const monthMap: MonthMap = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const DATE_FALLBACK_MESSAGE = "Date ou horaire non précisé";

function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatDateValue({ year, month, day }: DateComponent): string {
  return `${year}${pad(month)}${pad(day)}`;
}

function formatDateTimeValue({ year, month, day, hour = 0, minute = 0 }: DateComponent): string {
  return `${formatDateValue({ year, month, day })}T${pad(hour)}${pad(minute)}00`;
}

function formatTimestamp(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, '');
  const [datePart] = iso.split('.');
  return `${datePart}Z`;
}

function addMinutes(component: DateComponent, minutes: number): DateComponent {
  const reference = new Date(Date.UTC(component.year, component.month - 1, component.day, component.hour ?? 0, component.minute ?? 0));
  reference.setUTCMinutes(reference.getUTCMinutes() + minutes);

  return {
    year: reference.getUTCFullYear(),
    month: reference.getUTCMonth() + 1,
    day: reference.getUTCDate(),
    hour: component.hour !== undefined ? reference.getUTCHours() : undefined,
    minute: component.hour !== undefined ? reference.getUTCMinutes() : undefined,
  };
}

function parseDateComponent(rawDate: string): DateComponent | null {
  const normalized = removeAccents(rawDate.toLowerCase());
  const match = normalized.match(/(\d{1,2})\s+([a-z]+)/i);
  const yearMatch = normalized.match(/(\d{4})/);

  if (!match || !yearMatch) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const monthName = match[2];
  const year = Number.parseInt(yearMatch[1], 10);
  const month = monthMap[monthName];

  if (!month) {
    return null;
  }

  return { year, month, day };
}

function parseTimeRange(rawTime: string | undefined): { start?: [number, number]; end?: [number, number] } {
  if (!rawTime) {
    return {};
  }

  const times = rawTime.split('-').map((segment) => segment.trim());
  const parsePoint = (value: string): [number, number] | undefined => {
    const match = value.match(/(\d{1,2})h(\d{2})/i);
    if (!match) {
      return undefined;
    }
    return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
  };

  const start = parsePoint(times[0] ?? '');
  const end = parsePoint(times[1] ?? '');

  return { start, end };
}

function ensureParsedDate(event: CommunityEvent): ParsedEventDateTime {
  const parsedDate = parseDateComponent(event.date);
  const { start, end } = parseTimeRange(event.time);

  if (!parsedDate) {
    const today = new Date();
    return {
      start: { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() },
      end: addMinutes({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }, 60),
      allDay: true,
    };
  }

  if (!start) {
    return {
      start: parsedDate,
      end: addMinutes(parsedDate, 24 * 60),
      allDay: true,
    };
  }

  const startComponent: DateComponent = { ...parsedDate, hour: start[0], minute: start[1] };
  const endComponent: DateComponent = end
    ? { ...parsedDate, hour: end[0], minute: end[1] }
    : addMinutes(startComponent, 120);

  return {
    start: startComponent,
    end: endComponent,
    allDay: false,
  };
}

function escapeICS(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildDetails(event: CommunityEvent): string {
  const details = [event.description];
  if (event.date) {
    details.push(`Date: ${event.date}`);
  }
  if (event.time) {
    details.push(`Horaire: ${event.time}`);
  } else {
    details.push(DATE_FALLBACK_MESSAGE);
  }
  return escapeICS(details.join('\n'));
}

function getParsedInfo(event: CommunityEvent): ParsedEventDateTime {
  return ensureParsedDate(event);
}

export function generateICS(event: CommunityEvent): string {
  const parsed = getParsedInfo(event);
  const dtStamp = formatTimestamp(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkateConnect//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeICS(`${event.id}@skateconnect.events`)}`,
    `DTSTAMP:${dtStamp}`,
    parsed.allDay
      ? `DTSTART;VALUE=DATE:${formatDateValue(parsed.start)}`
      : `DTSTART:${formatDateTimeValue(parsed.start)}`,
    parsed.allDay
      ? `DTEND;VALUE=DATE:${formatDateValue(parsed.end)}`
      : `DTEND:${formatDateTimeValue(parsed.end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${buildDetails(event)}`,
    `LOCATION:${escapeICS(event.location)}`,
    `CATEGORIES:${escapeICS(event.type)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

function formatGoogleDate(component: DateComponent, allDay: boolean): string {
  if (allDay) {
    return formatDateValue(component);
  }
  return formatDateTimeValue(component);
}

export function buildGoogleCalendarUrl(event: CommunityEvent): string {
  const parsed = getParsedInfo(event);
  const base = 'https://www.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams();

  params.set('text', event.title);
  params.set('details', `${event.description}\n\n${event.date} - ${event.time || DATE_FALLBACK_MESSAGE}`);
  params.set('location', event.location);

  if (parsed) {
    const start = formatGoogleDate(parsed.start, parsed.allDay);
    const end = formatGoogleDate(parsed.end, parsed.allDay);
    params.set('dates', `${start}/${end}`);
    if (!parsed.allDay) {
      params.set('ctz', 'Europe/Paris');
    }
  }

  return `${base}&${params.toString()}`;
}

export function getICSFileName(event: CommunityEvent): string {
  const base = (event.id || event.title || 'evenement').toLowerCase();
  const sanitized = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return `${sanitized || 'evenement'}.ics`;
}

export function getEventDateInfo(event: CommunityEvent): ParsedEventDateTime {
  return getParsedInfo(event);
}

export type { ParsedEventDateTime };
