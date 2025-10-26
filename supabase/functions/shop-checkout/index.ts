import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const defaultCommissionPercent = Number.parseFloat(
  Deno.env.get("STRIPE_PLATFORM_COMMISSION_PERCENT") ?? "10",
);
const allowedOrigins = (Deno.env.get("SHOP_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("[shop-checkout] Missing Supabase configuration");
}

if (!stripeSecretKey) {
  console.error("[shop-checkout] STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

function buildCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const headers: HeadersInit = {
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };

  if (!origin) {
    return headers;
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return { ...headers, "access-control-allow-origin": origin };
  }

  return headers;
}

interface CheckoutPayload {
  itemId?: string;
  variantId?: string | null;
  quantity?: number;
  customerEmail?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}

interface SponsorBranding {
  brand_name?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
}

function isAvailable(now: Date, start?: string | null, end?: string | null): boolean {
  if (start && new Date(start) > now) {
    return false;
  }
  if (end && new Date(end) < now) {
    return false;
  }
  return true;
}

serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Stripe is not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let payload: CheckoutPayload;
  try {
    payload = await request.json();
  } catch (cause) {
    console.error("[shop-checkout] Unable to parse payload", cause);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const quantity = Number.isFinite(payload.quantity) ? Number(payload.quantity) : 1;
  if (!payload.itemId) {
    return new Response(JSON.stringify({ error: "Missing itemId" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (quantity <= 0 || quantity > 50) {
    return new Response(JSON.stringify({ error: "Invalid quantity" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: item, error: itemError } = await supabaseClient
    .from("sponsor_shop_items")
    .select(
      `id, sponsor_id, name, description, price_cents, currency, stock, is_active, image_url, metadata, available_from, available_until,
       sponsor:profiles!sponsor_shop_items_sponsor_id_fkey(id, display_name, sponsor_branding, stripe_account_id, stripe_account_ready, default_commission_rate)`,
    )
    .eq("id", payload.itemId)
    .maybeSingle();

  if (itemError) {
    console.error("[shop-checkout] Unable to load item", itemError);
    return new Response(JSON.stringify({ error: "Unable to load item" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!item) {
    return new Response(JSON.stringify({ error: "Item not found" }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const now = new Date();

  if (!item.is_active || !isAvailable(now, item.available_from, item.available_until)) {
    return new Response(JSON.stringify({ error: "This item is not available" }), {
      status: 422,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (item.stock !== null && quantity > Number(item.stock)) {
    return new Response(JSON.stringify({ error: "Insufficient stock" }), {
      status: 409,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!item.sponsor?.stripe_account_id || !item.sponsor.stripe_account_ready) {
    return new Response(JSON.stringify({ error: "Sponsor is not ready to accept payments" }), {
      status: 503,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { data: variant, error: variantError } = payload.variantId
    ? await supabaseClient
        .from("sponsor_shop_item_variants")
        .select("id, name, size, color, price_cents, stock, is_active, image_url, availability_start, availability_end")
        .eq("id", payload.variantId)
        .eq("item_id", item.id)
        .maybeSingle()
    : { data: null, error: null };

  if (variantError) {
    console.error("[shop-checkout] Unable to load variant", variantError);
    return new Response(JSON.stringify({ error: "Unable to load variant" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (payload.variantId && !variant) {
    return new Response(JSON.stringify({ error: "Variant not found" }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (variant) {
    if (!variant.is_active || !isAvailable(now, variant.availability_start, variant.availability_end)) {
      return new Response(JSON.stringify({ error: "Variant is not available" }), {
        status: 422,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (variant.stock !== null && quantity > Number(variant.stock)) {
      return new Response(JSON.stringify({ error: "Insufficient variant stock" }), {
        status: 409,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  const priceCents = variant?.price_cents ?? item.price_cents;
  const currency = (variant ? item.currency : item.currency) ?? "EUR";
  const totalCents = priceCents * quantity;
  const branding = (item.sponsor?.sponsor_branding ?? {}) as SponsorBranding;
  const sponsorCommission = Number(item.sponsor?.default_commission_rate);
  const commissionRateSource = Number.isFinite(sponsorCommission) && sponsorCommission > 0
    ? sponsorCommission
    : defaultCommissionPercent / 100;
  const commissionRate = Math.min(Math.max(commissionRateSource, 0), 0.5);
  const applicationFeeCents = Math.round(totalCents * commissionRate);

  const successUrl = payload.successUrl ?? `${new URL(request.url).origin}/shop?status=success`;
  const cancelUrl = payload.cancelUrl ?? `${new URL(request.url).origin}/shop?status=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: item.sponsor!.stripe_account_id!,
        },
        metadata: {
          sponsor_id: item.sponsor_id,
          item_id: item.id,
          variant_id: variant?.id ?? "",
          commission_rate: commissionRate.toString(),
        },
      },
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["FR", "BE", "DE", "ES", "IT", "GB", "US", "CA"] },
      customer_email: payload.customerEmail ?? undefined,
      line_items: [
        {
          quantity,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: priceCents,
            product_data: {
              name: variant ? `${item.name} – ${variant.name}` : item.name,
              description: item.description ?? undefined,
              images: [variant?.image_url ?? item.image_url].filter((url): url is string => Boolean(url)),
              metadata: {
                item_id: item.id,
                variant_id: variant?.id ?? "",
              },
            },
          },
        },
      ],
      metadata: {
        sponsor_id: item.sponsor_id,
        item_id: item.id,
        variant_id: variant?.id ?? "",
        quantity: quantity.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const { data: inserted, error: orderError } = await supabaseClient
      .from("sponsor_shop_orders")
      .insert({
        sponsor_id: item.sponsor_id,
        item_id: item.id,
        variant_id: variant?.id ?? null,
        status: "pending",
        quantity,
        total_cents: totalCents,
        subtotal_cents: totalCents,
        currency,
        customer_email: payload.customerEmail ?? null,
        stripe_session_id: session.id,
        commission_cents: applicationFeeCents,
        net_amount_cents: totalCents - applicationFeeCents,
        metadata: {
          checkout_mode: "stripe",
          stripe_checkout_url: session.url,
          variant_id: variant?.id ?? null,
          commission_rate: commissionRate,
          sponsor_brand: branding.brand_name ?? null,
        },
      })
      .select("id")
      .maybeSingle();

    if (orderError) {
      console.error("[shop-checkout] Unable to persist order", orderError);
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        orderId: inserted?.id ?? null,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (cause) {
    console.error("[shop-checkout] Stripe error", cause);
    return new Response(JSON.stringify({ error: "Unable to create checkout session" }), {
      status: 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
