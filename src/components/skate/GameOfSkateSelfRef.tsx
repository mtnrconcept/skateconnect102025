import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  MessageSquare,
  Crown,
  WifiOff,
  Settings,
  Info,
} from "lucide-react";
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

const LETTERS = ["S", "H", "R", "E", "D"];
const RULE_OPTIONS = ["Game of Skate", "Best Trick", "Mort subite"];

const Letters = ({ count }: { count: number }) => (
  <div className="flex gap-2">
    {LETTERS.map((letter, idx) => (
      <span
        key={letter}
        className={`w-9 h-9 grid place-items-center rounded-full border text-base font-semibold transition-colors shadow-[0_0_14px_rgba(0,0,0,0.35)]
        ${
          idx < count
            ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_18px_rgba(255,138,0,0.6)]"
            : "border-white/10 text-white/50"
        }`}
      >
        {letter}
      </span>
    ))}
  </div>
);

export default function GameOfSkateSelfRef({ matchId, me }: { matchId: string; me: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [iAm, setIAm] = useState<Side>("A");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [rtOnline, setRtOnline] = useState(true);
  const [profileAName, setProfileAName] = useState("Rider A");
  const [profileBName, setProfileBName] = useState("Rider B");
  const [selectedRule, setSelectedRule] = useState(RULE_OPTIONS[0]);
  const [trickToDo, setTrickToDo] = useState("");
  const [timer, setTimer] = useState(45);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
    const { data, error } = await supabase
      .from("gos_chat_message")
      .select("*")
      .eq("match_id", matchId)
      .order("id", { ascending: true });
    if (error) console.warn("[gos] chat fetch error", error);
    setMsgs((data as ChatMessage[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([fetchMatch(), fetchChat()]);
      const chan = supabase
        .channel(`gos:${matchId}`, { config: { broadcast: { self: false }, presence: { key: me } } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
          (payload) => setMsgs((prev) => [...prev, payload.new as ChatMessage])
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
          (payload) => setMatch(payload.new as Match)
        )
        .subscribe((status) => setRtOnline(status === "SUBSCRIBED"));
      chanRef.current = chan;
    })();

    return () => {
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, [matchId, me]);

  useEffect(() => {
    if (!match) return;
    let canceled = false;
    (async () => {
      const [{ data: profileA }, { data: profileB }] = await Promise.all([
        supabase.from("profiles").select("display_name, username, full_name").eq("id", match.rider_a).maybeSingle(),
        supabase.from("profiles").select("display_name, username, full_name").eq("id", match.rider_b).maybeSingle(),
      ]);
      if (canceled) return;
      const format = (row: any, fallback: string) => row?.display_name || row?.full_name || row?.username || fallback;
      setProfileAName(format(profileA, "Rider A"));
      setProfileBName(format(profileB, "Rider B"));
    })();
    return () => {
      canceled = true;
    };
  }, [match?.rider_a, match?.rider_b]);

  useEffect(() => {
    if (!match || match.status === "ended") {
      setTimer(0);
      return;
    }
    setTimer(45);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 45 - elapsed);
      setTimer(Math.round(remaining * 10) / 10);
    }, 100);
    return () => clearInterval(id);
  }, [match?.turn, match?.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

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
    const ended = newCount >= LETTERS.length;
    const updates: Partial<Match> = { [col]: newCount } as any;
    if (ended) {
      updates.status = "ended";
      updates.winner = side === "A" ? "B" : "A";
    }

    const { error } = await supabase.from("gos_match").update(updates).eq("id", matchId);
    if (error) console.warn("[gos] match update error", error);
    setMatch((prev) => (prev ? ({ ...prev, ...updates } as Match) : prev));
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
    if (res?.ended)
      await rpcPost("system", `Partie terminée. Vainqueur: ${loser === "A" ? "B" : "A"}`, {
        winner: loser === "A" ? "B" : "A",
      });
    else await rpcPost("system", `Tour conservé par ${match.turn}.`, { turn: match.turn });
  };

  const onSetFailed = async () => {
    if (!match || match.status === "ended" || !myTurn) return;
    const { data, error } = await supabase.rpc("switch_turn", { p_match_id: matchId });
    if (error) console.warn("[gos] switch_turn error", error);
    if (data) setMatch(data as Match);
    await rpcPost("event", `${iAm} rate son set → main à ${iAm === "A" ? "B" : "A"}`, { actor: iAm, type: "set_fail" });
  };

  const handleTrickRefused = () => {
    if (match?.status === "ended") return;
    return myTurn ? onSetFailed() : onCopyFailed();
  };

  const badgeTurn = (side: Side) => (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] transition-colors
      ${match?.turn === side ? "bg-orange-500 text-black shadow-[0_0_14px_rgba(255,138,0,0.5)]" : "bg-white/5 text-white/50"}`}
    >
      {match?.turn === side ? "À toi" : "En attente"}
    </span>
  );

  const resolveSender = (message: ChatMessage): Side | null => {
    if (!match) return null;
    if (message.sender === match.rider_a) return "A";
    if (message.sender === match.rider_b) return "B";
    return null;
  };

  const gameStatusText = () => {
    if (!match) return "Chargement du match…";
    if (match.status === "ended") {
      const winner = match.winner === "A" ? profileAName : profileBName;
      return `Partie terminée. ${winner} est sacré vainqueur.`;
    }
    const current = match.turn === "A" ? profileAName : profileBName;
    return `Tour de ${current}. ${myTurn ? "Tu peux valider ou refuser." : "En attente de la décision adverse."}`;
  };

  return (
    <div className="min-h-screen bg-[#05070b] px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)]">
        {/* Rider A */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>{profileAName}</span>
            {badgeTurn("A")}
          </div>
          <div className="mt-6 flex justify-center">
            <Letters count={match?.letters_a ?? 0} />
          </div>
          <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/60">
            <div className="grid h-full place-items-center text-sm text-white/40">Vidéo Rider A</div>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-white/40">
            <span>Latence A</span>
            <div className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 w-3/4 rounded-full bg-emerald-400/90"></div>
            </div>
            <span>Latence B−</span>
          </div>

          <div className="mt-6 flex h-80 flex-col rounded-2xl border border-white/10 bg-black/40">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
              <MessageSquare className="h-4 w-4" /> Live Chat
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" role="log" aria-live="polite">
              {msgs.map((message) => {
                const side = resolveSender(message);
                const isSystem = message.kind !== "text";
                const align = isSystem ? "items-center" : side === "A" ? "items-start" : "items-end";
                return (
                  <div key={message.id} className={`flex flex-col ${align}`}>
                    {isSystem ? (
                      <div className="max-w-[85%] rounded-md bg-white/5 px-3 py-2 text-xs text-white/60">
                        <span className="block text-[10px] text-white/30">{new Date(message.created_at).toLocaleTimeString()}</span>
                        {message.text}
                      </div>
                    ) : (
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-[0_0_18px_rgba(0,0,0,0.35)] ${
                          side === iAm ? "bg-orange-500/20 text-orange-100" : "bg-white/10 text-white"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                          <span>{side === "A" ? profileAName : profileBName}</span>
                          <span>•</span>
                          <span>{new Date(message.created_at).toLocaleTimeString()}</span>
                        </div>
                        {message.text}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && postText()}
                placeholder="Écris un message… (/set, /fail, /copyfail)"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
              <button
                onClick={postText}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-orange-400"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </section>

        {/* HUD */}
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[#10141d]/90 p-6 text-center shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40">
            <Sparkles className="h-4 w-4 text-orange-400" /> Arbitre du jeu
            {!rtOnline && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-200">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.4em] text-white/30">Temps restant</div>
            <div className="mt-2 text-5xl font-bold text-orange-400 drop-shadow-[0_0_20px_rgba(255,138,0,0.5)]">{timer.toFixed(1)}</div>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={onSetSucceeded}
              disabled={!myTurn || match?.status === "ended"}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" /> Trick accepté
            </button>
            <button
              onClick={handleTrickRefused}
              disabled={match?.status === "ended"}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/80 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" /> Trick refusé
            </button>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              <Settings className="h-4 w-4 text-orange-400" /> Règles du jeu
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">Choix de la règle</div>
                <select
                  value={selectedRule}
                  onChange={(event) => setSelectedRule(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e13] px-3 py-2 text-sm text-white outline-none transition hover:border-orange-400"
                >
                  {RULE_OPTIONS.map((rule) => (
                    <option key={rule} className="bg-[#0b0e13] text-white">
                      {rule}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">Trick à faire</div>
                <div className="mt-1 flex gap-2">
                  <input
                    value={trickToDo}
                    onChange={(event) => setTrickToDo(event.target.value)}
                    placeholder="Nom du trick"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0b0e13] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-orange-400"
                  />
                  <button className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/20">
                    Comment faire ?
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs text-white/60">
            <Info className="mt-0.5 h-4 w-4 text-orange-300" />
            <p>{gameStatusText()}</p>
          </div>

          {match?.status === "ended" && (
            <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
              <Crown className="h-4 w-4" />
              {match.winner === "A" ? profileAName : profileBName}
            </div>
          )}
        </section>

        {/* Rider B */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>{profileBName}</span>
            {badgeTurn("B")}
          </div>
          <div className="mt-6 flex justify-center">
            <Letters count={match?.letters_b ?? 0} />
          </div>
          <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/60">
            <div className="grid h-full place-items-center text-sm text-white/40">Vidéo Rider B</div>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-white/40">
            <span>Latence A</span>
            <div className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 w-2/3 rounded-full bg-emerald-400/90"></div>
            </div>
            <span>Latence B−</span>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/70">
            Deux riders s’affrontent : le premier impose une figure, l’autre doit la reproduire. Chaque échec ajoute une lettre du mot
            <span className="font-semibold text-orange-400"> S.H.R.E.D</span>. Celui qui évite les cinq lettres remporte la partie.
          </div>

          <button className="mt-auto rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-black transition hover:bg-orange-400">
            LAN CER LE STREAM
          </button>
        </section>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl items-center justify-center gap-3 rounded-3xl border border-white/10 bg-[#0f131b]/85 px-5 py-3 text-sm text-white/70">
        <Crown className="h-4 w-4 text-amber-300" />
        {profileAName} vs {profileBName} — Exhibition Match
      </div>
    </div>
  );
}
