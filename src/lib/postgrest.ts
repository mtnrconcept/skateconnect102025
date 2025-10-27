import type { PostgrestError } from '@supabase/supabase-js';

const MISSING_TABLE_CODE = 'PGRST205';
const MISSING_TABLE_PATTERN = /could not find the table/i;
const CONNECTION_ERROR_PATTERNS = [/fetch failed/i, /Failed to fetch/i, /network request failed/i];

const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 300;

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

function isConnectionLikeError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === 'object' && 'code' in error) {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === 'string' && candidate.startsWith('FETCH_')) {
      return true;
    }
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : undefined;

  if (typeof message === 'string') {
    return CONNECTION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  }

  if (error instanceof TypeError && typeof error.message === 'string') {
    return CONNECTION_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  return false;
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type RequestResult<T> = PromiseLike<{ data: T; error: PostgrestError | null }>;
type RequestFactory<T> = () => RequestResult<T>;

export interface TableFallbackOptions {
  onMissing?: (error: PostgrestError) => void;
  retry?: {
    attempts?: number;
    delayMs?: number;
  };
}

export async function withTableFallback<T>(
  requestOrFactory: RequestResult<T> | RequestFactory<T>,
  fallback: () => Promise<T> | T,
  options: TableFallbackOptions = {},
): Promise<T> {
  const { onMissing, retry } = options;
  const attempts = Math.max(0, retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const delayMs = Math.max(0, retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS);

  const isFactory = typeof requestOrFactory === 'function';

  let lastError: unknown;

  const executeRequest = (): RequestResult<T> => {
    if (typeof requestOrFactory === 'function') {
      return (requestOrFactory as RequestFactory<T>)();
    }

    return requestOrFactory;
  };

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await executeRequest();

      if (!error) {
        return data;
      }

      if (isSchemaMissing(error)) {
        onMissing?.(error);
        return await Promise.resolve(fallback());
      }

      if (!isConnectionLikeError(error)) {
        throw error;
      }

      lastError = error;
    } catch (cause) {
      if (!isConnectionLikeError(cause)) {
        throw cause;
      }

      lastError = cause;
    }

    if (!isFactory) {
      break;
    }

    if (attempt < attempts) {
      await delay(delayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Supabase request failed without an explicit error.');
}
