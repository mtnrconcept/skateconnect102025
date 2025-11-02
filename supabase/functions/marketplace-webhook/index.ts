import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(raw, signature, webhookSecret); } catch { return json(400, { error: "Invalid signature" }); }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
        const { error } = await supabase
          .from('marketplace_orders')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paymentIntentId,
            total_cents: session.amount_total ?? null,
            subtotal_cents: session.amount_subtotal ?? null,
            currency: (session.currency ?? 'eur').toUpperCase(),
            metadata: { checkout_status: session.status, payment_status: session.payment_status },
            buyer_id: session.customer_details?.email ? undefined : undefined,
          })
          .eq('stripe_session_id', session.id);
        if (error) console.error('[marketplace-webhook] update order failed', error);
        break; }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { error } = await supabase.from('marketplace_orders').update({ status: 'cancelled' }).eq('stripe_session_id', session.id);
        if (error) console.error('[marketplace-webhook] cancel order failed', error);
        break; }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { error } = await supabase.from('marketplace_orders').update({ status: 'cancelled' }).eq('stripe_payment_intent_id', pi.id);
        if (error) console.error('[marketplace-webhook] payment fail mark', error);
        break; }
      default:
        break;
    }
  } catch (cause) {
    console.error('[marketplace-webhook] handler error', cause);
    return json(500, { error: 'Unhandled webhook' });
  }

  return json(200, { received: true });
});

