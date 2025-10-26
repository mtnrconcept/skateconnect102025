import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[shop-webhook] Missing Supabase configuration");
}

if (!stripeSecretKey || !webhookSecret) {
  console.error("[shop-webhook] Stripe secrets are missing");
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleCheckoutCompleted(event: Stripe.Event, supabaseClient: ReturnType<typeof createClient>) {
  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const sponsorId = session.metadata?.sponsor_id ?? null;
  const itemId = session.metadata?.item_id ?? null;
  const variantId = session.metadata?.variant_id || null;

  let fallbackQuantity = 1;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    fallbackQuantity = lineItems.data[0]?.quantity ?? 1;
  } catch (cause) {
    console.error("[shop-webhook] Unable to load line items", cause);
  }
  const quantityValue = session.metadata?.quantity ? Number(session.metadata.quantity) : fallbackQuantity;
  const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? Math.floor(quantityValue) : 1;

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const paymentIntent = paymentIntentId ? await stripe.paymentIntents.retrieve(paymentIntentId) : null;

  const amountTotal = session.amount_total ?? paymentIntent?.amount_received ?? 0;
  const amountSubtotal = session.amount_subtotal ?? paymentIntent?.amount ?? amountTotal;
  const shipping = session.total_details?.amount_shipping ?? 0;
  const tax = session.total_details?.amount_tax ?? 0;
  const applicationFee = paymentIntent?.application_fee_amount ?? 0;
  const net = amountTotal - applicationFee;

  const { data: existingOrder, error: loadError } = await supabaseClient
    .from("sponsor_shop_orders")
    .select("id, metadata, customer_email")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (loadError) {
    console.error("[shop-webhook] Unable to load order", loadError);
  }

  const existingMetadata = (existingOrder?.metadata as Record<string, unknown> | null) ?? {};
  const metadata = {
    ...existingMetadata,
    stripe_checkout_status: session.status,
    payment_status: session.payment_status,
    stripe_customer: session.customer ?? null,
  };

  if (existingOrder) {
    const { error: updateError } = await supabaseClient
      .from("sponsor_shop_orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
        total_cents: amountTotal,
        subtotal_cents: amountSubtotal,
        shipping_cents: shipping,
        tax_cents: tax,
        commission_cents: applicationFee,
        net_amount_cents: net,
        customer_email: session.customer_details?.email ?? (existingOrder.customer_email as string | null) ?? null,
        customer_name: session.customer_details?.name ?? null,
        customer_city: session.customer_details?.address?.city ?? null,
        customer_country: session.customer_details?.address?.country ?? null,
        metadata,
      })
      .eq("id", existingOrder.id);

    if (updateError) {
      console.error("[shop-webhook] Unable to update order", updateError);
    }
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("sponsor_shop_orders")
    .insert({
      sponsor_id: sponsorId,
      item_id: itemId,
      variant_id: variantId,
      status: "paid",
      quantity,
      total_cents: amountTotal,
      subtotal_cents: amountSubtotal,
      commission_cents: applicationFee,
      net_amount_cents: net,
      shipping_cents: shipping,
      tax_cents: tax,
      currency: session.currency?.toUpperCase() ?? paymentIntent?.currency?.toUpperCase() ?? "EUR",
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      customer_city: session.customer_details?.address?.city ?? null,
      customer_country: session.customer_details?.address?.country ?? null,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
      metadata,
    });

  if (insertError) {
    console.error("[shop-webhook] Unable to insert order", insertError);
  }
}

async function handleAccountUpdated(event: Stripe.Event, supabaseClient: ReturnType<typeof createClient>) {
  const account = event.data.object as Stripe.Account;
  if (!account.id) {
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      stripe_account_ready: Boolean(account.charges_enabled && account.payouts_enabled),
      stripe_onboarded_at: account.details_submitted ? new Date().toISOString() : null,
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    console.error("[shop-webhook] Unable to update profile stripe status", error);
  }
}

serve(async (request) => {
  if (request.method === "POST") {
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (cause) {
      console.error("[shop-webhook] Invalid signature", cause);
      return json(400, { error: "Invalid signature" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event, supabaseClient);
          break;
        case "checkout.session.expired":
          // Mark associated orders as cancelled
          {
            const session = event.data.object as Stripe.Checkout.Session;
            const { error } = await supabaseClient
              .from("sponsor_shop_orders")
              .update({ status: "cancelled" })
              .eq("stripe_session_id", session.id);
            if (error) {
              console.error("[shop-webhook] Unable to cancel order", error);
            }
          }
          break;
        case "payment_intent.payment_failed":
          if (typeof event.data.object.id === "string") {
            const paymentIntentId = event.data.object.id;
            const { error } = await supabaseClient
              .from("sponsor_shop_orders")
              .update({ status: "cancelled" })
              .eq("stripe_payment_intent_id", paymentIntentId);
            if (error) {
              console.error("[shop-webhook] Unable to mark failed payment", error);
            }
          }
          break;
        case "account.updated":
          await handleAccountUpdated(event, supabaseClient);
          break;
        default:
          break;
      }
    } catch (cause) {
      console.error("[shop-webhook] Handler error", cause);
      return json(500, { error: "Unhandled webhook" });
    }

    return json(200, { received: true });
  }

  return json(405, { error: "Method not allowed" });
});
