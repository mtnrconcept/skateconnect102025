import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swords, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { acceptGOSMatch, declineGOSMatch } from "@/lib/skate";

interface GameInvite {
  matchId: string;
  riderA: string;
  riderB: string;
  inviterName?: string;
}

interface GameInviteManagerProps {
  currentUserId?: string | null;
  onOpenMatch: (matchId: string) => void;
}

export default function GameInviteManager({ currentUserId, onOpenMatch }: GameInviteManagerProps) {
  const [queue, setQueue] = useState<GameInvite[]>([]);
  const [processing, setProcessing] = useState(false);
  const nameCache = useRef(new Map<string, string>());
  const activeInvite = queue[0];

  const resolveInviterName = useCallback(async (userId: string): Promise<string> => {
    if (!userId) return "Un rider";
    if (nameCache.current.has(userId)) {
      return nameCache.current.get(userId)!;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[gos] Impossible de charger le profil de l'invitant", error);
    }

    const name = data?.display_name || data?.username || "Un rider";
    nameCache.current.set(userId, name);
    return name;
  }, []);

  const upsertInvite = useCallback((invite: GameInvite) => {
    setQueue((prev) => {
      const existing = prev.find((i) => i.matchId === invite.matchId);
      if (existing) {
        return prev.map((i) => (i.matchId === invite.matchId ? { ...existing, ...invite } : i));
      }
      return [...prev, invite];
    });
  }, []);

  const removeInvite = useCallback((matchId: string) => {
    setQueue((prev) => prev.filter((invite) => invite.matchId !== matchId));
  }, []);

  const queueFromRow = useCallback(
    async (row: { id: string; rider_a: string; rider_b: string }) => {
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

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    const loadExisting = async () => {
      const { data, error } = await supabase
        .from("gos_match")
        .select("id, rider_a, rider_b, status")
        .eq("rider_b", currentUserId)
        .eq("status", "pending");

      if (error) {
        console.error("Impossible de charger les invitations GOS:", error);
        return;
      }

      for (const row of data ?? []) {
        if (cancelled) break;
        await queueFromRow(row);
      }
    };

    void loadExisting();

    const channel = supabase
      .channel(`gos-invite-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gos_match",
          filter: `rider_b=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; rider_a: string; rider_b: string; status?: string };
          if (row?.status === "pending" && !cancelled) {
            void queueFromRow(row);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gos_match",
          filter: `rider_b=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; rider_a: string; rider_b: string; status?: string };
          if (!row?.id) return;
          if (row.status === "pending" && !cancelled) {
            void queueFromRow(row);
          } else {
            removeInvite(row.id);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, queueFromRow, removeInvite]);

  const handleAction = useCallback(
    async (action: "accept" | "decline") => {
      const invite = activeInvite;
      if (!invite || !currentUserId) return;

      setProcessing(true);
      try {
        if (action === "accept") {
          await acceptGOSMatch(invite.matchId, currentUserId);
          removeInvite(invite.matchId);
          onOpenMatch(invite.matchId);
        } else {
          await declineGOSMatch(invite.matchId, currentUserId);
          removeInvite(invite.matchId);
        }
      } catch (error) {
        console.error("Erreur lors du traitement de l'invitation GOS:", error);
      } finally {
        setProcessing(false);
      }
    },
    [activeInvite, currentUserId, onOpenMatch, removeInvite]
  );

  const inviterName = useMemo(() => {
    if (!activeInvite) return null;
    return activeInvite.inviterName || "Un rider";
  }, [activeInvite]);

  if (!activeInvite || !currentUserId) {
    return null;
  }

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
