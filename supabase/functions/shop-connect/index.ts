import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const defaultRefreshUrl = Deno.env.get("SHOP_STRIPE_REFRESH_URL") ?? "";
const defaultReturnUrl = Deno.env.get("SHOP_STRIPE_RETURN_URL") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[shop-connect] Missing Supabase configuration");
}

if (!stripeSecretKey) {
  console.error("[shop-connect] STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

interface ConnectPayload {
  returnUrl?: string;
  refreshUrl?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
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
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!stripeSecretKey) {
    return jsonResponse({ error: "Stripe is not configured" }, 503);
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: request.headers.get("Authorization") ?? "",
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError) {
    console.error("[shop-connect] Auth error", authError);
    return jsonResponse({ error: "Authentication failed" }, 401);
  }

  if (!user) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, role, stripe_account_id, stripe_account_ready, sponsor_branding, default_commission_rate")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[shop-connect] Unable to load profile", profileError);
    return jsonResponse({ error: "Unable to load profile" }, 500);
  }

  if (!profile || profile.role !== "sponsor") {
    return jsonResponse({ error: "Only sponsors can connect Stripe" }, 403);
  }

  let accountId = profile.stripe_account_id as string | null;
  const accountEmail = user.email ?? undefined;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: accountEmail,
        business_profile: {
          product_description: "Boutique SkateConnect",
          url: Deno.env.get("SHOP_PLATFORM_URL") ?? undefined,
        },
        metadata: {
          sponsor_id: profile.id,
          default_commission_rate: String(profile.default_commission_rate ?? ""),
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          stripe_account_id: account.id,
          stripe_account_ready: Boolean(account.charges_enabled && account.payouts_enabled),
          stripe_onboarded_at: account.details_submitted ? new Date().toISOString() : null,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error("[shop-connect] Unable to persist account id", updateError);
      }
    }

    const payload: ConnectPayload = await request.json().catch(() => ({}));

    const refreshUrl = payload.refreshUrl || defaultRefreshUrl || (Deno.env.get("SHOP_PLATFORM_URL") ?? "");
    const returnUrl = payload.returnUrl || defaultReturnUrl || (Deno.env.get("SHOP_PLATFORM_URL") ?? "");

    const accountLink = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl || `${new URL(request.url).origin}/sponsors?stripe=refresh`,
      return_url: returnUrl || `${new URL(request.url).origin}/sponsors?stripe=return`,
      type: "account_onboarding",
    });

    return jsonResponse({ url: accountLink.url, accountId });
  } catch (cause) {
    console.error("[shop-connect] Stripe error", cause);
    return jsonResponse({ error: "Unable to start onboarding" }, 502);
  }
});
