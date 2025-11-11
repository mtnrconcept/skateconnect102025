import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swords, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "@/lib/router";
import { supabase } from "@/lib/supabaseClient";
import { acceptGOSMatch, declineGOSMatch, markGOSMatchActive } from "@/lib/skate";

interface GameInvite {
  matchId: string;               // id du gos_match
  riderA: string;
  riderB: string;
  inviterName?: string;
}

interface GameInviteManagerProps {
  currentUserId?: string | null;
}

const LIVE_SKATE_PATH = "/skate/live";
const LIVE_SKATE_PARAM = "room";

const buildLiveSkateUrl = (gosId: string) =>
  `${LIVE_SKATE_PATH}?${LIVE_SKATE_PARAM}=${encodeURIComponent(gosId)}`;

export default function GameInviteManager({ currentUserId }: GameInviteManagerProps) {
  const [queue, setQueue] = useState<GameInvite[]>([]);
  const [processing, setProcessing] = useState(false);
  const nameCache = useRef(new Map<string, string>());
  const { navigate } = useRouter();
  const activeInvite = queue[0];
  const navigatingRef = useRef(false);

  const resolveInviterName = useCallback(async (userId: string): Promise<string> => {
    if (!userId) return "Un rider";
    if (nameCache.current.has(userId)) return nameCache.current.get(userId)!;

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.warn("[gos] profil invitant non résolu:", error);

    const name = data?.display_name || data?.username || "Un rider";
    nameCache.current.set(userId, name);
    return name;
  }, []);

  const upsertInvite = useCallback((invite: GameInvite) => {
    setQueue((prev) => {
      const existing = prev.find((i) => i.matchId === invite.matchId);
      if (existing) return prev.map((i) => (i.matchId === invite.matchId ? { ...existing, ...invite } : i));
      return [...prev, invite];
    });
  }, []);

  const removeInvite = useCallback((matchId: string) => {
    setQueue((prev) => prev.filter((i) => i.matchId !== matchId));
  }, []);

  const queueFromRow = useCallback(
    async (row: { id: string; rider_a: string; rider_b: string; status?: string }) => {
      const inviterName = await resolveInviterName(row.rider_a);
      upsertInvite({
        matchId: row.id,
        riderA: row.rider_a,
        riderB: row.rider_b,
        inviterName,
      });
    },
    [resolveInviterName, upsertInvite]
  );

  // Récupère les invites pending pour B + écoute INSERT/UPDATE
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("gos_match")
        .select("id, rider_a, rider_b, status")
        .eq("rider_b", currentUserId)
        .eq("status", "pending");
      if (error) {
        console.error("[gos] load pending:", error);
      } else {
        for (const row of data ?? []) {
          if (cancelled) break;
          await queueFromRow(row);
        }
      }
    })();

    const channel = supabase
      .channel(`gos-invite-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gos_match", filter: `rider_b=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as { id: string; rider_a: string; rider_b: string; status?: string };
          if (!cancelled && row?.status === "pending") void queueFromRow(row);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gos_match", filter: `rider_b=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as { id: string; status?: string };
          if (!row?.id) return;
          // si passe out of pending, on retire la modale
          if (row.status !== "pending") removeInvite(row.id);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, queueFromRow, removeInvite]);

  const hardNavigateToLiveRoom = useCallback((gosId: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    const rel = buildLiveSkateUrl(gosId);
    try {
      navigate(rel);
    } catch {}

    setTimeout(() => {
      const ok =
        typeof window !== "undefined" &&
        window.location.pathname === LIVE_SKATE_PATH &&
        window.location.search.includes(`${LIVE_SKATE_PARAM}=${encodeURIComponent(gosId)}`);
      if (!ok) {
        if (typeof window !== "undefined") {
          const abs = new URL(window.location.href);
          abs.pathname = LIVE_SKATE_PATH;
          abs.search = `?${LIVE_SKATE_PARAM}=${encodeURIComponent(gosId)}`;
          try {
            window.location.replace(abs.toString());
          } catch {
            window.location.href = abs.toString();
          }
        }
      }
      setTimeout(() => (navigatingRef.current = false), 300);
    }, 80);
  }, [navigate]);

  const handleAction = useCallback(
    async (action: "accept" | "decline") => {
      const invite = activeInvite;
      if (!invite || !currentUserId) return;

      setProcessing(true);
      try {
        if (action === "accept") {
          // Edge Function vérifie que rider_b = auth.uid()
          try {
            await acceptGOSMatch(invite.matchId);
          } catch (edgeError) {
            console.warn("[gos] accept Edge Function failed, continuing with local update", edgeError);
          }
          await markGOSMatchActive(invite.matchId, 5, currentUserId ?? undefined);
        } else {
          await declineGOSMatch(invite.matchId);
        }
      } catch (error) {
        console.error("[gos] Accept/Decline error:", error);
      } finally {
        if (action === "accept") {
          hardNavigateToLiveRoom(invite.matchId);
        }
        removeInvite(invite.matchId);
        setProcessing(false);
      }
    },
    [activeInvite, currentUserId, removeInvite, hardNavigateToLiveRoom]
  );

  const inviterName = useMemo(() => activeInvite?.inviterName ?? "Un rider", [activeInvite]);

  if (!activeInvite || !currentUserId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F1319] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3 text-white">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/10 text-orange-300">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Invitation Game of S.K.A.T.E</h2>
            <p className="text-sm text-white/60">{inviterName} te défie en live.</p>
          </div>
        </div>

        <p className="text-sm text-white/70">
          Accepte pour rejoindre la salle en direct. Ton adversaire t'attend pour lancer le duel.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => handleAction("accept")}
            disabled={processing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black disabled:opacity-60"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            Rejoindre
          </button>
          <button
            onClick={() => handleAction("decline")}
            disabled={processing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
