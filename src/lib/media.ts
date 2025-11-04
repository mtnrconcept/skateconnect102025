// src/lib/media.ts
import { supabase } from './supabaseClient';

const URL = import.meta.env.VITE_SUPABASE_URL as string;

export async function getPlayableVideoUrl(
  path: string,
  opts?: { bucket?: string; ttlSeconds?: number; signed?: boolean }
) {
  const bucket = opts?.bucket ?? 'posts';
  const signed = opts?.signed ?? true;
  const key = path.replace(new RegExp(`^${bucket}/`), '');
  const ttl = Number.isFinite(opts?.ttlSeconds) ? Math.max(30, Math.floor(opts!.ttlSeconds!)) : 3600;

  if (!signed) {
    return `${URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(key)}?v=${Date.now()}`;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, ttl);
  if (error) throw error;
  return `${data.signedUrl}&v=${Date.now()}`;
}

export async function ensurePlayable(
  initialUrl: string,
  regenerate: () => Promise<string>
): Promise<string> {
  try {
    const head = await fetch(initialUrl, { method: 'HEAD' });
    if (!head.ok) throw new Error(`HEAD ${head.status}`);
    return initialUrl;
  } catch {
    return await regenerate();
  }
}
