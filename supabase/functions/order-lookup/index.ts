import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("SHOP_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter((v) => v.length > 0);

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "*";
  const allowOrigin = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const headers: HeadersInit = {
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": [
      "authorization",
      "content-type",
      "apikey",
      "x-client-info",
      "x-supabase-api-version",
      "x-requested-with",
    ].join(", "),
  };
  if (allowOrigin) {
    return { ...headers, "access-control-allow-origin": allowOrigin };
  }
  return headers;
}

function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });
}

serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { error: "Supabase not configured" }, headers);
  }

  let sessionId = "";
  if (request.method === "GET") {
    const url = new URL(request.url);
    sessionId = url.searchParams.get("session_id") ?? url.searchParams.get("sessionId") ?? "";
  } else if (request.method === "POST") {
    try {
      const body = (await request.json()) as { sessionId?: string };
      sessionId = body.sessionId ?? "";
    } catch {
      return json(400, { error: "Invalid JSON" }, headers);
    }
  } else {
    return json(405, { error: "Method not allowed" }, headers);
  }

  if (!sessionId || sessionId.trim().length < 8) {
    return json(400, { error: "Missing sessionId" }, headers);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: order, error } = await supabase
    .from("sponsor_shop_orders")
    .select(
      `id, status, quantity, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, commission_cents, net_amount_cents, created_at,
       customer_email, customer_name, customer_city, customer_country,
       stripe_session_id, stripe_payment_intent_id,
       item:sponsor_shop_items(id, name, image_url, currency,
         sponsor:profiles(id, display_name, sponsor_branding)
       ),
       variant:sponsor_shop_item_variants(id, name, size, color, image_url)`
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[order-lookup] Unable to query order", error);
    return json(500, { error: "Unable to load order" }, headers);
  }
  if (!order) {
    return json(404, { error: "Order not found" }, headers);
  }

  const branding = ((order.item?.sponsor?.sponsor_branding ?? {}) as Record<string, unknown>) ?? {};
  const brandName = (branding["brand_name"] as string) ?? order.item?.sponsor?.display_name ?? null;

  const payload = {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    currency: order.currency,
    amounts: {
      subtotalCents: order.subtotal_cents ?? 0,
      shippingCents: order.shipping_cents ?? 0,
      taxCents: order.tax_cents ?? 0,
      totalCents: order.total_cents ?? 0,
      commissionCents: order.commission_cents ?? 0,
      netAmountCents: order.net_amount_cents ?? 0,
    },
    quantity: order.quantity ?? 1,
    customer: {
      email: order.customer_email ?? null,
      name: order.customer_name ?? null,
      city: order.customer_city ?? null,
      country: order.customer_country ?? null,
    },
    stripe: {
      sessionId: order.stripe_session_id,
      paymentIntentId: order.stripe_payment_intent_id ?? null,
    },
    item: order.item
      ? {
          id: order.item.id,
          name: order.item.name,
          imageUrl: order.item.image_url ?? null,
          currency: order.item.currency ?? order.currency,
        }
      : null,
    variant: order.variant
      ? {
          id: order.variant.id,
          name: order.variant.name,
          size: order.variant.size ?? null,
          color: order.variant.color ?? null,
          imageUrl: order.variant.image_url ?? null,
        }
      : null,
    sponsor: {
      id: order.item?.sponsor?.id ?? null,
      displayName: order.item?.sponsor?.display_name ?? null,
      brandName,
    },
  };

  return json(200, payload, headers);
});

