import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
  MessageSquare,
  Crown,
  WifiOff,
  AlertTriangle,
  Timer,
  RotateCcw,
  Flag,
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

const LETTERS = ["S", "K", "A", "T", "E"] as const;
const ATTEMPT_DURATION = 45; // seconds
const MAX_CONTESTS = 3;

type Side = "A" | "B";
type Phase =
  | "set_idle"
  | "set_attempting"
  | "copy_idle"
  | "copy_attempting"
  | "confirm"
  | "dispute";

type PhasePayload = {
  trick?: string | null;
  round?: number | null;
  imposerResult?: "landed" | "missed" | null;
  responderDeclaration?: "landed" | "missed" | null;
  lastTryActiveFor?: Side | null;
  disputeVotes?: Record<Side, "validate" | "refuse" | null>;
  contestingSide?: Side | null;
};

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
  round_number: number;
  phase: Phase;
  phase_payload: PhasePayload | null;
  current_trick: string | null;
  timer_expires_at: string | null;
  timer_for: Side | null;
  last_try_a_used: boolean;
  last_try_b_used: boolean;
  contest_a_count: number;
  contest_b_count: number;
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

const Letters = ({ count }: { count: number }) => (
  <div className="flex gap-2">
    {LETTERS.map((letter, idx) => (
      <span
        key={letter}
        className={`w-9 h-9 grid place-items-center rounded-full border text-base font-semibold transition-colors shadow-[0_0_14px_rgba(0,0,0,0.35)] ${
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

const OTHER_SIDE: Record<Side, Side> = { A: "B", B: "A" };

const formatName = (row: any, fallback: string) =>
  row?.display_name || row?.full_name || row?.username || fallback;

export default function GameOfSkateSelfRef({ matchId, me }: { matchId: string; me: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [iAm, setIAm] = useState<Side>("A");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [rtOnline, setRtOnline] = useState(true);
  const [profileAName, setProfileAName] = useState("Rider A");
  const [profileBName, setProfileBName] = useState("Rider B");
  const [trickDraft, setTrickDraft] = useState("");
  const [timer, setTimer] = useState<number | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const disputeResolvingRef = useRef(false);

  const payload: PhasePayload = useMemo(
    () => ({ ...(match?.phase_payload ?? {}) }),
    [match?.phase_payload]
  );

  const imposer = match?.turn ?? "A";
  const responder = OTHER_SIDE[imposer];
  const iAmImposer = iAm === imposer;
  const iAmResponder = iAm === responder;
  const lettersA = match?.letters_a ?? 0;
  const lettersB = match?.letters_b ?? 0;
  const roundNumber = match?.round_number ?? 1;
  const currentTrick = match?.current_trick ?? payload.trick ?? "";
  const matchEnded = match?.status === "ended";

  const fetchMatch = useCallback(async () => {
    const { data, error } = await supabase
      .from("gos_match")
      .select("*")
      .eq("id", matchId)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") console.warn("[gos] match fetch error", error);
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
  }, [matchId, me, fetchMatch, fetchChat]);

  useEffect(() => {
    if (!match) return;
    let canceled = false;
    (async () => {
      const [{ data: profileA }, { data: profileB }] = await Promise.all([
        supabase.from("profiles").select("display_name, username, full_name").eq("id", match.rider_a).maybeSingle(),
        supabase.from("profiles").select("display_name, username, full_name").eq("id", match.rider_b).maybeSingle(),
      ]);
      if (canceled) return;
      setProfileAName(formatName(profileA, "Rider A"));
      setProfileBName(formatName(profileB, "Rider B"));
    })();
    return () => {
      canceled = true;
    };
  }, [match?.rider_a, match?.rider_b]);

  useEffect(() => {
    if (!match?.timer_expires_at) {
      setTimer(null);
      return;
    }
    const deadline = new Date(match.timer_expires_at).getTime();
    const tick = () => {
      const diff = deadline - Date.now();
      const seconds = Math.max(0, Math.round((diff / 1000) * 10) / 10);
      setTimer(seconds);
      if (diff <= 0) return;
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [match?.timer_expires_at]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const rpcPost = useCallback(
    async (kind: "text" | "system" | "event", text: string, payload?: any) => {
      const { error } = await supabase.rpc("post_chat_message", {
        p_match_id: matchId,
        p_kind: kind,
        p_text: text,
        p_payload: payload ?? null,
      });
      if (error) console.warn("[gos] rpc chat error", error);
    },
    [matchId]
  );

  const postText = async () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    await rpcPost("text", t);
  };

  const updateMatchRow = useCallback(
    async (patch: Partial<Match>) => {
      if (!match) return;
      const { data, error } = await supabase
        .from("gos_match")
        .update(patch as any)
        .eq("id", matchId)
        .select("*")
        .single();
      if (error) {
        console.warn("[gos] match update error", error);
        return;
      }
      setMatch(data as Match);
    },
    [match, matchId]
  );

  const advanceTurn = useCallback(
    async ({ letterTo, reason }: { letterTo?: Side | null; reason: string }) => {
      if (!match) return;
      const nextTurn = OTHER_SIDE[match.turn];
      const updates: Partial<Match> = {
        turn: nextTurn,
        phase: "set_idle",
        phase_payload: { round: (match.round_number ?? 1) + 1 },
        round_number: (match.round_number ?? 1) + 1,
        current_trick: null,
        timer_for: null,
        timer_expires_at: null,
      };

      if (letterTo) {
        const column = letterTo === "A" ? "letters_a" : "letters_b";
        const current = (match[column as keyof Match] as number) ?? 0;
        const nextLetters = current + 1;
        (updates as any)[column] = nextLetters;
        const ended = nextLetters >= LETTERS.length;
        if (ended) {
          updates.status = "ended";
          updates.winner = letterTo === "A" ? "B" : "A";
          updates.phase = "set_idle";
        }
      }

      await updateMatchRow(updates);
      await rpcPost("event", reason, {
        letterTo: letterTo ?? null,
        nextTurn,
      });
    },
    [match, rpcPost, updateMatchRow]
  );

  const startSetAttempt = async () => {
    if (!match || matchEnded || !iAmImposer) return;
    const trick = (trickDraft || currentTrick || "Trick mystère").trim();
    setTrickDraft("");
    const updates: Partial<Match> = {
      phase: "set_attempting",
      phase_payload: {
        trick,
        round: roundNumber,
        imposerResult: null,
        responderDeclaration: null,
        lastTryActiveFor: null,
      },
      current_trick: trick,
      timer_for: imposer,
      timer_expires_at: new Date(Date.now() + ATTEMPT_DURATION * 1000).toISOString(),
    };
    await updateMatchRow(updates);
    await rpcPost("event", `${iAm === "A" ? profileAName : profileBName} lance ${trick}`, {
      trick,
      side: imposer,
      phase: "set_attempting",
    });
  };

  const declareSetResult = async (landed: boolean) => {
    if (!match || !iAmImposer || match.phase !== "set_attempting") return;
    if (!landed) {
      await advanceTurn({ letterTo: null, reason: `${profileName(imposer)} rate son set. Tour à ${profileName(responder)}` });
      return;
    }
    const updates: Partial<Match> = {
      phase: "copy_idle",
      phase_payload: {
        ...payload,
        trick: currentTrick,
        imposerResult: "landed",
        responderDeclaration: null,
        lastTryActiveFor: null,
      },
      timer_for: null,
      timer_expires_at: null,
    };
    await updateMatchRow(updates);
    await rpcPost("event", `${profileName(imposer)} valide son trick. ${profileName(responder)} doit copier.`, {
      trick: currentTrick,
      side: imposer,
      phase: "copy_idle",
    });
  };

  const declareCopyStart = async () => {
    if (!match || !iAmResponder || match.phase !== "copy_idle") return;
    const updates: Partial<Match> = {
      phase: "copy_attempting",
      phase_payload: {
        ...payload,
        trick: currentTrick,
        responderDeclaration: null,
      },
      timer_for: responder,
      timer_expires_at: new Date(Date.now() + ATTEMPT_DURATION * 1000).toISOString(),
    };
    await updateMatchRow(updates);
    await rpcPost("event", `${profileName(responder)} tente ${currentTrick}`, {
      trick: currentTrick,
      side: responder,
      phase: "copy_attempting",
    });
  };

  const canUseLastTry =
    match &&
    iAmResponder &&
    match.phase === "copy_attempting" &&
    getLetters(responder) >= LETTERS.length - 1 &&
    !isLastTryUsed(responder, match) &&
    payload.lastTryActiveFor !== responder;

  const triggerLastTry = async () => {
    if (!match || !canUseLastTry) return;
    const updates: Partial<Match> = {
      phase_payload: {
        ...payload,
        lastTryActiveFor: responder,
      },
      timer_for: responder,
      timer_expires_at: new Date(Date.now() + ATTEMPT_DURATION * 1000).toISOString(),
    };
    (updates as any)[responder === "A" ? "last_try_a_used" : "last_try_b_used"] = true;
    await updateMatchRow(updates);
    await rpcPost(
      "event",
      `${profileName(responder)} déclenche son dernier essai sur ${currentTrick}.`,
      { side: responder, trick: currentTrick }
    );
  };

  const declareCopyResult = async (landed: boolean) => {
    if (!match || !iAmResponder || match.phase !== "copy_attempting") return;
    if (!landed) {
      await advanceTurn({
        letterTo: responder,
        reason: `${profileName(responder)} échoue la copie → lettre automatique`,
      });
      return;
    }
    const updates: Partial<Match> = {
      phase: "confirm",
      phase_payload: {
        ...payload,
        responderDeclaration: "landed",
      },
      timer_for: null,
      timer_expires_at: null,
    };
    await updateMatchRow(updates);
    await rpcPost("event", `${profileName(responder)} revendique la réussite. Confirmation requise.`, {
      side: responder,
      trick: currentTrick,
      phase: "confirm",
    });
  };

  const forfeitCopy = async () => {
    if (!match || !iAmResponder || match.phase !== "copy_attempting") return;
    await advanceTurn({
      letterTo: responder,
      reason: `${profileName(responder)} se déclare forfait → lettre automatique`,
    });
  };

  const handleConfirmation = async (confirm: boolean) => {
    if (!match || !iAmImposer || match.phase !== "confirm") return;
    if (confirm) {
      await advanceTurn({ letterTo: null, reason: `${profileName(imposer)} confirme la réussite. Tour suivant.` });
      return;
    }
    if (getContestCount(imposer, match) >= MAX_CONTESTS) {
      await rpcPost(
        "system",
        `${profileName(imposer)} ne peut plus contester (limite atteinte). Verdict accepté automatiquement.`,
        { limit: MAX_CONTESTS }
      );
      await advanceTurn({ letterTo: null, reason: "Limite de contestations atteinte. Tour suivant." });
      return;
    }
    const column = imposer === "A" ? "contest_a_count" : "contest_b_count";
    const updates: Partial<Match> = {
      phase: "dispute",
      phase_payload: {
        ...payload,
        disputeVotes: { A: null, B: null },
        contestingSide: imposer,
        disputeResolved: false,
      },
      [column]: getContestCount(imposer, match) + 1,
    } as Partial<Match>;
    await updateMatchRow(updates);
    await rpcPost(
      "event",
      `${profileName(imposer)} conteste la réussite. Vote éclair enclenché.`,
      { side: imposer, trick: currentTrick }
    );
  };

  const submitDisputeVote = async (vote: "validate" | "refuse") => {
    if (!match || match.phase !== "dispute") return;
    const votes = payload.disputeVotes ?? { A: null, B: null };
    if (votes[iAm] === vote) return;
    const updates: Partial<Match> = {
      phase_payload: {
        ...payload,
        disputeVotes: { ...votes, [iAm]: vote },
      },
    };
    await updateMatchRow(updates);
  };

  useEffect(() => {
    if (!match || match.phase !== "dispute") {
      disputeResolvingRef.current = false;
      return;
    }
    const votes = payload.disputeVotes;
    if (!votes || votes.A == null || votes.B == null) return;
    if (disputeResolvingRef.current) return;
    disputeResolvingRef.current = true;
    const agreement = votes.A === votes.B ? votes.A : null;
    void (async () => {
      if (agreement === "validate") {
        await advanceTurn({ letterTo: null, reason: "Litige tranché: trick validé par les deux riders." });
      } else if (agreement === "refuse") {
        await advanceTurn({ letterTo: responder, reason: "Litige tranché: trick refusé → lettre au répondeur." });
      } else {
        await advanceTurn({ letterTo: null, reason: "Litige non résolu: match nul sur le tour." });
      }
      disputeResolvingRef.current = false;
    })();
  }, [match, payload.disputeVotes?.A, payload.disputeVotes?.B, advanceTurn, responder]);

  const handleTimeout = async () => {
    if (!match || matchEnded || !match.timer_for || timer === null || timer > 0) return;
    if (match.timer_for === iAm) return;
    const lateSide = match.timer_for;
    const actor = profileName(OTHER_SIDE[lateSide]);
    const penalized = profileName(lateSide);
    const reason = `Temps écoulé. ${actor} confirme que ${penalized} est en retard.`;
    await advanceTurn({ letterTo: lateSide, reason });
  };

  const profileName = (side: Side) => (side === "A" ? profileAName : profileBName);
  const getLetters = (side: Side) => (side === "A" ? lettersA : lettersB);
  const isLastTryUsed = (side: Side, m: Match) => (side === "A" ? m.last_try_a_used : m.last_try_b_used);
  const getContestCount = (side: Side, m: Match) => (side === "A" ? m.contest_a_count : m.contest_b_count);

  const phaseDescription = useMemo(() => {
    if (!match) return "Chargement du match…";
    if (matchEnded) {
      const winner = match.winner === "A" ? profileAName : profileBName;
      return `Partie terminée. ${winner} remporte le Game of S.K.A.T.E.`;
    }
    switch (match.phase) {
      case "set_idle":
        return `${profileName(imposer)} impose la figure. ${iAmImposer ? "Annonce ton trick et lance l'essai." : "Attends l'annonce."}`;
      case "set_attempting":
        return `${profileName(imposer)} est en train de poser son trick.`;
      case "copy_idle":
        return `${profileName(responder)} doit copier ${currentTrick}. ${iAmResponder ? "Lance ta tentative." : "En attente."}`;
      case "copy_attempting":
        return `${profileName(responder)} tente de reproduire ${currentTrick}.`;
      case "confirm":
        return `${profileName(responder)} déclare avoir posé. Confirmation attendue de ${profileName(imposer)}.`;
      case "dispute":
        return "Litige en cours : vote éclair pour trancher.";
      default:
        return "Tour en cours.";
    }
  }, [match, matchEnded, imposer, responder, iAmImposer, iAmResponder, profileAName, profileBName, currentTrick]);

  const timerLabel = () => {
    if (timer === null) return "45.0";
    return timer.toFixed(1);
  };

  const renderActionButtons = () => {
    if (!match || matchEnded) return null;
    switch (match.phase) {
      case "set_idle":
        return iAmImposer ? (
          <div className="flex w-full flex-col gap-4">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">Annoncer le trick</div>
            <div className="flex gap-2">
              <input
                value={trickDraft}
                onChange={(event) => setTrickDraft(event.target.value)}
                placeholder="Nom du trick"
                className="flex-1 rounded-xl border border-white/10 bg-[#0b0e13] px-4 py-2 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-orange-400"
              />
              <button
                onClick={startSetAttempt}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-orange-400"
              >
                <CheckCircle2 className="h-4 w-4" /> Lancer ma figure
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            En attente de l'annonce de {profileName(imposer)}.
          </div>
        );
      case "set_attempting":
        return (
          <div className="flex w-full flex-col gap-3">
            {iAmImposer ? (
              <>
                <button
                  onClick={() => declareSetResult(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" /> Je l'ai posée
                </button>
                <button
                  onClick={() => declareSetResult(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/80 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-red-500"
                >
                  <XCircle className="h-4 w-4" /> J'ai raté
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                {profileName(imposer)} est en action. Prépare-toi à copier.
              </div>
            )}
          </div>
        );
      case "copy_idle":
        return iAmResponder ? (
          <button
            onClick={declareCopyStart}
            className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-orange-400"
          >
            <CheckCircle2 className="h-4 w-4" /> Tenter la figure
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            {profileName(responder)} se prépare à tenter le trick.
          </div>
        );
      case "copy_attempting":
        return (
          <div className="flex w-full flex-col gap-3">
            {iAmResponder ? (
              <>
                <button
                  onClick={() => declareCopyResult(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" /> Posée
                </button>
                <button
                  onClick={() => declareCopyResult(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/80 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-red-500"
                >
                  <XCircle className="h-4 w-4" /> Ratée
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={forfeitCopy}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/20"
                  >
                    <Flag className="h-4 w-4" /> Forfait
                  </button>
                  <button
                    onClick={triggerLastTry}
                    disabled={!canUseLastTry}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                      canUseLastTry
                        ? "bg-purple-500/80 text-black hover:bg-purple-400"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" /> Dernier essai
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                {profileName(responder)} tente la copie. Attends sa déclaration.
              </div>
            )}
          </div>
        );
      case "confirm":
        return (
          <div className="flex w-full flex-col gap-3">
            {iAmImposer ? (
              <>
                <button
                  onClick={() => handleConfirmation(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-emerald-400"
                >
                  <ThumbsUp className="h-4 w-4" /> Confirmer réussite
                </button>
                <button
                  onClick={() => handleConfirmation(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/80 px-5 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:bg-red-500"
                >
                  <ThumbsDown className="h-4 w-4" /> Contester
                </button>
                <p className="text-[11px] text-white/50">
                  Contestions restantes : {MAX_CONTESTS - getContestCount(imposer, match)}
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                {profileName(imposer)} vérifie ta figure.
              </div>
            )}
          </div>
        );
      case "dispute":
        return (
          <div className="flex w-full flex-col gap-3">
            <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              <AlertTriangle className="mr-2 inline h-4 w-4" /> Litige : vote "Valider" ou "Refuser".
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => submitDisputeVote("validate")}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                  payload.disputeVotes?.[iAm] === "validate"
                    ? "bg-emerald-500/90 text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                <ThumbsUp className="mr-2 inline h-4 w-4" /> Valider
              </button>
              <button
                onClick={() => submitDisputeVote("refuse")}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                  payload.disputeVotes?.[iAm] === "refuse"
                    ? "bg-red-500/80 text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                <ThumbsDown className="mr-2 inline h-4 w-4" /> Refuser
              </button>
            </div>
            <p className="text-xs text-white/60">
              Votes enregistrés : A = {payload.disputeVotes?.A ?? "?"}, B = {payload.disputeVotes?.B ?? "?"}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#05070b] px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)]">
        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>{profileAName}</span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] ${
                imposer === "A" ? "bg-orange-500 text-black" : "bg-white/5 text-white/50"
              }`}
            >
              {imposer === "A" ? "Impose" : "Répond"}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <Letters count={lettersA} />
          </div>
          <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/60">
            <div className="grid h-full place-items-center text-sm text-white/40">Flux Rider A</div>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-white/40">
            <span>Latence A</span>
            <div className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 w-3/4 rounded-full bg-emerald-400/90" />
            </div>
            <span>Latence B−</span>
          </div>
          <div className="mt-6 flex h-80 flex-col rounded-2xl border border-white/10 bg-black/40">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/50">
              <MessageSquare className="h-4 w-4" /> Live Chat
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" role="log" aria-live="polite">
              {msgs.map((message) => {
                const side = resolveSender(message, match);
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
                placeholder="Écris un message…"
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

        <section className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-[#10141d]/90 p-6 text-center shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40">
            <Sparkles className="h-4 w-4 text-orange-400" /> Auto-arbitrage LIVE
            {!rtOnline && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-200">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.4em] text-white/30">Temps restant</div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Timer className="h-5 w-5 text-orange-400" />
              <div className="text-5xl font-bold text-orange-400 drop-shadow-[0_0_20px_rgba(255,138,0,0.5)]">{timerLabel()}</div>
            </div>
            {match?.timer_for && timer !== null && timer <= 0 && !matchEnded && iAm !== match.timer_for && (
              <button
                onClick={handleTimeout}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-red-500"
              >
                <AlertTriangle className="h-4 w-4" /> Temps écoulé
              </button>
            )}
          </div>

          <div className="w-full space-y-4 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">Tour #{roundNumber}</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {currentTrick ? `Trick imposé : ${currentTrick}` : "En attente du trick"}
              </div>
              <p className="mt-2 text-sm text-white/60">{phaseDescription}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-[10px] uppercase tracking-[0.35em] text-white/40">Actions</h3>
              <div className="mt-3 flex flex-col gap-3">{renderActionButtons()}</div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/60">
              <Info className="h-4 w-4 text-orange-300" />
              <p>
                Auto-déclaration + double-confirmation. Après chaque verdict, inversion des rôles. Contestations limitées à {MAX_CONTESTS} par rider.
              </p>
            </div>
          </div>

          {matchEnded && (
            <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
              <Crown className="h-4 w-4" /> {profileName(match.winner ?? "A")}
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0f131b]/85 p-6 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/40">
            <span>{profileBName}</span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.3em] ${
                imposer === "B" ? "bg-orange-500 text-black" : "bg-white/5 text-white/50"
              }`}
            >
              {imposer === "B" ? "Impose" : "Répond"}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <Letters count={lettersB} />
          </div>
          <div className="mt-6 flex-1 rounded-2xl border border-white/10 bg-black/60">
            <div className="grid h-full place-items-center text-sm text-white/40">Flux Rider B</div>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-white/40">
            <span>Latence A</span>
            <div className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 w-2/3 rounded-full bg-emerald-400/90" />
            </div>
            <span>Latence B−</span>
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/70">
            Deux riders s'auto-arbitrent : annonce, tentative, auto-déclaration, confirmation. Litiges réglés en 30s max. Lettes : S.K.A.T.E.
          </div>
          <button className="mt-auto rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-black transition hover:bg-orange-400">
            Lancer le stream
          </button>
        </section>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl items-center justify-center gap-3 rounded-3xl border border-white/10 bg-[#0f131b]/85 px-5 py-3 text-sm text-white/70">
        <Crown className="h-4 w-4 text-amber-300" /> {profileAName} vs {profileBName} — Live Game of S.K.A.T.E.
      </div>
    </div>
  );
}

function resolveSender(message: ChatMessage, match: Match | null): Side | null {
  if (!match) return null;
  if (message.sender === match.rider_a) return "A";
  if (message.sender === match.rider_b) return "B";
  return null;
}
