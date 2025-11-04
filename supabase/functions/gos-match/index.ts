import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "*",
};

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
    },
  });
}

async function getUser(authHeader: string) {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data, error } = await anonClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

type Side = "A" | "B";

async function loadMatch(matchId: string) {
  const { data, error } = await service.from("gos_match").select("*").eq("id", matchId).single();
  if (error || !data) return null;
  return data as any;
}

function ensureParticipant(match: any, userId: string) {
  if (match.rider_a === userId) return "A" as Side;
  if (match.rider_b === userId) return "B" as Side;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method Not Allowed" });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "Missing Authorization header" });
    }

    const user = await getUser(authHeader);
    if (!user) {
      return json(401, { error: "Invalid user session" });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    switch (action) {
      case "create": {
        const opponentId = body?.opponent_id as string | undefined;
        const skateMatchId = body?.skate_match_id as string | undefined;
        if (!opponentId) return json(400, { error: "opponent_id required" });
        if (opponentId === user.id) return json(400, { error: "Impossible de t'auto-défier" });

        const insert = {
          rider_a: user.id,
          rider_b: opponentId,
          turn: "A",
          letters_a: 0,
          letters_b: 0,
          status: "pending",
          skate_match_id: skateMatchId ?? null,
        };

        const { data, error } = await service.from("gos_match").insert(insert).select("*").single();
        if (error || !data) return json(400, { error: error?.message ?? "insert failed" });

        const inviterName = (body?.inviter_name as string | undefined) ?? null;

        if (data?.id) {
          await service
            .from("gos_chat_message")
            .insert({
              match_id: data.id,
              sender: null,
              kind: "system",
              text: "Invitation envoyée. Rider A attend la réponse.",
            })
            .catch(() => {});
        }

        await service
          .from("notifications")
          .insert({
            user_id: opponentId,
            type: "gos_invite",
            title: "Défi Game of S.K.A.T.E",
            body: inviterName
              ? `${inviterName} t'invite à un duel live`
              : "Un rider t'invite à un duel live",
            data: {
              match_id: data.id,
              rider_a: insert.rider_a,
              rider_b: insert.rider_b,
              inviter_name: inviterName,
            },
          })
          .catch(() => {});

        return json(200, { match: data });
      }

      case "accept": {
        const matchId = body?.match_id as string | undefined;
        if (!matchId) return json(400, { error: "match_id required" });

        const match = await loadMatch(matchId);
        if (!match) return json(404, { error: "Match introuvable" });
        if (match.rider_b !== user.id) return json(403, { error: "Tu n'es pas l'invité de ce match" });
        if (match.status !== "pending") return json(409, { error: "Ce match a déjà été traité" });

        const countdownStartAt = new Date(Date.now() + 10_000).toISOString();

        const { data, error } = await service
          .from("gos_match")
          .update({
            status: "active",
            accepted_at: new Date().toISOString(),
            countdown_started_at: countdownStartAt,
          })
          .eq("id", matchId)
          .select("*")
          .single();
        if (error || !data) return json(400, { error: error?.message ?? "update failed" });

        await service
          .from("gos_chat_message")
          .insert({
            match_id: matchId,
            sender: null,
            kind: "system",
            text: "Le duel commence ! Rider A ouvre le jeu.",
            payload: { type: "accept" },
          })
          .catch(() => {});

        return json(200, { match: data });
      }

      case "decline": {
        const matchId = body?.match_id as string | undefined;
        if (!matchId) return json(400, { error: "match_id required" });

        const match = await loadMatch(matchId);
        if (!match) return json(404, { error: "Match introuvable" });
        if (match.rider_b !== user.id) return json(403, { error: "Tu n'es pas l'invité de ce match" });
        if (match.status !== "pending") return json(409, { error: "Ce match a déjà été traité" });

        const { data, error } = await service
          .from("gos_match")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", matchId)
          .select("*")
          .single();
        if (error || !data) return json(400, { error: error?.message ?? "update failed" });

        return json(200, { match: data });
      }

      case "set_fail": {
        const matchId = body?.match_id as string | undefined;
        if (!matchId) return json(400, { error: "match_id required" });

        const match = await loadMatch(matchId);
        if (!match) return json(404, { error: "Match introuvable" });
        const side = ensureParticipant(match, user.id);
        if (!side) return json(403, { error: "Tu ne participes pas à ce match" });
        if (match.status !== "active") return json(409, { error: "Match inactif" });
        if (match.turn !== side) return json(409, { error: "Ce n'est pas ton tour" });

        const nextTurn: Side = side === "A" ? "B" : "A";
        const { data, error } = await service
          .from("gos_match")
          .update({ turn: nextTurn })
          .eq("id", matchId)
          .select("*")
          .single();
        if (error || !data) return json(400, { error: error?.message ?? "update failed" });

        return json(200, { match: data });
      }

      case "add_letter": {
        const matchId = body?.match_id as string | undefined;
        const side = body?.side as Side | undefined;
        const lettersSet = (body?.letters_set as string | undefined)?.trim() || "SHRED";

        if (!matchId || (side !== "A" && side !== "B")) {
          return json(400, { error: "match_id et side requis" });
        }

        const match = await loadMatch(matchId);
        if (!match) return json(404, { error: "Match introuvable" });
        const participantSide = ensureParticipant(match, user.id);
        if (!participantSide) return json(403, { error: "Tu ne participes pas à ce match" });
        if (participantSide !== side) {
          return json(403, { error: "Impossible de donner une lettre au rival" });
        }
        if (match.status !== "active") return json(409, { error: "Match inactif" });

        const column = side === "A" ? "letters_a" : "letters_b";
        const currentLetters = Number(match[column] ?? 0);
        const newLetters = currentLetters + 1;
        const updates: Record<string, any> = { [column]: newLetters };
        if (newLetters >= lettersSet.length) {
          updates.status = "ended";
          updates.winner = side === "A" ? "B" : "A";
        }

        const { data, error } = await service
          .from("gos_match")
          .update(updates)
          .eq("id", matchId)
          .select("*")
          .single();
        if (error || !data) return json(400, { error: error?.message ?? "update failed" });

        return json(200, { match: data });
      }

      case "chat": {
        const matchId = body?.match_id as string | undefined;
        const kind = body?.kind as string | undefined;
        const text = body?.text as string | undefined;
        const payload = body?.payload ?? null;

        if (!matchId || !kind) return json(400, { error: "match_id et kind requis" });

        const match = await loadMatch(matchId);
        if (!match) return json(404, { error: "Match introuvable" });
        const participantSide = ensureParticipant(match, user.id);
        if (!participantSide) return json(403, { error: "Tu ne participes pas à ce match" });

        const { data, error } = await service
          .from("gos_chat_message")
          .insert({
            match_id: matchId,
            sender: user.id,
            kind,
            text: text ?? null,
            payload: payload ?? null,
          })
          .select("*")
          .single();
        if (error || !data) return json(400, { error: error?.message ?? "insert failed" });

        return json(200, { message: data });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (error: any) {
    console.error("[gos-match]", error);
    return json(500, { error: error?.message ?? "internal error" });
  }
});
