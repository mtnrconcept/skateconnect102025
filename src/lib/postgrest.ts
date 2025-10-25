import type { PostgrestError } from '@supabase/supabase-js';

const MISSING_TABLE_CODE = 'PGRST205';
const MISSING_TABLE_PATTERN = /could not find the table/i;

export function isSchemaMissing(error?: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === MISSING_TABLE_CODE) {
    return true;
  }

  if (typeof error.message === 'string' && MISSING_TABLE_PATTERN.test(error.message)) {
    return true;
  }

  if (typeof error.hint === 'string' && MISSING_TABLE_PATTERN.test(error.hint)) {
    return true;
  }

  return false;
}

export interface TableFallbackOptions {
  onMissing?: (error: PostgrestError) => void;
}

export async function withTableFallback<T>(
  request: PromiseLike<{ data: T; error: PostgrestError | null }>,
  fallback: () => Promise<T> | T,
  options: TableFallbackOptions = {},
): Promise<T> {
  const { data, error } = await request;

  if (!error) {
    return data;
  }

  if (isSchemaMissing(error)) {
    options.onMissing?.(error);
    return await Promise.resolve(fallback());
  }

  throw error;
}
