import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Crown,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Wand2,
  WifiOff,
  XCircle,
  Play,
  Lightbulb,
  UserPlus,
  Mail,
  ArrowUpRightSquare,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import CountdownAnimation from "./CountdownAnimation";

type Side = "A" | "B";
type Match = {
  id: string;
  rider_a: string;
  rider_b: string;
  turn: Side;
  letters_a: number;
  letters_b: number;
  status: "pending" | "active" | "ended" | "cancelled";
  winner: Side | null;
  created_at: string;
  accepted_at?: string | null;
  // Champs optionnels — non sélectionnés côté SQL pour éviter les 42703
  starts_at?: string | null;
  countdown_s?: number | null;
};

type ChatPayload = Record<string, unknown> | null;
type ChatMessage = {
  id: number;
  match_id: string;
  sender: string | null;
  kind: "text" | "system" | "event";
  text: string | null;
  payload: ChatPayload;
  created_at: string;
};

const LETTERS_WORD = "SKATE";

/* ---------- UI Atomes ---------- */
const Letters = ({ count }: { count: number }) => (
  <div className="flex items-center gap-2">
    {LETTERS_WORD.split("").map((ch, index) => (
      <span
        key={`${ch}-${index}`}
        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold transition-colors ${
          index < count
            ? "bg-[#FF6A00] text-black shadow-lg shadow-[#FF6A00]/40"
            : "border border-white/20 text-white/60"
        }`}
      >
        {ch}
      </span>
    ))}
  </div>
);

function ScoreHeader({
  label,
  name,
  letters,
  isActive,
  fallbackName,
  className = "",
}: {
  label: string;
  name?: string | null;
  letters: number;
  isActive: boolean;
  fallbackName: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-[#1A1A1D]/95 px-5 py-4 shadow-lg shadow-black/40 ${className}`}
    >
      <div className="flex items-center justify-between text-white/90">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.38em] text-white/40">
            {label}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xl font-semibold">
              {name ?? fallbackName}
            </span>
            <Letters count={letters} />
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isActive ? "bg-emerald-500/90 text-black" : "bg-white/10 text-white/60"
          }`}
        >
          {isActive ? "Actif" : "Passif"}
        </span>
      </div>
    </div>
  );
}

function VideoPane({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-inner shadow-black/60 ${className}`}
    >
      <div className="flex-1 rounded-xl border border-dashed border-white/10 bg-black/85" />
      <div className="mt-3 text-center text-sm text-white/60">{label}</div>
    </div>
  );
}

