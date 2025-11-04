import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useRouter } from "../../lib/router";
import { Bell, Check, X } from "lucide-react";

type IncomingInvite = {
  id: string;
  gosMatchId: string;
  skateMatchId: string;
  inviterName: string;
  roomUrl: string;
  ts: number;
};

interface GameInviteListenerProps {
  /** id utilisateur connecté (profiles.id / auth.user.id) */
  userId: string | null | undefined;
}

/**
 * Écoute les invitations GOS sur canal personnel `gos:notify:<userId>`.
 * Affiche un toast. "Accepter" => active le match & redirige vers la salle.
 */
export default function GameInviteListener({ userId }: GameInviteListenerProps) {
  const { navigate } = useRouter();
  const [invites, setInvites] = useState<IncomingInvite[]>([]);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const channelName = useMemo(() => (userId ? `gos:notify:${userId}` : null), [userId]);

  useEffect(() => {
    if (!channelName) return;
    // Nettoie canal précédent si user change
    if (chanRef.current) {
      try {
        supabase.removeChannel(chanRef.current);
      } catch {}
      chanRef.current = null;
    }

    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: false }, presence: { key: userId! } } })
      .on("broadcast", { event: "gos:invite" }, ({ payload }) => {
        const invite: IncomingInvite = {
          id: crypto.randomUUID(),
          gosMatchId: String(payload.gosMatchId),
          skateMatchId: String(payload.skateMatchId),
          inviterName: String(payload.inviterName ?? "Un rider"),
          roomUrl: String(payload.roomUrl),
          ts: Number(payload.ts) || Date.now(),
        };
        setInvites((prev) => {
          // évite doublons (même gosMatchId dans la pile)
          if (prev.some((i) => i.gosMatchId === invite.gosMatchId)) return prev;
          return [invite, ...prev].slice(0, 3);
        });
      })
      .subscribe();

    chanRef.current = channel;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
      chanRef.current = null;
    };
  }, [channelName, userId]);

  const accept = async (inv: IncomingInvite) => {
    try {
      // Active le match côté DB (fallback si RPC absent)
      await supabase
        .from("gos_match")
        .update({ status: "active", accepted_at: new Date().toISOString() })
        .eq("id", inv.gosMatchId);

      // Redirection vers la salle (utilise le lien fourni)
      navigate(new URL(inv.roomUrl).pathname + new URL(inv.roomUrl).search);
    } catch {
      // En cas d’échec, tente quand même la navigation
      navigate(`/live?match=${inv.skateMatchId}`);
    } finally {
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    }
  };

  const dismiss = (id: string) => setInvites((prev) => prev.filter((i) => i.id !== id));

  if (!userId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      {invites.map((inv) => (
        <div
          key={inv.id}
          className="w-[320px] rounded-xl border border-white/10 bg-[#0E0E12]/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-start gap-3 p-4">
            <div className="mt-0.5 rounded-lg bg-[#FF6A00]/15 p-2">
              <Bell className="h-5 w-5 text-[#FF6A00]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                Invitation Game of S.K.A.T.E
              </div>
              <div className="mt-1 text-xs text-white/70">
                {inv.inviterName} te défie en live. Rejoins la salle pour accepter.
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => accept(inv)}
                  className="inline-flex items-center gap-2 rounded-md bg-[#FF6A00] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#ff7d1f]"
                >
                  <Check className="h-4 w-4" />
                  Accepter
                </button>
                <button
                  onClick={() => dismiss(inv.id)}
                  className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                  Plus tard
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-white/30">
            {new Date(inv.ts).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}
