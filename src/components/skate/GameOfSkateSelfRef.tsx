import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRightSquare,
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  Crown,
  Lightbulb,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  UserPlus,
  Volume2,
  VolumeX,
  Wand2,
  WifiOff,
  XCircle,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import CountdownAnimation from "./CountdownAnimation";

/* ⬇️ NOUVEAU : hooks utilitaires côté lib pour end sur leave (facultatif mais propre) */
import { setupEndOnLeave } from "@/lib/skate"; // assure-toi d’avoir exporté cette fonction dans src/lib/skate.ts

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
  /* ⬇️ IMPORTANT : présents côté SQL pour le countdown */
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
const WEBRTC_EVENT = "gos:rtc";

type WebRtcSignal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit }
  | { kind: "hangup" }
  | { kind: "restart" };

type BroadcastSignal = WebRtcSignal & {
  matchId: string;
  from: string;
  ts?: number;
};

const bindStreamToVideo = (
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
  muted: boolean,
) => {
  if (!video) return;
  if (!stream) {
    video.srcObject = null;
    return;
  }

  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  video.muted = muted;
  video.playsInline = true;

  const play = () => {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => undefined);
    }
  };

  if (video.readyState >= 2) {
    play();
  } else {
    const handleLoaded = () => {
      video.removeEventListener("loadeddata", handleLoaded);
      play();
    };
    video.addEventListener("loadeddata", handleLoaded);
  }
};

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
      <div className="mb-4 flex items-center gap-2 text/base font-semibold text-white/80">
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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoMobileRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoMobileRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [hasSentOffer, setHasSentOffer] = useState(false);
  const [isRestartingConnection, setIsRestartingConnection] = useState(false);

  const isInitiator = useMemo(() => (match?.rider_a ?? null) === me, [match?.rider_a, me]);

  const updateLocalVideoElements = useCallback(
    (stream: MediaStream | null) => {
      bindStreamToVideo(localVideoRef.current, stream, true);
      bindStreamToVideo(localVideoMobileRef.current, stream, true);
    },
    [],
  );

  const updateRemoteVideoElements = useCallback(
    (stream: MediaStream | null) => {
      bindStreamToVideo(remoteVideoRef.current, stream, remoteAudioMuted);
      bindStreamToVideo(remoteVideoMobileRef.current, stream, remoteAudioMuted);
    },
    [remoteAudioMuted],
  );

  const sendSignal = useCallback(
    (payload: WebRtcSignal) => {
      if (!chanRef.current) return;
      chanRef.current.send({
        type: "broadcast",
        event: WEBRTC_EVENT,
        payload: {
          ...payload,
          matchId,
          from: me,
          ts: Date.now(),
        },
      });
    },
    [matchId, me],
  );

  const attachTracksToPeer = useCallback((stream: MediaStream) => {
    const pc = pcRef.current;
    if (!pc) return;
    const senders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const existing = senders.find((sender) => sender.track?.kind === track.kind);
      if (existing && typeof existing.replaceTrack === "function") {
        existing.replaceTrack(track).catch(() => undefined);
      } else {
        try {
          pc.addTrack(track, stream);
        } catch (error) {
          console.warn("[gos] addTrack failed", error);
        }
      }
    });
  }, []);

  const ensurePeerConnection = useCallback(() => {
    if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") {
      setCameraError("WebRTC non supporté par cet environnement.");
      return null;
    }
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          kind: "candidate",
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      remoteStreamRef.current = stream;
      updateRemoteVideoElements(stream);
      setRemoteConnected(true);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setRemoteConnected(true);
      } else if (state === "failed" || state === "disconnected" || state === "closed") {
        setRemoteConnected(false);
      }
    };

    if (localStreamRef.current) {
      attachTracksToPeer(localStreamRef.current);
    }

    return pc;
  }, [attachTracksToPeer, sendSignal, updateRemoteVideoElements]);

  const stopLocalStream = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    localStreamRef.current = null;
    updateLocalVideoElements(null);
    setCameraReady(false);
  }, [updateLocalVideoElements]);

  const teardownPeerConnection = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {}
    }
    pcRef.current = null;
    remoteStreamRef.current = null;
    updateRemoteVideoElements(null);
    setRemoteConnected(false);
    setHasSentOffer(false);
  }, [updateRemoteVideoElements]);

  const requestCameraAccess = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Caméra non supportée par cet appareil.");
      return null;
    }

    if (localStreamRef.current) {
      updateLocalVideoElements(localStreamRef.current);
      setCameraReady(true);
      return localStreamRef.current;
    }

    if (isRequestingCamera) return null;
    setIsRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = cameraEnabled;
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = micEnabled;
      });
      updateLocalVideoElements(stream);
      const pc = ensurePeerConnection();
      if (pc) {
        attachTracksToPeer(stream);
      }
      setCameraReady(true);
      setCameraError(null);
      return stream;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Accès caméra impossible.";
      setCameraError(message);
      setCameraReady(false);
      return null;
    } finally {
      setIsRequestingCamera(false);
    }
  }, [attachTracksToPeer, cameraEnabled, ensurePeerConnection, isRequestingCamera, micEnabled, updateLocalVideoElements]);

  const startNegotiation = useCallback(async () => {
    const pc = ensurePeerConnection();
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ kind: "offer", sdp: offer });
    setHasSentOffer(true);
  }, [ensurePeerConnection, sendSignal]);

  const restartConnection = useCallback(async () => {
    if (isRestartingConnection) return;
    setIsRestartingConnection(true);
    sendSignal({ kind: "restart" });
    teardownPeerConnection();
    setRemoteConnected(false);
    setHasSentOffer(false);
    if (!cameraReady) {
      await requestCameraAccess();
    }
    setTimeout(() => setIsRestartingConnection(false), 400);
  }, [cameraReady, isRestartingConnection, requestCameraAccess, sendSignal, teardownPeerConnection]);

  const handleIncomingSignal = useCallback(
    async (payload: BroadcastSignal | null) => {
      if (!payload || payload.matchId !== matchId || payload.from === me) return;
      try {
        switch (payload.kind) {
          case "offer": {
            await requestCameraAccess();
            const pc = ensurePeerConnection();
            if (!pc || !payload.sdp) return;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({ kind: "answer", sdp: answer });
            break;
          }
          case "answer": {
            const pc = pcRef.current;
            if (pc && payload.sdp && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
            break;
          }
          case "candidate": {
            const pc = pcRef.current;
            if (pc && payload.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
            break;
          }
          case "hangup":
            teardownPeerConnection();
            break;
          case "restart":
            teardownPeerConnection();
            setHasSentOffer(false);
            if (isInitiator && cameraReady) {
              await requestCameraAccess();
              await startNegotiation();
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.warn("[gos] signal handling error", error);
      }
    },
    [cameraReady, ensurePeerConnection, isInitiator, matchId, me, requestCameraAccess, sendSignal, startNegotiation, teardownPeerConnection],
  );

  /* ---------- Chargements initiaux ---------- */
  const fetchMatch = useCallback(async () => {
    /* ⬇️ IMPORTANT : on sélectionne aussi starts_at et countdown_s pour le countdown */
    const { data, error } = await supabase
      .from("gos_match")
      .select("id,rider_a,rider_b,turn,letters_a,letters_b,status,winner,created_at,accepted_at,starts_at,countdown_s")
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

  /* ---------- Montage / Abonnements ---------- */
  useEffect(() => {
    let cancelled = false;
  
    (async () => {
      await Promise.all([fetchMatch(), fetchChat()]);
      if (cancelled) return;
  
      setChannelReady(false);
      setRtOnline(false);
  
      // IMPORTANT: self:true + ack:true pour fiabiliser la diffusion
      const channel = supabase
        .channel(`gos:${matchId}`, {
          config: { broadcast: { self: true, ack: true }, presence: { key: me } },
        })
        // CHAT: on capte tous les inserts
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "gos_chat_message", filter: `match_id=eq.${matchId}` },
          (payload) => {
            const msg = payload.new as ChatMessage;
            setMsgs((prev) => [...prev, msg]);
  
            // Détection locale 'Vainqueur : Rider X' — on garde, mais on la rend NOP en cas d’échec (pas de throw)
            const txt = (msg?.text ?? "").toString();
            const m = txt.match(/Vainqueur\s*:\s*Rider\s*(A|B)/i);
            if (m) {
              const winner = (m[1].toUpperCase() as "A" | "B");
              supabase.from("gos_match")
                .update({ status: "ended", winner })
                .eq("id", matchId)
                .then(({ error }) => { if (error) console.warn("[gos] end-on-victory update failed", error); });
            }
          },
        )
        // MATCH: on écoute INSERT/UPDATE/DELETE (selon tes triggers)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gos_match", filter: `id=eq.${matchId}` },
          (payload) => {
            // payload.eventType: INSERT | UPDATE | DELETE
            if (payload.eventType === "DELETE") {
              setMatch((m) => (m && m.id === matchId ? null : m));
            } else {
              setMatch(payload.new as Match);
            }
          },
        )
        // WebRTC
        .on("broadcast", { event: WEBRTC_EVENT }, ({ payload }) => {
          void handleIncomingSignal(payload as BroadcastSignal);
        })
        .subscribe((status) => {
          const subscribed = status === "SUBSCRIBED";
          setRtOnline(subscribed);
          setChannelReady(subscribed);
          // debug
          // console.debug("[gos] realtime status =", status);
        });
  
      chanRef.current = channel;
    })();
  
    // End-on-leave (si tu l’utilises)
    const disposeLeave = typeof window !== "undefined" && (setupEndOnLeave ? setupEndOnLeave(matchId, me) : undefined);
  
    return () => {
      cancelled = true;
      if (chanRef.current) {
        chanRef.current.unsubscribe();          // ✅ unsubscribe propre
        supabase.removeChannel(chanRef.current); // ✅ ensuite remove
        chanRef.current = null;
      }
      setChannelReady(false);
      setRtOnline(false);
      disposeLeave?.();
    };
  }, [fetchChat, fetchMatch, handleIncomingSignal, matchId, me]);
  

  /* ---------- Timer global 30 min ---------- */
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

  /* ---------- Countdown d’amorçage (utilise starts_at s’il est fetch) ---------- */
  useEffect(() => {
    const isActive = match?.status === "active";
    const startsAt = match?.starts_at ?? undefined;
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
  }, [match?.status, match?.starts_at, countdownKey]);

  const handleCountdownComplete = useCallback(() => {
    setCountdownActive(false);
  }, []);

  /* ---------- WebRTC offer initiale ---------- */
  useEffect(() => {
    if (!cameraReady || !channelReady || !isInitiator || hasSentOffer) return;
    (async () => {
      try {
        await startNegotiation();
      } catch (error) {
        console.warn("[gos] WebRTC offer error", error);
      }
    })();
  }, [cameraReady, channelReady, hasSentOffer, isInitiator, startNegotiation]);

  useEffect(() => {
    updateRemoteVideoElements(remoteStreamRef.current);
  }, [remoteAudioMuted, updateRemoteVideoElements]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  }, [cameraEnabled]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
  }, [micEnabled]);

  useEffect(() => {
    if (!match?.status) return;
    if (match.status === "cancelled" || match.status === "ended") {
      sendSignal({ kind: "hangup" });
      teardownPeerConnection();
      stopLocalStream();
    }
  }, [match?.status, sendSignal, stopLocalStream, teardownPeerConnection]);

  useEffect(() => {
    return () => {
      sendSignal({ kind: "hangup" });
      teardownPeerConnection();
      stopLocalStream();
    };
  }, [sendSignal, stopLocalStream, teardownPeerConnection]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, riderAName]);

  const displayNameB = useMemo(() => {
    if (!match) return "Rider B";
    return riderBName ?? match.rider_b ?? "Rider B";
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (tryRpc.error) {
      console.error("[gos] chat rpc error", tryRpc.error);
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

    await rpcPost("event", `Rider ${loser} échoue la copie ? +1 lettre`, {
      loser,
      type: "copy_fail",
    });

    if (result?.ended) {
      const winner = loser === "A" ? "B" : "A";
      /* ⬇️ Important : message conforme au pattern détecté */
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

    await rpcPost("event", `${iAm} rate son set ? main à ${iAm === "A" ? "B" : "A"}`, {
      actor: iAm,
      type: "set_fail",
    });
  };

  /* =========================================================
   *  Rendu MOBILE exact
   * ========================================================= */
  const MobileUI = () => {
    const activeLetterIndex = 1;

    return (
      <div className="md:hidden text-zinc-200 bg-black h-[100dvh] w-full overflow-hidden">
        <div className="mx-auto h-full max-w-[520px] px-4">
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

            {/* Vidéo */}
            <div className="relative rounded-2xl border border-zinc-700 bg-black/80 overflow-hidden">
              <video
                ref={remoteVideoMobileRef}
                autoPlay
                playsInline
                className={`h-full w-full object-cover ${remoteConnected ? "" : "opacity-40"}`}
              />
              {!remoteConnected && (
                <div className="absolute inset-0 grid place-items-center bg-black/75 px-6 text-center text-white/70">
                  <div className="text-sm">
                    {channelReady ? "En attente du rider adverse..." : "Connexion au canal..."}
                  </div>
                  <button
                    onClick={() => restartConnection()}
                    className="mt-4 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80"
                  >
                    Relancer la connexion
                  </button>
                </div>
              )}
              <div className="absolute bottom-4 right-4 w-32 rounded-xl border border-white/15 bg-black/70 p-1 shadow-xl">
                <video
                  ref={localVideoMobileRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-20 w-full rounded-lg object-cover ${cameraReady ? "" : "opacity-40"}`}
                />
                {!cameraReady && (
                  <button
                    onClick={() => requestCameraAccess()}
                    className="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-[10px] font-semibold uppercase tracking-widest text-white/80"
                  >
                    Activer la cam
                  </button>
                )}
              </div>
            </div>

            {/* Boutons vert/rouge */}
            <div className="flex items-center gap-4">
              <button
                onClick={onSetSucceeded}
                disabled={!isActiveMatch || isEnded || !myTurn}
                className="flex-1 h-12 rounded-xl font-semibold inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-800/30 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
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

            {/* Barre d’icônes basse */}
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

  const videoControlButtonClass =
    "grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/60 text-white transition hover:bg-white/10 disabled:opacity-40";

  const renderLocalDesktopPanel = (label: string) => (
    <div className="relative h-[440px] overflow-hidden rounded-2xl border border-white/5 bg-[#050608]">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover ${cameraReady ? "" : "opacity-30"}`}
      />
      {!cameraReady && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-white/80">
          <p className="text-sm font-medium">Active ta caméra pour être visible par ton adversaire.</p>
          <button
            onClick={() => requestCameraAccess()}
            disabled={isRequestingCamera}
            className="mt-4 rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {isRequestingCamera ? "Initialisation..." : "Activer ma caméra"}
          </button>
          {cameraError && <p className="mt-2 text-xs text-rose-300">{cameraError}</p>}
        </div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
        <Camera className="h-3.5 w-3.5" />
        Flux rider {label} (toi)
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 py-3 text-xs text-white/70">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${cameraReady ? "bg-emerald-400" : "bg-rose-400"}`} />
          {cameraReady ? "Caméra prête" : "Caméra en attente"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCameraEnabled((prev) => !prev)}
            className={videoControlButtonClass}
            aria-label="Activer/désactiver la caméra"
          >
            {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMicEnabled((prev) => !prev)}
            className={videoControlButtonClass}
            aria-label="Activer/désactiver le micro"
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => restartConnection()}
            disabled={isRestartingConnection}
            className={videoControlButtonClass}
            aria-label="Relancer la connexion"
          >
            <RefreshCw className={`h-4 w-4 ${isRestartingConnection ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderRemoteDesktopPanel = (label: string) => (
    <div className="relative h-[440px] overflow-hidden rounded-2xl border border-white/5 bg-[#050608]">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover ${remoteConnected ? "" : "opacity-30"}`}
      />
      {!remoteConnected && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-white/80">
          <p className="text-sm">
            {channelReady ? "En attente du flux adverse..." : "Connexion au canal en cours..."}
          </p>
          <button
            onClick={() => restartConnection()}
            disabled={isRestartingConnection}
            className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Relancer la connexion
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
        <Camera className="h-3.5 w-3.5" />
        Flux rider {label}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 py-3 text-xs text-white/70">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${remoteConnected ? "bg-emerald-400" : "bg-amber-300"}`} />
          {remoteConnected ? "Flux connecté" : "Flux en attente"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRemoteAudioMuted((prev) => !prev)}
            className={videoControlButtonClass}
            aria-label="Activer/désactiver l'audio adverse"
          >
            {remoteAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => restartConnection()}
            disabled={isRestartingConnection}
            className={videoControlButtonClass}
            aria-label="Relancer la vidéo adverse"
          >
            <RefreshCw className={`h-4 w-4 ${isRestartingConnection ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );

  /* ---------- Contenu central ---------- */
  const offlineBadge = !rtOnline ? (
    <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
      <WifiOff className="h-3 w-3" />
      Realtime déconnecté
    </span>
  ) : null;

  const leftVideoPanel = iAm === "A" ? renderLocalDesktopPanel("A") : renderRemoteDesktopPanel("A");
  const rightVideoPanel = iAm === "B" ? renderLocalDesktopPanel("B") : renderRemoteDesktopPanel("B");

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

      {/* MOBILE */}
      <MobileUI />

      {/* DESKTOP */}
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
              {iAm === "A" ? renderLocalDesktopPanel("A") : renderRemoteDesktopPanel("A")}
              <LatencyBar label="Latences A" />
            </div>
            <div className="flex flex-col gap-4">
              {iAm === "B" ? renderLocalDesktopPanel("B") : renderRemoteDesktopPanel("B")}
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
