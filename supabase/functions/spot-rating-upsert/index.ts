// Deno Deploy / Supabase Edge Function
// Upsert sécurisé d’une note (spot_id,user_id) => rating/comment

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  spot_id: string;
  rating: number;
  comment?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    // 1) Auth: on exige le Bearer token utilisateur
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer "))
      return bad(401, "Missing/invalid Authorization header");

    // 2) Payload
    const { spot_id, rating, comment }: Body = await req.json().catch(() => ({} as any));
    if (!spot_id) return bad(400, "spot_id is required");
    if (typeof rating !== "number" || rating < 1 || rating > 5)
      return bad(400, "rating must be a number between 1 and 5");

    // 3) Supabase client qui RELAIE le JWT (respect RLS)
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: { Authorization: auth },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // 4) Récup user_id à partir du JWT (évite la triche)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return bad(401, "Invalid user session");
    const user_id = userData.user.id;

    // 5) UPSERT (doit correspondre à l’index unique (spot_id,user_id))
    const { error } = await supabase
      .from("spot_ratings")
      .upsert(
        { spot_id, user_id, rating, comment: comment ?? null, updated_at: new Date().toISOString() },
        { onConflict: "spot_id,user_id" }
      )
      // on minimise la réponse => moins d’egress
      .select("spot_id,user_id,rating,comment,updated_at")
      .single();

    if (error) return bad(400, error.message);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return bad(500, e?.message ?? "internal error");
  }
});

