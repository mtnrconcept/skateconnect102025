// src/components/LiveSkateRoom.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Camera, CameraOff, Mic, MicOff, Trophy, XCircle, Users, Video, Send, WifiOff, TimerReset, MessageSquare,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient"; // ← unifie l'import
import { useRouter } from "@/lib/router";

type Side = "A" | "B";
type MatchStatus = "pending" | "active" | "ended" | "cancelled";

type MatchRow = {
  id: string;
  rider_a: string;
  rider_b: string;
  turn: Side;
  letters_a: number;
  letters_b: number;
  status: MatchStatus;
  winner: Side | null;
  created_at: string;
  accepted_at?: string | null;
  starts_at?: string | null;     // synchro départ
  countdown_s?: number | null;   // secondes de countdown affichées côté client
};

type ChatMsg = { id: string; from: string; text: string; ts: number };

const LETTERS = "SHRED";
const LETTERS_LEN = LETTERS.length;

/* ==============================
   UI : lettres / scoreboard
   ============================== */
function LettersRow({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-4 select-none">
      {LETTERS.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={`text-5xl md:text-6xl font-extrabold tracking-widest ${
            i < count ? "text-orange-400 drop-shadow-[0_0_14px_rgba(251,146,60,0.45)]" : "text-gray-600"
          }`}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function ScoreSlot({
  label,
  count,
  ctaLabel,
  onClick,
  disabled,
  hint,
}: {
  label: string;
  count: number;
  ctaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-gray-400">{label}</span>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`text-[11px] uppercase tracking-wide ${
            disabled ? "text-gray-500 cursor-not-allowed" : "text-orange-300 hover:text-orange-200"
          }`}
          title={hint}
        >
          {ctaLabel}
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-3 rounded-lg border border-white/10 transition-colors ${
          disabled ? "bg-white/5 text-gray-500 cursor-not-allowed" : "bg-white/5 hover:bg-white/10"
        }`}
        aria-label={`${label}: incrémenter une lettre`}
        title={hint}
      >
        <LettersRow count={count} />
      </button>
    </div>
  );
}

/* ==============================
   LiveSkateRoom
   ============================== */
export default function LiveSkateRoom() {
  const { location, navigate } = useRouter();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [matchId, setMatchId] = useState<string>(() => searchParams.get("room") || "");
  const [me, setMe] = useState<string | null>(null);

  // Match + realtime
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [rtStatus, setRtStatus] = useState<"unknown" | "subscribed" | "closed" | "errored">("unknown");
  const chanRef = useRef<RealtimeChannel | null>(null);

  // WebRTC
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [simulateRemote, setSimulateRemote] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Presence (liste UIDs dans la room)
  const [peers, setPeers] = useState<string[]>([]);

  // Chat broadcast (stateless)
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);

  // Compte à rebours synchro
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  // Phase visuelle (utile pour banderoles)
  const isEnded = match?.status === "ended";

  /* ---------- Boot ---------- */
  useEffect(() => {
    if (!matchId) {
      const id = crypto.randomUUID();
      setMatchId(id);
      const url = new URL(location.pathname, window.location.origin);
      url.searchParams.set("room", id);
      navigate(url.pathname + url.search, { replace: true });
    }
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // Bind streams to <video>
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Simu remote (démo)
  useEffect(() => {
    if (!simulateRemote) return;
    if (!localStream) return;
    setRemoteStream(localStream);
    return () => setRemoteStream(null);
  }, [simulateRemote, localStream]);

  /* ---------- Fetch + Realtime match ---------- */
  const fetchMatch = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("gos_match")
      .select(
        "id,rider_a,rider_b,turn,letters_a,letters_b,status,winner,created_at,accepted_at,starts_at,countdown_s",
      )
      .eq("id", id)
      .maybeSingle();
    if (!error) setMatch((data as MatchRow) ?? null);
  }, []);

  useEffect(() => {
    if (!matchId || !me) return;

    // Initial fetch
    void fetchMatch(matchId);

    // Realtime updates
    const ch = supabase
      .channel(`gos:${matchId}`, { config: { presence: { key: me }, broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
        (payload) => setMatch(payload.new as MatchRow),
      )
      .on("broadcast", { event: "chat:msg" }, ({ payload }) => {
        if (!payload?.text || !payload?.from) return;
        setChatMsgs((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: String(payload.from), text: String(payload.text), ts: Number(payload.ts) || Date.now() },
        ]);
      })
      .subscribe(async (status) => {
        setRtStatus(status === "SUBSCRIBED" ? "subscribed" : status === "CLOSED" ? "closed" : status === "CHANNEL_ERROR" ? "errored" : "unknown");
        if (status === "SUBSCRIBED") await ch.track({ user_id: me, ts: Date.now() });
      });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setPeers(Object.keys(state));
    });

    chanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [matchId, me]);

  /* ---------- Countdown synchronisé sur starts_at ---------- */
  useEffect(() => {
    // stop
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    if (!match?.starts_at || match.status !== "active") return;
    const t0 = Date.parse(match.starts_at);
    if (Number.isNaN(t0)) return;
    const tick = () => {
      const diff = Math.ceil((t0 - Date.now()) / 1000);
      setCountdown(diff > 0 ? diff : null);
      if (diff <= 0 && countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
    tick();
    countdownTimerRef.current = window.setInterval(tick, 200) as unknown as number;
    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [match?.starts_at, match?.status]);

  /* ---------- WebRTC minimal ---------- */
  useEffect(() => {
    if (!matchId || !me) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;

    const ensureRemote = () => {
      const ms = new MediaStream();
      pc.getReceivers().forEach((r) => r.track && ms.addTrack(r.track));
      if (ms.getTracks().length) setRemoteStream(ms);
    };

    pc.ontrack = ensureRemote;
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        chanRef.current?.send({ type: "broadcast", event: "ice", payload: { from: me, candidate: ev.candidate } });
      }
    };

    const attachLocal = () => {
      if (!localStream) return;
      const existing = pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[];
      localStream.getTracks().forEach((t) => {
        if (!existing.includes(t)) pc.addTrack(t, localStream);
      });
    };

    const makeOffer = async () => {
      attachLocal();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      chanRef.current?.send({ type: "broadcast", event: "offer", payload: { from: me, sdp: offer } });
    };
    const makeAnswer = async () => {
      attachLocal();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      chanRef.current?.send({ type: "broadcast", event: "answer", payload: { from: me, sdp: answer } });
    };

    // Signaling events
    const ch = chanRef.current;
    if (ch) {
      ch
        .on("presence", { event: "sync" }, () => {
          const ids = Object.keys(ch.presenceState());
          // L’initiateur est le plus petit uid — il émet l’offre
          if (ids.length >= 2 && ids.sort()[0] === me && pc.signalingState === "stable") void makeOffer();
        })
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (!payload?.sdp || payload.from === me) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await makeAnswer();
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (!payload?.sdp || payload.from === me) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (!payload?.candidate || payload.from === me) return;
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {}
        });
    }

    return () => {
      try {
        pc.getSenders().forEach((s) => s.track && s.track.stop());
        pc.close();
      } catch {}
      pcRef.current = null;
    };
  }, [matchId, me, localStream]);

  /* ---------- Helpers DB ---------- */
  const iAmSide: Side | null = useMemo(() => {
    if (!match || !me) return null;
    if (match.rider_a === me) return "A";
    if (match.rider_b === me) return "B";
    return null;
  }, [match, me]);

  const myTurn = match?.status === "active" && match?.turn === iAmSide;
  const copyTurn = match?.status === "active" && iAmSide && match?.turn !== iAmSide;

  const addLetter = useCallback(
    async (side: Side) => {
      if (!match) return;
      const col = side === "A" ? "letters_a" : "letters_b";
      const current = Number(match[col] ?? 0);
      const next = Math.min(LETTERS_LEN, current + 1);

      const updates: Partial<MatchRow> = { [col]: next } as any;
      // Fin de partie si atteint
      if (next >= LETTERS_LEN) {
        updates.status = "ended";
        updates.winner = side === "A" ? "B" : "A";
      }

      const { error } = await supabase.from("gos_match").update(updates).eq("id", match.id);
      if (!error) setMatch((prev) => (prev ? ({ ...prev, ...updates } as MatchRow) : prev));
    },
    [match],
  );

  const switchTurn = useCallback(async () => {
    if (!match) return;
    const next: Side = match.turn === "A" ? "B" : "A";
    // RPC si dispo, sinon fallback update
    const sw = await supabase.rpc("switch_turn", { p_match_id: match.id });
    if (!sw.error && sw.data) {
      setMatch(sw.data as MatchRow);
      return;
    }
    const up = await supabase.from("gos_match").update({ turn: next }).eq("id", match.id).select("*").single();
    if (!up.error && up.data) setMatch(up.data as MatchRow);
  }, [match]);

  /* ---------- Contrôles de manche ---------- */
  // Setter rate son set → lettre pour LUI + tour passe
  const onSetterFailed = async () => {
    if (!myTurn || !iAmSide) return;
    await addLetter(iAmSide);
    await switchTurn();
  };

  // Responder constate que copie adverse a échoué → lettre pour L’AUTRE (setter conserve le tour)
  const onResponderFailed = async () => {
    if (!copyTurn || !iAmSide) return;
    const loser: Side = match!.turn === "A" ? "B" : "A";
    await addLetter(loser);
    // Option : conserver le tour au setter (règle classique)
    // Si tu veux passer le tour au responder après une copie ratée, décommente :
    // await switchTurn();
  };

  /* ---------- AV ---------- */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (pcRef.current) stream.getTracks().forEach((t) => pcRef.current!.addTrack(t, stream));
    } catch (err) {
      console.error("Accès caméra refusé:", err);
    }
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };
  const toggleCamera = () => {
    const next = !cameraOn;
    setCameraOn(next);
    localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  /* ---------- Chat (broadcast) ---------- */
  const sendChat = () => {
    const t = chatInput.trim();
    if (!t || !chanRef.current || !me) return;
    setChatInput("");
    const msg: ChatMsg = { id: crypto.randomUUID(), from: me, text: t, ts: Date.now() };
    setChatMsgs((prev) => [...prev, msg]); // optimiste
    chanRef.current.send({ type: "broadcast", event: "chat:msg", payload: msg });
  };

  /* ---------- Bandeaux & états ---------- */
  const iAmWinner =
    isEnded &&
    ((match?.winner === "A" && iAmSide === "A") || (match?.winner === "B" && iAmSide === "B"));

  const lettersA = match?.letters_a ?? 0;
  const lettersB = match?.letters_b ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {matchId && (
            <div className="hidden md:flex items-center gap-2 mr-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <span className="truncate max-w-[320px]">Salle: {matchId}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="text-orange-300 hover:text-orange-200"
                title="Copier le lien de la salle"
              >
                Copier le lien
              </button>
            </div>
          )}
          <>
            <button onClick={toggleMute} className="px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10">
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={toggleCamera} className="px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10">
              {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
            </button>
          </>
          <button onClick={startCamera} className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white font-medium">
            Activer caméra
          </button>
        </div>
      </div>

      {/* Bandeau statut Realtime / Tour / Countdown */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B0E13] px-3 py-2 text-sm">
        <MessageSquare className="w-4 h-4 text-white/60" />
        Chat & Tour live
        <span className="mx-2 text-white/20">•</span>
        Tour actuel :{" "}
        <b className="ml-1">
          {match?.turn ? (match.turn === iAmSide ? "Vous" : "Adversaire") : "—"}
        </b>
        {countdown !== null && (
          <>
            <span className="mx-2 text-white/20">•</span>
            <span className="inline-flex items-center gap-2">
              <TimerReset className="w-4 h-4 text-white/60" />
              Départ dans <b className="ml-1">{countdown}s</b>
            </span>
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-2 text-xs">
          {rtStatus === "subscribed" ? null : (
            <>
              <WifiOff className="w-4 h-4" /> Realtime offline
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Local video */}
        <div className="relative rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full aspect-video object-cover" />
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white backdrop-blur border border-white/20">
            Vous {match?.turn === iAmSide ? "• Au tour" : ""}
          </div>
          <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
            <ScoreSlot
              label="Votre score"
              count={iAmSide === "A" ? lettersA : iAmSide === "B" ? lettersB : 0}
              ctaLabel="Trick refusé (setter)"
              onClick={onSetterFailed}
              disabled={!myTurn || isEnded}
              hint={myTurn ? "Vous êtes setter : «je rate» → +1 lettre pour vous et le tour passe" : "Pas votre tour"}
            />
          </div>
        </div>

        {/* Remote video */}
        <div className="relative rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full aspect-video object-cover" />
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white backdrop-blur border border-white/20">
            Adversaire {match?.turn && match?.turn !== iAmSide ? "• Au tour" : ""}
          </div>
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Users size={36} className="mx-auto text-white/70" />
                <p className="mt-2 text-sm text-white/80">En attente du flux distant…</p>
                <button
                  type="button"
                  onClick={() => setSimulateRemote((v) => !v)}
                  className="mt-3 text-xs text-orange-300 hover:text-orange-200 underline"
                >
                  {simulateRemote ? "Arrêter la simulation" : "Simuler un flux distant (démo)"}
                </button>
              </div>
            </div>
          )}
          <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
            <ScoreSlot
              label="Score adversaire"
              count={iAmSide === "A" ? lettersB : iAmSide === "B" ? lettersA : 0}
              ctaLabel="Copie échouée (responder)"
              onClick={onResponderFailed}
              disabled={!copyTurn || isEnded}
              hint={!copyTurn ? "Ce n’est pas à l’autre de prouver / pas votre rôle" : "Tu constates une copie ratée → +1 lettre à l’adversaire"}
            />
          </div>
        </div>
      </div>

      {/* Panneaux secondaires */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Score — Vous</h2>
            <button
              onClick={onSetterFailed}
              disabled={!myTurn || isEnded}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                myTurn && !isEnded
                  ? "bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30"
                  : "bg-white/5 text-gray-500 border-white/10 cursor-not-allowed"
              }`}
              title={myTurn ? "Trick refusé" : "Pas votre tour"}
            >
              Trick refusé (setter)
            </button>
          </div>
          <LettersRow count={iAmSide === "A" ? lettersA : iAmSide === "B" ? lettersB : 0} />
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Score — Adversaire</h2>
            <button
              onClick={onResponderFailed}
              disabled={!copyTurn || isEnded}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                copyTurn && !isEnded
                  ? "bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30"
                  : "bg-white/5 text-gray-500 border-white/10 cursor-not-allowed"
              }`}
              title={copyTurn ? "Copie échouée détectée" : "Ce n'est pas à vous de juger"}
            >
              Copie échouée (responder)
            </button>
          </div>
          <LettersRow count={iAmSide === "A" ? lettersB : iAmSide === "B" ? lettersA : 0} />
        </div>
      </div>

      {/* Tour & prompt minimal (optionnel) */}
      <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2">
          <TimerReset className="w-4 h-4 text-white/70" />
          <span className="font-semibold">Tour actuel :</span>
          <span className="ml-1">{match?.turn ? (match.turn === iAmSide ? "Vous" : "Adversaire") : "—"}</span>
        </div>
        <p className="mt-2 text-sm text-white/60">
          Règle live : le setter valide ou rate son set. Si l’adversaire rate la copie, il prend une lettre. Le mot “SHRED” met fin au match.
        </p>
      </div>

      {/* Chat live (broadcast) */}
      <div className="mt-6 rounded-xl bg-white/5 border border-white/10">
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white/70" /> Chat (live)
        </div>
        <div className="h-64 overflow-y-auto px-4 py-3 space-y-2">
          {chatMsgs.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-white/40 mr-2">{new Date(m.ts).toLocaleTimeString()}</span>
              <span className="font-medium">{m.from === me ? "Vous" : "Adversaire"}</span>
              <span className="mx-2 text-white/40">•</span>
              <span className="text-white/90">{m.text}</span>
            </div>
          ))}
          {chatMsgs.length === 0 && <div className="text-white/40 text-sm">Aucun message pour l’instant.</div>}
        </div>
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Écris un message…"
            className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
          />
          <button onClick={sendChat} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-black">
            <Send className="w-4 h-4" /> Envoyer
          </button>
        </div>
      </div>

      {/* Fin de match */}
      {isEnded && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {iAmWinner ? <Trophy className="text-emerald-400" /> : <XCircle className="text-red-400" />}
            <div>
              <div className="text-white font-semibold">{iAmWinner ? "Victoire" : "Défaite"}</div>
              <div className="text-sm text-gray-300">
                Gagnant : Rider {match?.winner ?? "?"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==============================
   XP helper (simplifié)
   ============================== */
async function awardExperience(_points: number) {
  // Optionnel : implémente un RPC `award_xp(user_id uuid, delta_xp int)` côté DB
  // await supabase.rpc("award_xp", { user_id: <uid>, delta_xp: points });
  return;
}
