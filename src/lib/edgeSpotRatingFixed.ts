import { supabase } from './supabase.js';

export async function upsertSpotRating(spot_id: string, rating: number, comment?: string) {
  const LOCAL_API = (import.meta as any)?.env?.VITE_LOCAL_BACKEND_URL as string | undefined;

  // 1) Local backend: relay only user_id, no auth required by service
  if (LOCAL_API && typeof LOCAL_API === 'string' && LOCAL_API.trim().length > 0) {
    const baseLocal = LOCAL_API.replace(/\/$/, '');
    const { data: userData } = await supabase.auth.getUser();
    const user_id = ((userData as any)?.user?.id as string | undefined) ?? 'local-user';

    const res = await fetch(`${baseLocal}/api/spot_ratings/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spot_id, user_id, rating, comment: comment ?? null }),
    });

    if (!res.ok) {
      let msg = 'Local backend error';
      try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
    return true;
  }

  // 2) Edge Function Supabase (JWT required)
  const { data: session } = await supabase.auth.getSession();
  const token = (session as any)?.session?.access_token as string | undefined;
  if (!token) throw new Error("Not authenticated");

  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const projectRef = new URL(supaUrl).host.split('.')[0];
  const base = (import.meta as any)?.env?.VITE_FUNCTIONS_URL as string | undefined || `https://${projectRef}.functions.supabase.co`;
  const url = `${base.replace(/\/$/, '')}/spot-rating-upsert`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "cache-control": "no-store",
    },
    body: JSON.stringify({ spot_id, rating, comment: comment ?? null }),
  });

  if (!res.ok) {
    let msg = 'EdgeFunction error';
    try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
    throw new Error(msg);
  }
  return true;
}
