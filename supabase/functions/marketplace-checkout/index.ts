import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const defaultCommissionPercent = Number.parseFloat(Deno.env.get("STRIPE_PLATFORM_COMMISSION_PERCENT") ?? "10");

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

interface Payload { listingId: string; quantity?: number; successUrl?: string; cancelUrl?: string; buyerEmail?: string | null }

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  };
}

serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...headers, "content-type": "application/json" } });
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) return new Response(JSON.stringify({ error: "Not configured" }), { status: 503, headers: { ...headers, "content-type": "application/json" } });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false }, global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } } });

  let payload: Payload;
  try { payload = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...headers, "content-type": "application/json" } }); }
  const quantity = Number.isFinite(payload.quantity) ? Math.min(Math.max(Number(payload.quantity), 1), 50) : 1;
  if (!payload.listingId) return new Response(JSON.stringify({ error: "Missing listingId" }), { status: 400, headers: { ...headers, "content-type": "application/json" } });

  // Load listing + seller
  const { data: listing, error: listingError } = await supabase
    .from("marketplace_listings")
    .select("id, user_id, title, description, price_cents, currency, image_url, shipping_available, status, user:profiles(id, display_name, stripe_account_id, stripe_account_ready)")
    .eq("id", payload.listingId)
    .maybeSingle();

  if (listingError) return new Response(JSON.stringify({ error: "Unable to load listing" }), { status: 500, headers: { ...headers, "content-type": "application/json" } });
  if (!listing) return new Response(JSON.stringify({ error: "Listing not found" }), { status: 404, headers: { ...headers, "content-type": "application/json" } });
  if (listing.status !== "active") return new Response(JSON.stringify({ error: "Listing is not active" }), { status: 422, headers: { ...headers, "content-type": "application/json" } });
  if (!listing.user?.stripe_account_id || !listing.user?.stripe_account_ready) return new Response(JSON.stringify({ error: "Seller not ready for payments" }), { status: 503, headers: { ...headers, "content-type": "application/json" } });

  const totalCents = listing.price_cents * quantity;
  const applicationFeeCents = Math.round(totalCents * (defaultCommissionPercent / 100));
  const successUrl = payload.successUrl ?? `${new URL(request.url).origin}/marketplace?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = payload.cancelUrl ?? `${new URL(request.url).origin}/marketplace?checkout=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["FR", "BE", "DE", "ES", "IT", "GB", "US", "CA"] },
      customer_email: payload.buyerEmail ?? undefined,
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: { destination: listing.user.stripe_account_id },
        metadata: { kind: "marketplace", listing_id: listing.id, seller_id: listing.user_id },
      },
      line_items: [
        {
          quantity,
          price_data: {
            currency: (listing.currency ?? 'EUR').toLowerCase(),
            unit_amount: listing.price_cents,
            product_data: {
              name: listing.title,
              description: listing.description ?? undefined,
              images: [listing.image_url].filter((u): u is string => Boolean(u)),
              metadata: { listing_id: listing.id },
            },
          },
        },
      ],
      metadata: { listing_id: listing.id, seller_id: listing.user_id, quantity: String(quantity) },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Create order record
    const { data: order } = await supabase
      .from("marketplace_orders")
      .insert({
        listing_id: listing.id,
        buyer_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        seller_id: listing.user_id,
        status: "pending",
        quantity,
        currency: listing.currency ?? 'EUR',
        subtotal_cents: totalCents,
        total_cents: totalCents,
        commission_cents: applicationFeeCents,
        net_amount_cents: totalCents - applicationFeeCents,
        stripe_session_id: session.id,
        metadata: { checkout_mode: 'stripe' },
      })
      .select("id")
      .maybeSingle();

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url, orderId: order?.id ?? null }), { status: 201, headers: { ...headers, "content-type": "application/json" } });
  } catch (cause) {
    console.error("[marketplace-checkout] error", cause);
    return new Response(JSON.stringify({ error: "Unable to create checkout session" }), { status: 502, headers: { ...headers, "content-type": "application/json" } });
  }
});

