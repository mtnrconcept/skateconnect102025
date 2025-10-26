import type { PostgrestError } from '@supabase/supabase-js';

const TABLE_MISSING_CODES = new Set(['PGRST205', '42P01']);
const COLUMN_MISSING_CODES = new Set(['42703', 'PGRST204']);

function extractCode(error: Partial<PostgrestError> | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error.code === 'string') {
    return error.code;
  }

  if (typeof (error as { status?: number }).status === 'number') {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return 'PGRST205';
    }
  }

  return undefined;
}

function extractMessage(error: Partial<PostgrestError> | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error.message === 'string') {
    return error.message;
  }

  if (typeof (error as { body?: string }).body === 'string') {
    return (error as { body?: string }).body;
  }

  return undefined;
}

export function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<PostgrestError> & { status?: number; body?: string };

  const code = extractCode(candidate);
  if (code && TABLE_MISSING_CODES.has(code)) {
    return true;
  }

  const message = extractMessage(candidate);
  if (!message) {
    return false;
  }

  return /relation .* does not exist/i.test(message) || /object .* not found in schema cache/i.test(message);
}

function matchesMissingColumnMessage(message: string, column?: string): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  if (column && !normalized.includes(column.toLowerCase())) {
    return false;
  }

  if (/column .* does not exist/i.test(message) || /invalid reference to column/i.test(message)) {
    return true;
  }

  return /schema cache/i.test(normalized);
}

export function isColumnMissingError(error: unknown, column?: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<PostgrestError> & { status?: number; body?: string };

  const code = extractCode(candidate);
  if (code && COLUMN_MISSING_CODES.has(code)) {
    if (!column) {
      return true;
    }

    const message = extractMessage(candidate);
    if (message && matchesMissingColumnMessage(message, column)) {
      return true;
    }

    if (typeof candidate.details === 'string' && matchesMissingColumnMessage(candidate.details, column)) {
      return true;
    }

    if (typeof candidate.hint === 'string' && matchesMissingColumnMessage(candidate.hint, column)) {
      return true;
    }

    return false;
  }

  const message = extractMessage(candidate);
  if (message && matchesMissingColumnMessage(message, column)) {
    return true;
  }

  if (typeof candidate.details === 'string' && matchesMissingColumnMessage(candidate.details, column)) {
    return true;
  }

  if (typeof candidate.hint === 'string' && matchesMissingColumnMessage(candidate.hint, column)) {
    return true;
  }

  return false;
}
