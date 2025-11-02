import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const defaultPlatformUrl = Deno.env.get("SHOP_PLATFORM_URL") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

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
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) return json({ error: "Not configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false }, global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Authentication required" }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, stripe_account_id, stripe_account_ready')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "Unable to load profile" }, 500);

  let accountId = profile.stripe_account_id as string | null;
  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        business_profile: { product_description: "Marketplace Shredloc", url: defaultPlatformUrl || undefined },
        metadata: { user_id: profile.id },
      });
      accountId = account.id;
      await supabase.from('profiles').update({ stripe_account_id: account.id, stripe_account_ready: Boolean(account.charges_enabled && account.payouts_enabled), stripe_onboarded_at: account.details_submitted ? new Date().toISOString() : null }).eq('id', profile.id);
    }
    const refreshUrl = defaultPlatformUrl || `${new URL(request.url).origin}/marketplace/account?stripe=refresh`;
    const returnUrl = defaultPlatformUrl || `${new URL(request.url).origin}/marketplace/account?stripe=return`;
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return json({ url: link.url, accountId });
  } catch (cause) {
    console.error('[marketplace-connect] error', cause);
    return json({ error: 'Unable to start onboarding' }, 502);
  }
});