function LatencyBar({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/5 bg-[#101014] px-4 py-3 text-center text-xs text-white/70 ${className}`}
    >
      <span className="text-sm font-semibold uppercase tracking-wide text-[#FF6A00]">
        {label}
      </span>
      <div className="mt-3 flex items-center justify-center gap-2 text-white/60">
        <span className="text-xs text-white/50">Ping</span>
        <div className="h-2 w-32 rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-[#FF6A00]/70" />
        </div>
        <span className="text-xs text-white/50">65 ms</span>
      </div>
    </div>
  );
}

const SectionCard = ({
  children,
  title,
  icon,
  accentClassName,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  accentClassName?: string;
  className?: string;
}) => (
  <div className={`rounded-2xl border border-white/8 bg-[#16161A]/95 p-6 shadow-lg shadow-black/30 backdrop-blur ${className}`}>
    {title && (
      <div className="mb-4 flex items-center gap-2 text-base font-semibold text-white/80">
        {icon}
        <span className={accentClassName}>{title}</span>
      </div>
    )}
    {children}
  </div>
);

/* ---------- Utilitaires ---------- */
const formatClock = (ms: number) => {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 100) / 10;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 10);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${tenths}`;
};

interface GameOfSkateSelfRefProps {
  matchId: string;
  me: string;
  initialSide?: Side;
  riderAName?: string | null;
  riderBName?: string | null;
}

export default function GameOfSkateSelfRef({
  matchId,
  me,
  initialSide,
  riderAName,
  riderBName,
}: GameOfSkateSelfRefProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [iAm, setIAm] = useState<Side>("A");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [rtOnline, setRtOnline] = useState(true);
  const [ruleChoice, setRuleChoice] = useState("Game of SKATE");
  const [trickName, setTrickName] = useState("Kickflip");
  const [remainingClock, setRemainingClock] = useState("30:00.0");

  // Compte à rebours synchronisé (optionnel)
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(10);
  const [countdownKey, setCountdownKey] = useState(0);

  const chanRef = useRef<RealtimeChannel | null>(null);

  /* ---------- Chargements initiaux ---------- */
  const fetchMatch = useCallback(async () => {
    const { data, error } = await supabase
      .from("gos_match")
      .select("id,rider_a,rider_b,turn,letters_a,letters_b,status,winner,created_at,accepted_at")
      .eq("id", matchId)
      .limit(1)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") {
      console.warn("[gos] match fetch error", error);
    }

    const row = (data as Match) ?? null;
    setMatch(row);
    if (row) setIAm(me === row.rider_a ? "A" : "B");
  }, [matchId, me]);

  const fetchChat = useCallback(async () => {
    const { data, error } = await supabase
      .from("gos_chat_message")
      .select("*")
      .eq("match_id", matchId)
      .order("id", { ascending: true });

    if (error) console.warn("[gos] chat fetch error", error);
    setMsgs((data as ChatMessage[]) ?? []);
  }, [matchId]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchMatch(), fetchChat()]);

      const channel = supabase
        .channel(`gos:${matchId}`, {
          config: { broadcast: { self: false }, presence: { key: me } },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "gos_chat_message",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => setMsgs((prev) => [...prev, payload.new as ChatMessage]),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
          (payload) => setMatch(payload.new as Match),
        )
        .subscribe((status) => setRtOnline(status === "SUBSCRIBED"));

      chanRef.current = channel;
    })();

    return () => {
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, [fetchChat, fetchMatch, matchId, me]);

  const timerStartMs = useMemo(() => {
    if (match?.accepted_at) {
      const t = Date.parse(match.accepted_at);
      if (!Number.isNaN(t)) return t;
    }
    if (match?.created_at) {
      const t = Date.parse(match.created_at);
      if (!Number.isNaN(t)) return t;
    }
    return null;
  }, [match?.accepted_at, match?.created_at]);

  useEffect(() => {
    if (!timerStartMs) {
      setRemainingClock("30:00.0");
      return;
    }
    const update = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - timerStartMs);
      const msRemaining = Math.max(0, 30 * 60 * 1000 - elapsed);
      setRemainingClock(formatClock(msRemaining));
    };
    update();
    const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [timerStartMs]);

  useEffect(() => {
    const isActive = match?.status === "active";
    const startsAt = (match as any)?.starts_at as string | undefined; // runtime-only
    if (!isActive || !startsAt) {
      setCountdownActive(false);
      return;
    }
    const startsAtMs = Date.parse(startsAt);
    if (Number.isNaN(startsAtMs)) {
      setCountdownActive(false);
      return;
    }
    const now = Date.now();
    if (now < startsAtMs) {
      const secondsRemaining = Math.max(
        1,
        Math.min(60, Math.ceil((startsAtMs - now) / 1000)),
      );
      if (countdownKey !== startsAtMs) {
        setCountdownSeconds(secondsRemaining);
        setCountdownKey(startsAtMs);
        setCountdownActive(true);
      }
    } else {
      setCountdownActive(false);
    }
  }, [match?.status, (match as any)?.starts_at, countdownKey]);

  const handleCountdownComplete = useCallback(() => {
    setCountdownActive(false);
  }, []);

  const isActiveMatch = match?.status === "active";
  const isPendingMatch = match?.status === "pending";
  const isCancelled = match?.status === "cancelled";
  const isEnded = match?.status === "ended";

  const myTurn = isActiveMatch && match?.turn === iAm;
  const copyTurn = isActiveMatch && match?.turn !== iAm;
  const riderAIsActive = isActiveMatch && match?.turn === "A";
  const riderBIsActive = isActiveMatch && match?.turn === "B";

  const displayNameA = useMemo(() => {
    if (!match) return "Rider A";
    return riderAName ?? match.rider_a ?? "Rider A";
  }, [match, riderAName]);

  const displayNameB = useMemo(() => {
    if (!match) return "Rider B";
    return riderBName ?? match.rider_b ?? "Rider B";
  }, [match, riderBName]);

  const fallbackNameA = useMemo(
    () => riderAName ?? match?.rider_a ?? "Rider A",
    [riderAName, match?.rider_a],
  );

  const fallbackNameB = useMemo(
    () => riderBName ?? match?.rider_b ?? "Rider B",
    [riderBName, match?.rider_b],
  );

  const rpcPost = async (kind: "text" | "system" | "event", text: string, payload?: ChatPayload) => {
    const tryRpc = await supabase.rpc("post_chat_message", {
      p_match_id: matchId,
      p_kind: kind,
      p_text: text,
      p_payload: payload ?? null,
    });

    // La logique de fallback est supprimée. Si l'appel RPC échoue,
    // nous affichons l'erreur pour faciliter le débogage.
    if (tryRpc.error) {
      console.error("[gos] chat rpc error", tryRpc.error);
      // Optionnel: afficher une notification à l'utilisateur
    }
  };

  const addLetter = async (side: Side) => {
    if (!match) return;
    const column = side === "A" ? "letters_a" : "letters_b";
    const currentCount = match[column];
    const newCount = currentCount + 1;
    const ended = newCount >= LETTERS_WORD.length;

    const updates: Partial<Match> =
      column === "letters_a" ? { letters_a: newCount } : { letters_b: newCount };
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
    if (!match || !isActiveMatch || isEnded || !myTurn) return;
    await rpcPost("event", `${iAm} valide son set. L’adversaire doit copier.`, {
      actor: iAm,
      type: "set_ok",
    });
  };

  const onCopyFailed = async () => {
    if (!match || !isActiveMatch || isEnded || !copyTurn) return;
    const loser: Side = match.turn === "A" ? "B" : "A";
    const result = await addLetter(loser);

    await rpcPost("event", `Rider ${loser} échoue la copie → +1 lettre`, {
      loser,
      type: "copy_fail",
    });

    if (result?.ended) {
      const winner = loser === "A" ? "B" : "A";
      await rpcPost("system", `Partie terminée. Vainqueur : Rider ${winner}`, { winner });
    } else {
      await rpcPost("system", `Tour conservé par Rider ${match.turn}.`, {
        turn: match.turn,
      });
    }
  };

  const onSetFailed = async () => {
    if (!match || !isActiveMatch || isEnded || !myTurn) return;

    const sw = await supabase.rpc("switch_turn", { p_match_id: matchId });
    if (!sw.error && sw.data) {
      setMatch(sw.data as Match);
    } else {
      const nextTurn: Side = match.turn === "A" ? "B" : "A";
      const up = await supabase
        .from("gos_match")
        .update({ turn: nextTurn })
        .eq("id", matchId)
        .select("*")
        .single();
      if (!up.error && up.data) setMatch(up.data as Match);
      if (up.error) console.warn("[gos] switch_turn fallback error", up.error);
    }

    await rpcPost("event", `${iAm} rate son set → main à ${iAm === "A" ? "B" : "A"}`, {
      actor: iAm,
      type: "set_fail",
    });
  };

  /* =========================================================
   *  Rendu MOBILE — EXACT comme le mock / aucun scroll
   * ========================================================= */
  const MobileUI = () => {
    // lettre active « H » visuellement
    const activeLetterIndex = 1;

    return (
      <div className="md:hidden text-zinc-200 bg-black h-[100dvh] w-full overflow-hidden">
        <div className="mx-auto h-full max-w-[520px] px-4">
        {/* Grid en 5 rangées pour figer la hauteur, collé au header (h-16) */}
        <div className="grid h-full grid-rows-[64px,1fr,76px,136px,64px] pt-16 gap-0">
            {/* Pastilles SHRED */}
            <div className="flex items-center justify-center gap-4">
              {["S", "H", "R", "E", "D"].map((l, i) => (
                <div
                  key={l}
                  className={[
                    "w-12 h-12 rounded-full border",
                    "flex items-center justify-center",
                    "text-lg font-semibold",
                    i === activeLetterIndex
                      ? "border-amber-500 text-amber-400 ring-2 ring-amber-500/50"
                      : "border-zinc-600 text-zinc-300",
                    "bg-black/40 backdrop-blur-sm",
                  ].join(" ")}
                >
                  {l}
                </div>
              ))}
            </div>

            {/* Vidéo (remplacer par ton player) */}
            <div className="relative rounded-2xl border border-zinc-700 bg-zinc-950 overflow-hidden">
              <div className="absolute inset-0">
                {/* Place ton flux ici si besoin */}
                <div className="w-full h-full bg-black grid place-items-center">
                  <span className="text-zinc-500 text-sm opacity-60">
                    Flux vidéo / écran du rider
                  </span>
                </div>
              </div>
              {/* padding bas pour laisser la place aux boutons dans le cadre comme sur l’image */}
              <div className="pointer-events-none h-full w-full opacity-0">.</div>
            </div>

            {/* Boutons vert/rouge */}
            <div className="flex items-center gap-4">
              <button
                onClick={onSetSucceeded}
                disabled={!isActiveMatch || isEnded || !myTurn}
                className="flex-1 h-12 rounded-xl font-semibold inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-800/30 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                {/* libellé sans accent comme le mock */}
                Trick reussi
              </button>
              <button
                onClick={myTurn ? onSetFailed : onCopyFailed}
                disabled={!isActiveMatch || isEnded || (!myTurn && !copyTurn)}
                className="flex-1 h-12 rounded-xl font-semibold inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-900/40 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Trick loupé
              </button>
            </div>

            {/* Carte “Trick à faire” */}
            <div className="rounded-2xl p-4 bg-zinc-900/70 border border-zinc-700/60 backdrop-blur shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-xl text-amber-400 tracking-wide">
                  Trick à faire
                </h2>
                <Sparkles className="w-5 h-5 text-zinc-400" />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="shrink-0 w-12 h-12 rounded-xl border border-zinc-700/70 bg-zinc-900/80 grid place-items-center"
                  aria-label="Retour vidéo"
                >
                  <Play className="w-6 h-6 text-zinc-200" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-400 leading-none">Kickflip</p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 h-11 rounded-xl bg-zinc-950/70 border border-zinc-700/60 px-3 outline-none focus:ring-2 focus:ring-amber-500/40"
                  placeholder="comment faire"
                />
                <button
                  type="button"
                  className="h-11 w-11 rounded-xl border border-zinc-700/70 bg-zinc-900/80 grid place-items-center hover:border-amber-500/50"
                  aria-label="Envoyer"
                >
                  <Send className="w-5 h-5 text-zinc-200" />
                </button>
              </div>

              <p className="mt-2 text-xs text-zinc-500">retour vidéo</p>
            </div>

            {/* Barre d’icônes basse (fixe) */}
            <div className="border-t border-zinc-800/80 bg-zinc-900/80 backdrop-blur">
              <div className="mx-auto h-16 max-w-[520px] px-6">
                <ul className="h-full grid grid-cols-4 items-center text-zinc-300">
                  <li className="grid place-items-center">
                    <button className="flex flex-col items-center gap-1 text-xs" aria-label="Aide">
                      <Lightbulb className="w-6 h-6" />
                    </button>
                  </li>
                  <li className="grid place-items-center">
                    <button className="flex flex-col items-center gap-1 text-xs" aria-label="Inviter">
                      <UserPlus className="w-6 h-6" />
                    </button>
                  </li>
                  <li className="grid place-items-center">
                    <button className="flex flex-col items-center gap-1 text-xs" aria-label="Messages">
                      <Mail className="w-6 h-6" />
                    </button>
                  </li>
                  <li className="grid place-items-center">
                    <button className="flex flex-col items-center gap-1 text-xs" aria-label="Plein écran">
                      <ArrowUpRightSquare className="w-6 h-6" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Variantes de contenus pour le panneau central desktop ---------- */
  const offlineBadge = !rtOnline ? (
    <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
      <WifiOff className="h-3 w-3" />
      Realtime déconnecté
    </span>
  ) : null;

  let centralCardContent: React.ReactNode;
  if (isPendingMatch) {
    centralCardContent = (
      <div className="flex flex-col items-center gap-4 text-center text-white/70">
        <div className="text-sm font-semibold uppercase tracking-[0.5em] text-white/40">Arbitre du jeu</div>
        <div className="text-lg font-semibold text-white">En attente de l’adversaire</div>
        <p className="text-xs text-white/50">Ton adversaire doit accepter le défi pour démarrer la partie.</p>
        <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-[#FF6A00]/20 via-[#FF6A00] to-[#FF6A00]/20" />
        </div>
      </div>
    );
  } else if (isCancelled) {
    centralCardContent = (
      <div className="flex flex-col items-center gap-3 text-center text-white/70">
        <div className="text-sm font-semibold uppercase tracking-[0.5em] text-white/40">Match annulé</div>
        <p className="text-xs text-white/50">L’adversaire a décliné l’invitation. Retourne au lobby pour relancer un défi.</p>
      </div>
    );
  } else if (isEnded) {
    centralCardContent = (
      <div className="flex flex-col items-center gap-4 text-center text-white/80">
        <div className="text-sm font-semibold uppercase tracking-[0.5em] text-white/40">Match terminé</div>
        <div className="flex items-center gap-2 text-amber-300">
          <Crown className="h-5 w-5" />
          Vainqueur : Rider {match?.winner ?? "?"}
        </div>
        <p className="text-xs text-white/50">Relance un duel depuis le lobby pour continuer.</p>
      </div>
    );
  } else {
    centralCardContent = (
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.5em] text-white/38">Arbitre du jeu</div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
          <Sparkles className="h-4 w-4 text-[#FF6A00]" />
          Auto-arbitrage actif
          {offlineBadge}
        </div>
        <div className="mt-4 text-xs uppercase tracking-[0.4em] text-white/40">Temps restant</div>
        <div className="mt-2 text-5xl font-bold text-[#FF6A00]">{remainingClock}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            onClick={onSetSucceeded}
            disabled={!isActiveMatch || isEnded || !myTurn}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E8030] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#1E8030]/40 transition disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Trick accepté
          </button>
          <button
            onClick={myTurn ? onSetFailed : onCopyFailed}
            disabled={!isActiveMatch || isEnded || (!myTurn && !copyTurn)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D32F2F] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#D32F2F]/40 transition hover:bg-[#e53e3e] disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Trick refusé
          </button>
        </div>
        <p className="mt-4 text-xs text-white/55">
          {myTurn
            ? "À toi de lancer un trick."
            : copyTurn
            ? "Réplique le trick imposé."
            : "En attente du tour suivant."}
        </p>
      </div>
    );
  }

  /* =========================================================
   *  Rendu
   * ========================================================= */
  if (!match) {
    return (
      <div className="grid place-items-center rounded-2xl border border-white/10 bg-[#121214] p-10 text-white/60">
        Chargement du match…
      </div>
    );
  }

  return (
    <>
      {countdownActive && (
        <CountdownAnimation
          key={countdownKey}
          startSeconds={countdownSeconds}
          onComplete={handleCountdownComplete}
        />
      )}

      {/* MOBILE (mock exact, aucun scroll) */}
      <MobileUI />

      {/* DESKTOP (ancienne UI conservée) */}
      <div className="hidden md:block">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,0.8fr)_1fr]">
            <ScoreHeader
              label="Rider A"
              name={riderAName}
              fallbackName={fallbackNameA}
              letters={match.letters_a ?? 0}
              isActive={match?.turn === "A"}
            />
            <SectionCard className="flex min-h-[220px] flex-col items-center justify-center text-center">
              {centralCardContent}
            </SectionCard>
            <ScoreHeader
              label="Rider B"
              name={riderBName}
              fallbackName={fallbackNameB}
              letters={match.letters_b ?? 0}
              isActive={match?.turn === "B"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <VideoPane label="Flux vidéo rider A" className="h-[440px]" />
              <LatencyBar label="Latences A" />
            </div>
            <div className="flex flex-col gap-4">
              <VideoPane label="Flux vidéo rider B" className="h-[440px]" />
              <LatencyBar label="Latences B" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <SectionCard
              title="Chat & statut"
              icon={<MessageSquare className="h-5 w-5 text-[#FF6A00]" />}
              accentClassName="text-[#FFB174]"
              className="flex flex-col"
            >
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#111114]/90">
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pr-2">
                  {msgs.length === 0 && (
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/40">
                      Pas encore de messages. Lance la conversation !
                    </div>
                  )}
                  {msgs.map((m) => {
                    const side = m.sender === match.rider_a ? "A" : m.sender === match.rider_b ? "B" : "?";
                    const isMe = m.sender === me;
                    const bubbleClass =
                      m.kind === "text"
                        ? isMe
                          ? "bg-[#FF6A00]/90 text-black shadow-[#FF6A00]/40"
                          : "bg-white/10 text-white/80 shadow-black/30"
                        : "bg-[#28282d] text-white/70 italic";
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${bubbleClass}`}>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
                            <span>{isMe ? "Toi" : `Rider ${side}`}</span>
                            <span className="text-white/30">{new Date(m.created_at).toLocaleTimeString()}</span>
                          </div>
                          {m.text && <div className="mt-1 leading-snug">{m.text}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 border-t border-white/5 bg-[#09090c]/80 px-4 py-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (async () => {
                      const trimmed = input.trim();
                      if (!trimmed) return;
                      setInput("");
                      await rpcPost("text", trimmed);
                    })()}
                    placeholder="Écris un message…"
                    className="h-10 flex-1 rounded-lg border border-white/10 bg-black/60 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  />
                  <button
                    onClick={async () => {
                      const trimmed = input.trim();
                      if (!trimmed) return;
                      setInput("");
                      await rpcPost("text", trimmed);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF6A00] px-4 text-sm font-semibold text-black transition hover:bg-[#ff7d1f]"
                  >
                    <Send className="h-4 w-4" />
                    Envoyer
                  </button>
                </div>
              </div>
            </SectionCard>

            <div className="flex flex-col gap-6">
              <SectionCard
                title="Choix de la règle"
                icon={<Settings className="h-5 w-5 text-[#FF6A00]" />}
                accentClassName="text-[#FFB174]"
              >
                <div className="text-sm text-white/60">
                  <label className="block text-xs uppercase tracking-[0.3em] text-white/40">
                    Règle active
                  </label>
                  <select
                    value={ruleChoice}
                    onChange={(e) => setRuleChoice(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  >
                    <option>Game of SKATE</option>
                    <option>Best Trick</option>
                    <option>Mort subite</option>
                  </select>
                </div>
              </SectionCard>

              <SectionCard
                title="Trick à faire"
                icon={<Wand2 className="h-5 w-5 text-[#FF6A00]" />}
                accentClassName="text-[#FFB174]"
              >
                <div className="space-y-4 text-sm text-white/70">
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-white/40">
                      Nom du trick
                    </label>
                    <input
                      value={trickName}
                      onChange={(e) => setTrickName(e.target.value)}
                      placeholder="Kickflip"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60 transition hover:bg-white/10"
                  >
                    Comment faire
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Règles du jeu"
                icon={<BookOpen className="h-5 w-5 text-[#FF6A00]" />}
                accentClassName="text-[#FFB174]"
              >
                <p className="text-sm leading-relaxed text-white/70">
                  Deux riders s’affrontent : le premier impose une figure, l’autre doit la reproduire. Chaque échec donne une lettre du mot{" "}
                  <span className="font-semibold text-white">S.K.A.T.E.</span>. À cinq lettres, la partie est perdue. Le dernier rider sans faute gagne — style, propreté et fair-play obligatoires.
                </p>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
