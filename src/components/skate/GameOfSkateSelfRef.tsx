import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Send, Sparkles, TimerReset, MessageSquare, Crown, WifiOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Side = "A" | "B";
type Match = {
  id: string;
  rider_a: string;
  rider_b: string;
  turn: Side;
  letters_a: number;
  letters_b: number;
  status: "active" | "ended";
  winner: Side | null;
  created_at: string;
};
type ChatMessage = {
  id: number;
  match_id: string;
  sender: string | null;
  kind: "text" | "system" | "event";
  text: string | null;
  payload: any;
  created_at: string;
};

const Letters = ({ count }: { count: number }) => {
  const L = "SKATE".split("");
  return (
    <div className="flex gap-1">
      {L.map((ch, i) => (
        <span key={i} className={`w-7 h-7 grid place-items-center rounded-full border text-sm
          ${i < count ? "bg-orange-500 border-orange-400 text-black" : "border-white/20 text-white/70"}`}>
          {ch}
        </span>
      ))}
    </div>
  );
};

export default function GameOfSkateSelfRef({ matchId, me }: { matchId: string; me: string; }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [iAm, setIAm] = useState<Side>("A");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [rtOnline, setRtOnline] = useState(true);
  const chanRef = useRef<RealtimeChannel | null>(null);

  const myTurn = match?.turn === iAm;
  const iCopy = !!match && match.turn !== iAm;

  const fetchMatch = async () => {
    const { data, error } = await supabase.from("gos_match").select("*").eq("id", matchId).limit(1).maybeSingle();
    if (error && error.code !== "PGRST116") console.warn("[gos] match fetch error", error);
    const row = (data as Match) ?? null;
    setMatch(row);
    if (row) setIAm(me === row.rider_a ? "A" : "B");
  };
  const fetchChat = async () => {
    const { data, error } = await supabase.from("gos_chat_message").select("*").eq("match_id", matchId).order("id", { ascending: true });
    if (error) console.warn("[gos] chat fetch error", error);
    setMsgs((data as ChatMessage[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([fetchMatch(), fetchChat()]);
      const chan = supabase
        .channel(`gos:${matchId}`, { config: { broadcast: { self: false }, presence: { key: me } } })
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
          (payload) => setMsgs((prev) => [...prev, payload.new as ChatMessage])
        )
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
          (payload) => setMatch(payload.new as Match)
        )
        .subscribe((s) => setRtOnline(s === "SUBSCRIBED"));
      chanRef.current = chan;
    })();

    return () => { if (chanRef.current) supabase.removeChannel(chanRef.current); };
  }, [matchId, me]);

  // Chat via RPC => pas de 401/RLS
  const rpcPost = async (kind: "text" | "system" | "event", text: string, payload?: any) => {
    const { error } = await supabase.rpc("post_chat_message", {
      p_match_id: matchId,
      p_kind: kind,
      p_text: text,
      p_payload: payload ?? null,
    });
    if (error) console.warn("[gos] rpc chat error", error);
  };

  const postText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    if (t === "/set") return onSetSucceeded();
    if (t === "/fail") return onSetFailed();
    if (t === "/copyfail") return onCopyFailed();
    await rpcPost("text", t);
  };

  // Lettres & tour — UPDATE sans select (returning: 'minimal') pour éviter 406
  const addLetter = async (side: Side) => {
    if (!match) return;
    const col = side === "A" ? "letters_a" : "letters_b";
    const newCount = (match[col as keyof Match] as number) + 1;
    const ended = newCount >= 5;
    const updates: Partial<Match> = { [col]: newCount } as any;
    if (ended) { updates.status = "ended"; updates.winner = side === "A" ? "B" : "A"; }

    // ❌ ancien
// const { error } = await supabase.from("gos_match").update(updates, { returning: "minimal" }).eq("id", matchId);

// ✅ v2 — 204 No Content ; pas de payload à parser
const { error } = await supabase
.from("gos_match")
.update(updates)
.eq("id", matchId);

    if (error) console.warn("[gos] match update error", error);
    // Optimisme local — Realtime poussera l'état final à tous
    setMatch(prev => prev ? ({ ...prev, ...updates } as Match) : prev);
    return { ended };
  };

  const onSetSucceeded = async () => {
    if (!match || match.status === "ended" || !myTurn) return;
    await rpcPost("event", `${iAm} valide son set. L’adversaire doit copier.`, { actor: iAm, type: "set_ok" });
  };

  const onCopyFailed = async () => {
    if (!match || match.status === "ended" || !iCopy) return;
    const loser: Side = match.turn === "A" ? "B" : "A";
    const res = await addLetter(loser);
    await rpcPost("event", `${loser} échoue la copie → +1 lettre`, { loser, type: "copy_fail" });
    if (res?.ended) await rpcPost("system", `Partie terminée. Vainqueur: ${loser === "A" ? "B" : "A"}`, { winner: loser === "A" ? "B" : "A" });
    else await rpcPost("system", `Tour conservé par ${match.turn}.`, { turn: match.turn });
  };

  const onSetFailed = async () => {
    if (!match || match.status === "ended" || !myTurn) return;
    // Utilise la RPC sécurisée pour basculer le tour côté serveur
    const { data, error } = await supabase.rpc("switch_turn", { p_match_id: matchId });
    if (error) console.warn("[gos] switch_turn error", error);
    if (data) setMatch(data as Match);
    await rpcPost("event", `${iAm} rate son set → main à ${iAm === "A" ? "B" : "A"}`, { actor: iAm, type: "set_fail" });
  };

  const badgeTurn = (s: Side) => (
    <span className={`px-2 py-0.5 rounded text-xs ${match?.turn === s ? "bg-orange-500 text-black" : "bg-white/10 text-white"}`}>
      {match?.turn === s ? "À toi" : "En attente"}
    </span>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Rider A */}
      <section className="rounded-2xl border border-white/10 bg-[#11151C]/80 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Rider A</h3>
          {badgeTurn("A")}
        </div>
        <div className="flex items-center justify-between mt-2">
          <Letters count={match?.letters_a || 0} />
          {iAm === "A" && (
            <div className="flex gap-2">
              <button onClick={onSetSucceeded} disabled={!myTurn || match?.status === "ended"} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-black disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Trick accepté
              </button>
              <button onClick={myTurn ? onSetFailed : onCopyFailed} disabled={match?.status === "ended"} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Trick refusé
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Centre */}
      <section className="rounded-2xl border border-white/10 bg-[#11151C]/80 p-4">
        <div className="flex items-center gap-2 text-white/80">
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold">Auto-arbitrage actif</span>
          {!rtOnline && <span className="ml-auto inline-flex items-center gap-2 text-amber-300 text-xs"><WifiOff className="w-4 h-4" /> Realtime offline</span>}
        </div>

        {match?.status === "ended" ? (
          <div className="mt-4 flex items-center gap-2 text-amber-300">
            <Crown className="w-4 h-4" /> Vainqueur : {match?.winner}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-white/70">
            <TimerReset className="w-4 h-4" /> Tour actuel : <b>{match?.turn ?? "—"}</b>
          </div>
        )}

        {/* Chat */}
        <div className="mt-4 rounded-xl border border-white/10">
          <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-white/80">
            <MessageSquare className="w-4 h-4" /> Chat & Événements
          </div>
          <div className="h-72 overflow-y-auto px-4 py-3 space-y-2">
            {msgs.map((m) => (
              <div key={m.id} className="text-sm">
                {m.kind === "text" ? (
                  <div className="text-white/90">
                    <span className="text-white/40 mr-2">{new Date(m.created_at).toLocaleTimeString()}</span>
                    <span className="font-medium">
                      {match ? (m.sender === match.rider_a ? "A" : m.sender === match.rider_b ? "B" : "?") : "?"}
                    </span>
                    <span className="mx-2 text-white/40">•</span>
                    {m.text}
                  </div>
                ) : (
                  <div className={`text-xs ${m.kind === "system" ? "text-white/50" : "text-orange-300"}`}>
                    <span className="text-white/40 mr-2">{new Date(m.created_at).toLocaleTimeString()}</span>
                    {m.text}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=> e.key==="Enter" && postText()}
              placeholder="Écris… (/set, /fail, /copyfail)" className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40" />
            <button onClick={postText} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-black">
              <Send className="w-4 h-4" /> Envoyer
            </button>
          </div>
        </div>
      </section>

      {/* Rider B */}
      <section className="rounded-2xl border border-white/10 bg-[#11151C]/80 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Rider B</h3>
          {badgeTurn("B")}
        </div>
        <div className="flex items-center justify-between mt-2">
          <Letters count={match?.letters_b || 0} />
          {iAm === "B" && (
            <div className="flex gap-2">
              <button onClick={onSetSucceeded} disabled={!myTurn || match?.status === "ended"} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-black disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Trick accepté
              </button>
              <button onClick={myTurn ? onSetFailed : onCopyFailed} disabled={match?.status === "ended"} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Trick refusé
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
