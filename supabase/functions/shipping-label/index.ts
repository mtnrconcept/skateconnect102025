import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface Payload { orderId: string; carrier?: 'sendcloud' | 'boxtal'; serviceCode?: string }

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "*";
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "POST,OPTIONS", "access-control-allow-headers": "authorization, content-type" };
}

function json(status: number, body: unknown, headers: HeadersInit) { return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } }); }

serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, headers);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let payload: Payload; try { payload = await request.json(); } catch { return json(400, { error: 'Invalid JSON' }, headers); }
  if (!payload.orderId) return json(400, { error: 'Missing orderId' }, headers);

  // Stub d'intégration: en prod, appeler Sendcloud/Boxtal et récupérer étiquette & tracking.
  const tracking = `TRK-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
  const labelUrl = `https://labels.example/${tracking}.pdf`;

  const { error } = await supabase
    .from('marketplace_orders')
    .update({ shipping_carrier: payload.carrier ?? 'sendcloud', shipping_tracking: tracking, shipping_label_url: labelUrl, status: 'shipped' })
    .eq('id', payload.orderId);
  if (error) return json(500, { error: 'Unable to update order' }, headers);

  return json(200, { tracking, labelUrl }, headers);
});

