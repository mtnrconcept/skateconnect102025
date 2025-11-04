// src/hooks/useGosRealtime.ts
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { GosMatch } from "@/lib/gosMatchApi";

export interface GosChatMessage {
  id: number;
  match_id: string;
  sender: string | null;
  kind: "text" | "system" | "event";
  text: string | null;
  payload: any;
  created_at: string;
}

export function useGosRealtime(matchId: string, me: string) {
  const chanRef = useRef<RealtimeChannel | null>(null);
  const [online, setOnline] = useState(true);
  const [match, setMatch] = useState<GosMatch | null>(null);
  const [messages, setMessages] = useState<GosChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      // Fetch init
      const [m, c] = await Promise.all([
        supabase
          .from("gos_match")
          .select("id,rider_a,rider_b,turn,letters_a,letters_b,status,winner,created_at,accepted_at,starts_at,countdown_s")
          .eq("id", matchId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("gos_chat_message")
          .select("*")
          .eq("match_id", matchId)
          .order("id", { ascending: true }),
      ]);

      if (!mounted) return;
      if (!m.error) setMatch((m.data as GosMatch) ?? null);
      if (!c.error) setMessages((c.data as GosChatMessage[]) ?? []);

      // Realtime
      const channel = supabase
        .channel(`gos:${matchId}`, {
          config: { broadcast: { self: false }, presence: { key: me } },
        })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
          (payload) => setMatch(payload.new as GosMatch),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
          (payload) => setMessages((prev) => [...prev, payload.new as GosChatMessage]),
        )
        .subscribe((status) => setOnline(status === "SUBSCRIBED"));

      chanRef.current = channel;
      setLoading(false);
    };

    bootstrap();

    return () => {
      mounted = false;
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, [matchId, me]);

  return { match, messages, online, loading, setMatch, setMessages };
}
