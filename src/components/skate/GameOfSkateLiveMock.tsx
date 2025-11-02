import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Send,
  Settings,
  Crown,
  Sparkles,
  MessageSquare,
  Info,
} from "lucide-react";

const LETTERS = ["S", "H", "R", "E", "D"];

const Letters = ({ value }: { value: number }) => (
  <div className="flex gap-2">
    {LETTERS.map((letter, idx) => (
      <span
        key={letter}
        className={`w-9 h-9 grid place-items-center rounded-full border text-base font-semibold transition-colors shadow-[0_0_14px_rgba(0,0,0,0.35)]
        ${
          idx < value
            ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_18px_rgba(255,138,0,0.6)]"
            : "border-white/10 text-white/50"
        }`}
      >
        {letter}
      </span>
    ))}
  </div>
);

type LocalMessage = {
  id: number;
  from: "A" | "B" | null;
  kind: "text" | "system";
  text: string;
  createdAt: string;
};

export default function GameOfSkateLiveMock() {
  const [timer, setTimer] = useState(45);
  const [turn, setTurn] = useState<"A" | "B">("A");
  const [lettersA, setLettersA] = useState(2);
  const [lettersB, setLettersB] = useState(3);
  const [rule, setRule] = useState("Game of Skate");
  const [trick, setTrick] = useState("360 Flip");
  const [messages, setMessages] = useState<LocalMessage[]>(() => [
    { id: 1, from: "A", kind: "text", text: "Ready?", createdAt: new Date().toLocaleTimeString() },
    { id: 2, from: "B", kind: "text", text: "Let’s go!", createdAt: new Date().toLocaleTimeString() },
    { id: 3, from: null, kind: "system", text: "Match démarré. Rider A commence.", createdAt: new Date().toLocaleTimeString() },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 45 - elapsed);
      setTimer(Math.round(remaining * 10) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [turn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const postMessage = (text: string) => {
    if (!text.trim()) return;
    const msg: LocalMessage = {
      id: Date.now(),
      from: "A",
      kind: "text",
      text: text.trim(),
      createdAt: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  const addLetterTo = (side: "A" | "B") => {
    if (side === "A") {
      setLettersA((prev) => Math.min(prev + 1, LETTERS.length));
    } else {
      setLettersB((prev) => Math.min(prev + 1, LETTERS.length));
    }
  };

  const handleAccept = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        from: null,
        kind: "system",
        text: `${turn} valide son set. L’adversaire doit copier.`,
        createdAt: new Date().toLocaleTimeString(),
      },
    ]);
    setTurn((prev) => (prev === "A" ? "B" : "A"));
  };

  const handleRefuse = () => {
    const loser: "A" | "B" = turn === "A" ? "B" : "A";
    addLetterTo(loser);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        from: null,
        kind: "system",
        text: `${loser} échoue la copie → +1 lettre`,
        createdAt: new Date().toLocaleTimeString(),
      },
    ]);
    setTurn((prev) => (prev === "A" ? "B" : "A"));
  };

  const ruleOptions = useMemo(() => ["Game of Skate", "Best Trick", "Mort subite"], []);

  return (
    <div className="min-h-screen bg-[#05070b] px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)]">
        {/* Rider A */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>MTNR Concept</span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] transition-colors ${
                turn === "A" ? "bg-orange-500 text-black shadow-[0_0_14px_rgba(255,138,0,0.5)]" : "bg-white/5 text-white/50"
              }`}
            >
              {turn === "A" ? "À toi" : "En attente"}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <Letters value={lettersA} />
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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${
                    message.kind !== "text" ? "items-center" : message.from === "A" ? "items-start" : "items-end"
                  }`}
                >
                  {message.kind !== "text" ? (
                    <div className="max-w-[85%] rounded-md bg-white/5 px-3 py-2 text-xs text-white/60">
                      <span className="block text-[10px] text-white/30">{message.createdAt}</span>
                      {message.text}
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-[0_0_18px_rgba(0,0,0,0.35)] ${
                        message.from === "A" ? "bg-orange-500/20 text-orange-100" : "bg-white/10 text-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                        <span>{message.from === "A" ? "MTNR Concept" : "Nyjah Huston"}</span>
                        <span>•</span>
                        <span>{message.createdAt}</span>
                      </div>
                      {message.text}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && postMessage(input)}
                placeholder="Écris un message…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
              <button
                onClick={() => postMessage(input)}
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
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.4em] text-white/30">Temps restant</div>
            <div className="mt-2 text-5xl font-bold text-orange-400 drop-shadow-[0_0_20px_rgba(255,138,0,0.5)]">{timer.toFixed(1)}</div>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={handleAccept}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" /> Trick accepté
            </button>
            <button
              onClick={handleRefuse}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/80 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-red-500"
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
                  value={rule}
                  onChange={(event) => setRule(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e13] px-3 py-2 text-sm text-white outline-none transition hover:border-orange-400"
                >
                  {ruleOptions.map((item) => (
                    <option key={item} className="bg-[#0b0e13] text-white">
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">Trick à faire</div>
                <div className="mt-1 flex gap-2">
                  <input
                    value={trick}
                    onChange={(event) => setTrick(event.target.value)}
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
            <p>
              Tour de {turn === "A" ? "MTNR Concept" : "Nyjah Huston"}. Utilise les boutons pour valider ou refuser et observe la mise à jour instantanée.
            </p>
          </div>
        </section>

        {/* Rider B */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>Nyjah Huston</span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] transition-colors ${
                turn === "B" ? "bg-orange-500 text-black shadow-[0_0_14px_rgba(255,138,0,0.5)]" : "bg-white/5 text-white/50"
              }`}
            >
              {turn === "B" ? "À toi" : "En attente"}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <Letters value={lettersB} />
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
        <Crown className="h-4 w-4 text-amber-300" /> MTNR Concept vs Nyjah Huston — Exhibition Match
      </div>
    </div>
  );
}
