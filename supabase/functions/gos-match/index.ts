/// <reference lib="deno.unstable" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://192.168.0.33:5173",
  "http://192.168.0.33:5174",
  "https://vlhxrovtrdhcmvvqlryd.supabase.co",
]);

const defaultOrigin = "https://vlhxrovtrdhcmvvqlryd.supabase.co";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, X-Client-Info, content-type, x-supabase-api-version"
};

const withCors = (extra: Record<string, string> = {}) => ({
  ...corsHeaders,
  ...extra
});

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });

function normalizeOrigin(origin: string | null): string {
  return (origin ?? "").replace(/\/$/, "");
}

function resolveCorsHeaders(req: Request) {
  const rawOrigin = req.headers.get("origin") ?? "";
  const origin = normalizeOrigin(rawOrigin);
  let allowOrigin = defaultOrigin;

  if (origin) {
    if (allowedOrigins.has(origin)) {
      allowOrigin = origin;
    } else if (/^http:\/\/localhost:(\d+)$/.test(origin)) {
      allowOrigin = origin;
    }
  }

  return withCors({
    "Access-Control-Allow-Origin": allowOrigin || "*",
  });
}

const clampCountdown = (value: unknown, fallback = 5): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30, Math.max(3, Math.floor(parsed)));
};

type SupabaseClient = ReturnType<typeof createClient>;

interface AuthedContext {
  supabase: SupabaseClient;
  userId: string;
}

interface GosMatchRow {
  id: string;
  rider_a: string;
  rider_b: string;
  status: string;
  turn: "A" | "B";
  letters_a: number;
  letters_b: number;
  skate_match_id?: string | null;
}

type RequestBody = Record<string, unknown>;

async function withAuth(req: Request): Promise<AuthedContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Missing/invalid Authorization header");
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new HttpError(401, "Invalid user session");
  }
  return {
    supabase,
    userId: data.user.id
  };
}

async function fetchMatch(supabase: SupabaseClient, matchId: string): Promise<GosMatchRow> {
  const { data, error } = await supabase
    .from("gos_match")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error || !data) {
    throw new HttpError(404, "Match introuvable");
  }
  return data;
}

async function handleCreate(ctx: AuthedContext, body: RequestBody, cors: Record<string, string>) {
  const opponentId = typeof body.opponent_id === "string" ? body.opponent_id : null;
  if (!opponentId) throw new HttpError(400, "opponent_id requis");
  if (opponentId === ctx.userId) {
    throw new HttpError(400, "Impossible de te défier toi-même");
  }
  const insertPayload: Record<string, unknown> = {
    rider_a: ctx.userId,
    rider_b: opponentId,
    status: "pending",
    turn: "A",
    letters_a: 0,
    letters_b: 0
  };
  if (typeof body.skate_match_id === "string") {
    insertPayload.skate_match_id = body.skate_match_id;
  }
  const { data, error } = await ctx.supabase
    .from("gos_match")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error || !data) {
    throw new HttpError(400, error?.message ?? "Création impossible");
  }
  return json(200, { match: data }, cors);
}

async function handleAccept(ctx: AuthedContext, body: RequestBody, cors: Record<string, string>) {
  const matchId = typeof body.match_id === "string" ? body.match_id : null;
  if (!matchId) throw new HttpError(400, "match_id requis");

  // Appel RPC à gos_match_accept_v2
  const { data, error } = await ctx.supabase
    .rpc("gos_match_accept_v2", { p_match_id: matchId, p_acceptor: ctx.userId });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    throw new HttpError(400, error?.message ?? "Acceptation impossible");
  }

  const row = Array.isArray(data) ? data[0] : data;

  return json(200, {
    match: row.match_row ?? null,
    room: row.room_row ?? null,
    players: row.players ?? null
  }, cors);
}

async function handleDecline(ctx: AuthedContext, body: RequestBody, cors: Record<string, string>) {
  const matchId = typeof body.match_id === "string" ? body.match_id : null;
  if (!matchId) throw new HttpError(400, "match_id requis");
  const match = await fetchMatch(ctx.supabase, matchId);
  if (match.status !== "pending") {
    throw new HttpError(400, "Le duel n'est plus en attente");
  }
  if (match.rider_b !== ctx.userId && match.rider_a !== ctx.userId) {
    throw new HttpError(403, "Accès refusé");
  }
  const { data, error } = await ctx.supabase
    .from("gos_match")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString()
    })
    .eq("id", matchId)
    .select("*")
    .single();
  if (error || !data) {
    throw new HttpError(400, error?.message ?? "Annulation impossible");
  }
  return json(200, { match: data }, cors);
}

async function handleChat(ctx: AuthedContext, body: RequestBody, cors: Record<string, string>) {
  const matchId = typeof body.match_id === "string" ? body.match_id : null;
  const kind = typeof body.kind === "string" ? body.kind : null;
  if (!matchId || !kind) {
    throw new HttpError(400, "match_id et kind requis");
  }
  if (!["text", "event", "system"].includes(kind)) {
    throw new HttpError(400, "kind invalide");
  }
  await fetchMatch(ctx.supabase, matchId);
  const sender = kind === "system" ? null : ctx.userId;
  const { data, error } = await ctx.supabase
    .from("gos_chat_message")
    .insert({
      match_id: matchId,
      sender,
      kind,
      text: typeof body.text === "string" ? body.text : null,
      payload: body.payload ?? null
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new HttpError(400, error?.message ?? "Message rejeté");
  }
  return json(200, { message: data }, cors);
}

Deno.serve(async (req: Request) => {
  const cors = resolveCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method Not Allowed" }, cors);
  }
  try {
    const body = await req.json().catch(() => ({} as RequestBody));
    const action = typeof body.action === "string" ? body.action : "";
    if (!action) throw new HttpError(400, "action requise");
    const ctx = await withAuth(req);
    switch (action) {
      case "create":
        return await handleCreate(ctx, body, cors);
      case "accept":
        return await handleAccept(ctx, body, cors);
      case "decline":
        return await handleDecline(ctx, body, cors);
      case "chat":
        return await handleChat(ctx, body, cors);
      default:
        throw new HttpError(400, `action inconnue: ${action}`);
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.message }, cors);
    }
    console.error("[gos-match] unexpected error", error);
    return json(500, { error: "Erreur interne gos-match" }, cors);
  }
});
