import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Wifi, WifiOff, Activity, Send } from "lucide-react";

export default function RealtimeHealth({ matchId }:{ matchId: string }) {
  const [socketState, setSocketState] = useState<string>("unknown");

  useEffect(() => {
    const i = setInterval(() => {
      // @ts-ignore interne client
      const s = (supabase as any)._realtime?.socket?.connectionState?.() ?? "unknown";
      setSocketState(String(s));
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const ping = async () => {
    // Insert "system" pour forcer un INSERT observable en live (si RLS OK)
    const { error } = await supabase.from("gos_chat_message").insert({
      match_id: matchId, sender: null, kind: "system", text: "🔔 live ping", payload: { t: Date.now() }
    });
    if (error) console.warn("[realtime] ping insert error:", error);
  };

  const Icon = socketState === "open" ? Wifi : WifiOff;

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B0E13] px-3 py-2 text-sm text-white/80">
      <Activity className="w-4 h-4 text-white/60" />
      Realtime socket: <b className="ml-1">{socketState}</b>
      <button onClick={ping} className="ml-auto inline-flex items-center gap-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20">
        <Send className="w-4 h-4" /> Ping
      </button>
      <Icon className="w-4 h-4" />
    </div>
  );
}
