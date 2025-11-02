import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export function useRealtime(matchId: string, me: string, onChatInsert: (row: any)=>void, onMatchUpdate: (row: any)=>void) {
  const [status, setStatus] = useState<"IDLE"|"SUBSCRIBED"|"CLOSED"|"ERROR"|"TIMED_OUT">("IDLE");
  const chanRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const chan = supabase.channel(`gos:${matchId}`, {
      config: { broadcast: { self: false }, presence: { key: me } },
    })
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
      (payload) => { onChatInsert(payload.new); }
    )
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
      (payload) => { onMatchUpdate(payload.new); }
    )
    .subscribe((s) => {
      setStatus(s as any);
      console.log("[realtime] status:", s);
    });

    chanRef.current = chan;
    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current); };
  }, [matchId, me]);

  return status;
}
