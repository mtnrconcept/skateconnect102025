import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    },
  });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Not configured' }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour

  // Load recent active listings
  const { data: listings } = await supabase
    .from('marketplace_listings')
    .select('id,title,description,category,city,country,created_at')
    .eq('status', 'active')
    .gte('created_at', sinceIso);

  // Load saved searches with alerts
  const { data: searches } = await supabase
    .from('marketplace_saved_searches')
    .select('id,user_id,name,query,alert_email,alert_push,created_at');

  let matches = 0;
  if (Array.isArray(listings) && Array.isArray(searches)) {
    for (const s of searches) {
      const q = String(s.query ?? '').toLowerCase().trim();
      if (!q) continue;
      for (const l of listings) {
        const hay = [l.title, l.description, l.category, l.city, l.country].join(' ').toLowerCase();
        if (hay.includes(q)) {
          matches++;
          // TODO: insert into notifications table if present, or send email/push via external service
          await supabase.from('notifications').insert({
            user_id: s.user_id,
            type: 'message',
            title: 'Nouvelle annonce correspondant à votre recherche',
            body: l.title,
            data: { listing_id: l.id, saved_search_id: s.id },
            read: false,
          }).catch(() => {});
        }
      }
    }
  }

  return json({ processed: (listings?.length ?? 0), searches: (searches?.length ?? 0), matches });
});

