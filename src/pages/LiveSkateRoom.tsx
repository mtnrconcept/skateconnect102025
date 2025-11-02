import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, Trophy, XCircle, Users, Video, Send, WifiOff, TimerReset, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { withTableFallback } from '../lib/postgrest';
import { useRouter } from '../lib/router';

type MatchPhase = 'idle' | 'active' | 'finished';
const LETTERS = ['S', 'H', 'R', 'E', 'D'] as const;

function ShredLetters({ value, onToggle, label }: { value: string; onToggle?: (next: string) => void; label: string }) {
  const picked = new Set(value.toUpperCase().split('').filter(Boolean));
  const handleClick = (ch: string) => {
    if (!onToggle) return;
    const has = picked.has(ch);
    let next = Array.from(picked);
    if (has) next = next.filter((c) => c !== ch); else next.push(ch);
    const ordered = LETTERS.filter((c) => next.includes(c)).join('');
    onToggle(ordered);
  };
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="flex gap-2">
        {LETTERS.map((ch) => {
          const active = picked.has(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => handleClick(ch)}
              className={`w-9 h-9 rounded-md border transition-all flex items-center justify-center text-lg font-black tracking-widest ${
                active
                  ? 'bg-red-600/20 border-red-500/60 text-red-300 shadow-[0_0_20px_rgba(220,38,38,0.35)]'
                  : 'bg-dark-700/50 border-dark-500 text-gray-300 hover:bg-dark-600'
              }`}
              aria-pressed={active}
              aria-label={`Lettre ${ch} ${active ? 'sélectionnée' : 'non sélectionnée'}`}
            >
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShredWordLarge({
  value,
  onClick,
  label,
  disabled = false,
  hint,
}: {
  value: string;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  const activeCount = Math.min(5, (value || '').length);
  const letters = LETTERS;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-gray-400">{label}</span>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`text-[11px] uppercase tracking-wide ${disabled ? 'text-gray-500 cursor-not-allowed' : 'text-orange-300 hover:text-orange-200'}`}
          title={hint}
        >
          J&apos;ai raté
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full py-3 rounded-lg border border-white/10 transition-colors ${
          disabled ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'
        }`}
        aria-label={`${label}: ajouter une lettre`}
        title={hint}
      >
        <div className="flex items-center justify-center gap-4 select-none">
          {letters.map((ch, idx) => (
            <span
              key={ch}
              className={`font-extrabold tracking-widest ${
                idx < activeCount ? 'text-orange-400 drop-shadow-[0_0_14px_rgba(251,146,60,0.45)]' : 'text-gray-600'
              } text-5xl md:text-6xl`}
            >
              {ch}
            </span>
          ))}
        </div>
      </button>
    </div>
  );
}

type ChatMsg = { id: string; from: string; text: string; ts: number };

export default function LiveSkateRoom() {
  const { location, navigate } = useRouter();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [roomId, setRoomId] = useState<string>(() => searchParams.get('room') || '');
  const arbiterMode = useMemo(() => searchParams.get('arbiter') === '1', [location.search]);
  const [userId, setUserId] = useState<string | null>(null);

  // Video/WebRTC
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Realtime channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [rtState, setRtState] = useState<'unknown' | 'subscribed' | 'closed' | 'errored'>('unknown');

  const [peers, setPeers] = useState<string[]>([]);
  const [phase, setPhase] = useState<MatchPhase>('idle');

  // Letters
  const [meLetters, setMeLetters] = useState<string>('');
  const [opponentLetters, setOpponentLetters] = useState<string>('');

  // Turn owner (userId du joueur dont c'est le tour)
  const [turnOwner, setTurnOwner] = useState<string | null>(null);

  // NOUVEAU: État pour suivre qui a cliqué en dernier
  const [lastClickedBy, setLastClickedBy] = useState<string | null>(null);

  // AV
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [simulateRemote, setSimulateRemote] = useState(false);

  // Optional DB
  const [dbAvailable, setDbAvailable] = useState(true);
  const dbAvailableRef = useRef(true);
  useEffect(() => { dbAvailableRef.current = dbAvailable; }, [dbAvailable]);

  const nextTurnIndexRef = useRef(0);

  // Minimal turn struct
  const [currentTurn, setCurrentTurn] = useState<{
    id: string;
    turn_index: number;
    proposer: string;
    trick_name: string;
    difficulty: number;
    status: 'proposed' | 'responded' | 'validated' | 'failed' | 'timeout' | 'disputed';
    deadlineAt: number | null;
    responder?: string;
    responderResult?: 'success' | 'fail' | 'timeout';
  } | null>(null);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);

  // Timer
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meLost = meLetters.toUpperCase() === LETTERS.join('');
  const oppLost = opponentLetters.toUpperCase() === LETTERS.join('');

  const winnerLabel = useMemo(() => {
    if (phase !== 'finished') return '';
    if (meLost && !oppLost) return 'Adversaire';
    if (oppLost && !meLost) return 'Vous';
    return '—';
  }, [phase, meLost, oppLost]);

  // Ensure room in URL + get user
  useEffect(() => {
    if (!roomId) {
      const id = crypto.randomUUID();
      setRoomId(id);
      const url = new URL(location.pathname, window.location.origin);
      url.searchParams.set('room', id);
      navigate(url.pathname + url.search, { replace: true });
    }
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Bind streams
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Demo simulate remote
  useEffect(() => {
    if (!simulateRemote) return;
    if (!localStream) return;
    setRemoteStream(localStream);
    return () => setRemoteStream(null);
  }, [simulateRemote, localStream]);

  // End when SHRED reached
  useEffect(() => {
    if (meLost || oppLost) {
      setPhase('finished');
      void awardExperience(50).catch(() => {});
    }
  }, [meLost, oppLost]);

  // Init signaling + realtime
  useEffect(() => {
    if (!roomId || !userId) return;

    const { pc, channel } = initSignaling({
      roomId,
      userId,
      localStreamGetter: () => localStream,
      onRemoteStream: (ms) => setRemoteStream(ms),
      onPeersChange: async (ids) => {
        setPeers(ids);
        if (ids.length >= 2) {
          const sorted = [...ids].sort();
          const initialTurn = sorted[0];
          setTurnOwner((prev) => {
            if (!prev) {
              channel.send({ type: 'broadcast', event: 'turn:init', payload: { owner: initialTurn } });
              return initialTurn;
            }
            return prev;
          });

          if (dbAvailableRef.current) {
            const player_a = sorted[0];
            const player_b = sorted[1];
            try {
              await withTableFallback(
                supabase
                  .from('skate_matches')
                  .upsert(
                    {
                      id: roomId,
                      mode: 'live',
                      player_a,
                      player_b,
                      status: 'active',
                      letters_a: '',
                      letters_b: '',
                      started_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' },
                  )
                  .select('*'),
                () => ({} as any),
                { onMissing: () => setDbAvailable(false) },
              );
              const maxRes = await withTableFallback(
                supabase.from('skate_turns').select('turn_index').eq('match_id', roomId).order('turn_index', { ascending: false }).limit(1),
                () => [] as Array<{ turn_index: number }>,
                { onMissing: () => setDbAvailable(false) },
              );
              const last = Array.isArray(maxRes) && maxRes.length > 0 ? Number(maxRes[0].turn_index) : -1;
              nextTurnIndexRef.current = Number.isFinite(last) ? last + 1 : 0;
            } catch { /* no-op */ }
          }
        }
      },
      onLettersRemote: (senderId, letters) => {
        if (!userId) return;
        if (senderId !== userId) setOpponentLetters(letters);
      },
    });

    pcRef.current = pc;
    channelRef.current = channel;

    // Realtime broadcast handlers
    channel
      .on('broadcast', { event: 'turn:init' }, ({ payload }) => {
        if (!payload?.owner) return;
        setTurnOwner((prev) => prev ?? String(payload.owner));
      })
      .on('broadcast', { event: 'turn:switch' }, ({ payload }) => {
        if (!payload?.owner) return;
        setTurnOwner(String(payload.owner));
      })
      .on('broadcast', { event: 'letters' }, ({ payload }) => {
        if (!payload?.letters || !payload?.from) return;
        if (payload.from !== userId) setOpponentLetters(String(payload.letters));
      })
      .on('broadcast', { event: 'player:first-miss' }, ({ payload }) => {
        if (!payload?.player) return;
        setLastClickedBy(String(payload.player));
      })
      .on('broadcast', { event: 'player:double-miss' }, ({ payload }) => {
        if (!payload?.player) return;
        setLastClickedBy(null);
      })
      .on('broadcast', { event: 'chat:msg' }, ({ payload }) => {
        if (!payload?.text || !payload?.from) return;
        setChatMsgs((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: String(payload.from), text: String(payload.text), ts: Number(payload.ts) || Date.now() },
        ]);
      })
      .on('broadcast', { event: 'turn:propose' }, ({ payload }) => setCurrentTurn(payload.turn as any))
      .on('broadcast', { event: 'turn:respond' }, ({ payload }) =>
        setCurrentTurn((t) => (t && t.id === payload.turnId ? { ...t, status: 'responded', responder: payload.responder, responderResult: payload.result } : t))
      )
      .on('broadcast', { event: 'turn:validate' }, ({ payload }) =>
        setCurrentTurn((t) => (t && t.id === payload.turnId ? { ...t, status: payload.decision === 'valid' ? 'validated' : 'failed' } : t))
      )
      .on('broadcast', { event: 'turn:timeout' }, ({ payload }) =>
        setCurrentTurn((t) => (t && t.id === payload.turnId ? { ...t, status: 'timeout', responderResult: 'timeout' } : t))
      )
      .subscribe((s) => {
        setRtState(s === 'SUBSCRIBED' ? 'subscribed' : s === 'CLOSED' ? 'closed' : s === 'CHANNEL_ERROR' ? 'errored' : 'unknown');
      });

    return () => {
      try { pc.close(); } catch {}
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  // Broadcast my letters on change
  useEffect(() => {
    if (!channelRef.current || !userId) return;
    channelRef.current.send({ type: 'broadcast', event: 'letters', payload: { from: userId, letters: meLetters } });

    if (dbAvailable && peers.length >= 2 && roomId) {
      const sorted = [...peers].sort();
      const isA = userId === sorted[0];
      const patch: any = isA ? { letters_a: meLetters } : { letters_b: meLetters };
      void withTableFallback(
        supabase.from('skate_matches').update(patch).eq('id', roomId).select('*'),
        () => ({} as any),
        { onMissing: () => setDbAvailable(false) },
      );
    }
  }, [meLetters]);

  // Persist finish
  useEffect(() => {
    if (!roomId || peers.length < 2) return;
    if (!meLost && !oppLost) return;
    const winner = meLost && !oppLost ? peers.filter((p) => p !== userId)[0] : (!meLost && oppLost ? userId : null);
    if (!dbAvailable) return;
    void withTableFallback(
      supabase.from('skate_matches').update({ status: 'finished', finished_at: new Date().toISOString(), winner }).eq('id', roomId).select('*'),
      () => ({} as any),
      { onMissing: () => setDbAvailable(false) },
    );
  }, [meLost, oppLost]);

  // Countdown
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (currentTurn?.deadlineAt) timerRef.current = setInterval(() => setNowMs(Date.now()), 300);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [currentTurn?.deadlineAt]);

  // AV controls
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setPhase('active');
      if (pcRef.current) stream.getTracks().forEach((t) => pcRef.current!.addTrack(t, stream));
    } catch (err) {
      console.error("Impossible d'accéder à la caméra:", err);
    }
  };
  const toggleMute = () => { const next = !muted; setMuted(next); localStream?.getAudioTracks().forEach((t) => (t.enabled = !next)); };
  const toggleCamera = () => { const next = !cameraOn; setCameraOn(next); localStream?.getVideoTracks().forEach((t) => (t.enabled = next)); };

  const sortedPeers = useMemo(() => [...peers].sort(), [peers]);
  const myOpponent = useMemo(() => (userId && sortedPeers.find((p) => p !== userId)) || null, [sortedPeers, userId]);

  const itIsMyTurn = !!(turnOwner && userId && turnOwner === userId);

  // NOUVELLES FONCTIONS: Gestion des clics sur "Trick raté"
  const handleMyTrickMissed = () => {
    if (!userId) return;
    
    if (lastClickedBy === userId) {
      // Double-clic: j'ajoute une lettre à MOI-MÊME
      markMissMe();
      setLastClickedBy(null);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player:double-miss',
        payload: { player: userId, letters: meLetters }
      });
    } else {
      // Premier clic: je passe le tour
      setLastClickedBy(userId);
      switchTurnTo(myOpponent || null);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player:first-miss',
        payload: { player: userId }
      });
    }
  };

  const handleOpponentTrickMissed = () => {
    if (!userId || !myOpponent) return;
    
    if (lastClickedBy === myOpponent) {
      // Double-clic adversaire: il reçoit une lettre
      markMissOpp();
      setLastClickedBy(null);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player:double-miss',
        payload: { player: myOpponent, letters: opponentLetters }
      });
    } else {
      // Premier clic adversaire: il passe le tour
      setLastClickedBy(myOpponent);
      switchTurnTo(userId);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player:first-miss',
        payload: { player: myOpponent }
      });
    }
  };

  const switchTurnTo = (owner: string | null) => {
    if (!owner) return;
    setTurnOwner(owner);
    channelRef.current?.send({ type: 'broadcast', event: 'turn:switch', payload: { owner } });
  };

  const markMissMe = () => {
    const have = new Set(meLetters.split(''));
    for (const ch of LETTERS) {
      if (!have.has(ch)) {
        setMeLetters((prev) => (prev + ch).slice(0, 5));
        void persistTurn('me');
        break;
      }
    }
  };
  
  const markMissOpp = () => {
    const have = new Set(opponentLetters.split(''));
    for (const ch of LETTERS) {
      if (!have.has(ch)) {
        setOpponentLetters((prev) => (prev + ch).slice(0, 5));
        void persistTurn('opp');
        break;
      }
    }
  };

  async function persistTurn(side: 'me' | 'opp') {
    try {
      if (!dbAvailableRef.current || peers.length < 2 || !roomId) return;
      const me = userId ?? sortedPeers[0];
      const opponent = sortedPeers.find((p) => p !== me) ?? sortedPeers[1];
      const proposer = side === 'me' ? opponent : me;

      const turn_index = nextTurnIndexRef.current++;
      await withTableFallback(
        supabase
          .from('skate_turns')
          .insert({
            id: crypto.randomUUID(),
            match_id: roomId,
            turn_index,
            proposer,
            trick_name: null,
            difficulty: null,
            video_a_url: null,
            video_b_url: null,
            status: 'failed',
            remote_deadline: null,
            meta_a: {},
            meta_b: {},
          })
          .select('*')
          .single(),
        () => ({} as any),
        { onMissing: () => setDbAvailable(false) },
      );
    } catch { /* optional */ }
  }

  // Chat
  const sendChat = () => {
    const t = chatInput.trim();
    if (!t || !channelRef.current || !userId) return;
    setChatInput('');
    const msg: ChatMsg = { id: crypto.randomUUID(), from: userId, text: t, ts: Date.now() };
    setChatMsgs((prev) => [...prev, msg]);
    channelRef.current.send({ type: 'broadcast', event: 'chat:msg', payload: msg });
  };

  // Legacy turn management
  const [trickInput, setTrickInput] = useState('');
  const [difficultyInput, setDifficultyInput] = useState<number>(2);
  const isLeader = useMemo(() => sortedPeers.length >= 2 && userId === sortedPeers[0], [sortedPeers, userId]);

  const handlePropose = async () => {
    if (!trickInput.trim() || sortedPeers.length < 2 || !userId) return;
    const proposer = userId;
    const id = crypto.randomUUID();
    const idx = nextTurnIndexRef.current++;
    const deadlineMs = Date.now() + 45_000;
    const turn = { id, turn_index: idx, proposer, trick_name: trickInput.trim(), difficulty: Number(difficultyInput) || 2, status: 'proposed' as const, deadlineAt: deadlineMs };
    setCurrentTurn(turn);
    channelRef.current?.send({ type: 'broadcast', event: 'turn:propose', payload: { turn } });

    if (dbAvailableRef.current) {
      void withTableFallback(
        supabase
          .from('skate_turns')
          .insert({
            id,
            match_id: roomId,
            turn_index: idx,
            proposer,
            trick_name: turn.trick_name,
            difficulty: turn.difficulty,
            status: 'proposed',
            remote_deadline: new Date(deadlineMs).toISOString(),
            meta_a: {},
            meta_b: {},
          })
          .select('*')
          .single(),
        () => ({} as any),
        { onMissing: () => setDbAvailable(false) },
      );
    }
  };

  const handleRespond = async (result: 'success' | 'fail') => {
    if (!currentTurn || currentTurn.status !== 'proposed' || !userId) return;
    const responder = userId;
    setCurrentTurn({ ...currentTurn, status: 'responded', responder, responderResult: result });
    channelRef.current?.send({ type: 'broadcast', event: 'turn:respond', payload: { turnId: currentTurn.id, responder, result } });

    if (isLeader) {
      if (dbAvailableRef.current) {
        void withTableFallback(
          supabase.from('skate_turns').update({ status: 'responded' }).eq('id', currentTurn.id).select('*'),
          () => ({} as any),
          { onMissing: () => setDbAvailable(false) },
        );
      }
      if (result === 'fail') {
        if (responder === userId) markMissMe(); else markMissOpp();
      }
    }
  };

  const handleValidate = async (decision: 'valid' | 'invalid') => {
    if (!arbiterMode || !currentTurn) return;
    setCurrentTurn({ ...currentTurn, status: decision === 'valid' ? 'validated' : 'failed' });
    channelRef.current?.send({ type: 'broadcast', event: 'turn:validate', payload: { turnId: currentTurn.id, decision } });

    if (isLeader && dbAvailableRef.current) {
      void withTableFallback(
        supabase.from('skate_turns').update({ status: decision === 'valid' ? 'validated' : 'failed' }).eq('id', currentTurn.id).select('*'),
        () => ({} as any),
        { onMissing: () => setDbAvailable(false) },
      );
    }
    if (decision === 'invalid') {
      const responder = currentTurn.proposer === sortedPeers[0] ? sortedPeers[1] : sortedPeers[0];
      if (responder === userId) markMissMe(); else markMissOpp();
    }
  };

  const resetMatch = () => {
    setPhase('idle');
    setMeLetters('');
    setOpponentLetters('');
    setTurnOwner(null);
    setLastClickedBy(null);
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track && s.track.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null as any;
    }
    setPeers([]);
    setRemoteStream(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Game of S.H.R.E.D — Live</h1>
            <p className="text-xs text-gray-400">Salle vidéo en direct, score SHRED, tour en temps réel et chat live</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {roomId && (
            <div className="hidden md:flex items-center gap-2 mr-2 text-xs text-gray-400 bg-dark-800/60 border border-dark-600 rounded-full px-3 py-1.5">
              <span className="truncate max-w-[320px]">Salle: {roomId}</span>
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
          {phase === 'active' && (
            <>
              <button onClick={toggleMute} className="px-3 py-2 rounded-md bg-dark-700 hover:bg-dark-600 text-gray-200 border border-dark-500">
                {muted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={toggleCamera} className="px-3 py-2 rounded-md bg-dark-700 hover:bg-dark-600 text-gray-200 border border-dark-500">
                {cameraOn ? <Camera size={16} /> : <CameraOff size={16} />}
              </button>
            </>
          )}
          {phase !== 'active' ? (
            <button onClick={startCamera} className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white font-medium">
              Activer caméra
            </button>
          ) : (
            <button onClick={resetMatch} className="px-4 py-2 rounded-md bg-dark-700 hover:bg-dark-600 text-gray-200 border border-dark-500">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Bandeau d'état */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B0E13] px-3 py-2 text-sm text-white/80">
        <MessageSquare className="w-4 h-4 text-white/60" />
        Chat & Tour live
        <span className="mx-2 text-white/20">•</span>
        Tour actuel :
        <b className="ml-1">{turnOwner ? (turnOwner === userId ? 'Vous' : 'Adversaire') : '—'}</b>
        <span className="ml-auto inline-flex items-center gap-2 text-xs">
          {rtState === 'subscribed' ? null : <><WifiOff className="w-4 h-4" /> Realtime offline</>}
        </span>
      </div>

      {/* Alerte double-clic */}
      {lastClickedBy && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-200 animate-pulse">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-semibold">
              {lastClickedBy === userId ? 'ATTENTION : Vous avez raté une fois' : "L'adversaire a raté une fois"}
            </div>
            <div className="text-xs text-orange-300/80">
              {lastClickedBy === userId 
                ? "Cliquez encore sur 'Trick raté' pour recevoir une lettre"
                : "Si l'adversaire rate encore, il recevra une lettre"}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Local video */}
        <div className="relative rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full aspect-video object-cover" />
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white backdrop-blur border border-white/20">
            Vous {turnOwner === userId ? '• Au tour' : ''}
          </div>
          {phase !== 'active' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Camera size={36} className="mx-auto text-white/70" />
                <p className="mt-2 text-sm text-white/80">Activez la caméra pour commencer</p>
              </div>
            </div>
          )}
          <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
            <ShredWordLarge
              label="Votre score"
              value={meLetters}
              onClick={handleMyTrickMissed}
              disabled={false}
              hint={
                lastClickedBy === userId
                  ? "⚠️ Cliquez encore pour ajouter une lettre à VOUS"
                  : "Cliquez 1x = passer tour | 2x = lettre pour vous"
              }
            />
          </div>
        </div>

        {/* Remote video */}
        <div className="relative rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full aspect-video object-cover" />
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white/10 text-white backdrop-blur border border-white/20">
            Adversaire {turnOwner && userId && turnOwner !== userId ? '• Au tour' : ''}
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
                  {simulateRemote ? 'Arrêter la simulation' : 'Simuler un flux distant (démo)'}
                </button>
              </div>
            </div>
          )}
          <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
            <ShredWordLarge
              label="Score adversaire"
              value={opponentLetters}
              onClick={handleOpponentTrickMissed}
              disabled={false}
              hint={
                lastClickedBy === myOpponent
                  ? "⚠️ L'adversaire va recevoir une lettre au prochain clic"
                  : "Marquer l'échec de l'adversaire"
              }
            />
          </div>
        </div>
      </div>

      {/* Secondary scoreboards */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="rounded-xl bg-dark-800/60 border border-dark-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/90">Score — Vous</h2>
            <button
              onClick={handleMyTrickMissed}
              disabled={false}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                lastClickedBy === userId
                  ? 'bg-orange-600/20 text-orange-300 border-orange-500/40 animate-pulse'
                  : 'bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30'
              }`}
              title={
                lastClickedBy === userId
                  ? "⚠️ Cliquez encore = lettre pour VOUS"
                  : "Trick raté (1er clic = passe tour, 2e clic = lettre)"
              }
            >
              {lastClickedBy === userId ? '⚠️ Confirmer lettre' : 'Trick raté'}
            </button>
          </div>
          <ShredLetters label="SHRED" value={meLetters} onToggle={setMeLetters} />
        </div>

        <div className="rounded-xl bg-dark-800/60 border border-dark-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/90">Score — Adversaire</h2>
            <button
              onClick={handleOpponentTrickMissed}
              disabled={false}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                lastClickedBy === myOpponent
                  ? 'bg-orange-600/20 text-orange-300 border-orange-500/40 animate-pulse'
                  : 'bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30'
              }`}
              title={
                lastClickedBy === myOpponent
                  ? "⚠️ Prochain clic = lettre pour adversaire"
                  : "Adversaire rate (marquer son échec)"
              }
            >
              {lastClickedBy === myOpponent ? '⚠️ Adversaire rate' : 'Adversaire rate'}
            </button>
          </div>
          <ShredLetters label="SHRED" value={opponentLetters} onToggle={setOpponentLetters} />
        </div>
      </div>

      {/* Turn info + legacy controls */}
      <div className="mt-6 rounded-xl bg-dark-800/60 border border-dark-600 p-4">
        <div className="flex items-center gap-2 text-white/80">
          <TimerReset className="w-4 h-4" />
          <span className="font-semibold">Tour actuel :</span>
          <span className="ml-1">{turnOwner ? (turnOwner === userId ? 'Vous' : 'Adversaire') : '—'}</span>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:gap-4 gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Trick proposé</label>
            <input
              type="text"
              value={trickInput}
              onChange={(e) => setTrickInput(e.target.value)}
              placeholder="Ex: Kickflip"
              className="w-full rounded-md border border-dark-600 bg-[#1f1f29] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Difficulté</label>
            <select
              value={difficultyInput}
              onChange={(e) => setDifficultyInput(Number(e.target.value))}
              className="rounded-md border border-dark-600 bg-[#1f1f29] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              {[1,2,3,4,5].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePropose}
              className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium"
              disabled={!trickInput.trim()}
            >
              Proposer ce trick
            </button>
          </div>
        </div>

        {currentTurn && (
          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-gray-300">
              <span className="text-white font-semibold">Tour #{currentTurn.turn_index + 1}</span>
              <span className="mx-2 text-gray-500">•</span>
              <span>Trick: <span className="text-white">{currentTurn.trick_name}</span></span>
              <span className="mx-2 text-gray-500">•</span>
              <span>Diff: <span className="text-white">{currentTurn.difficulty}</span></span>
              {currentTurn.deadlineAt && (
                <>
                  <span className="mx-2 text-gray-500">•</span>
                  <span>Temps restant: <span className="text-white">{Math.max(0, Math.ceil((currentTurn.deadlineAt - nowMs)/1000))}s</span></span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentTurn.status === 'proposed' && currentTurn.proposer !== (userId ?? '') && (
                <>
                  <button onClick={() => handleRespond('success')} className="px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-sm">Réussi</button>
                  <button onClick={() => handleRespond('fail')} className="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30 text-sm">Raté</button>
                </>
              )}
              {arbiterMode && currentTurn.status === 'responded' && (
                <>
                  <button onClick={() => handleValidate('valid')} className="px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-sm">Valider</button>
                  <button onClick={() => handleValidate('invalid')} className="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30 text-sm">Invalider</button>
                </>
              )}
              {!arbiterMode && currentTurn.status === 'responded' && (
                <span className="text-xs text-gray-400">En attente de l&apos;arbitre…</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat live */}
      <div className="mt-6 rounded-xl bg-dark-800/60 border border-dark-600">
        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-white/80">
          <MessageSquare className="w-4 h-4" /> Chat (live)
        </div>
        <div className="h-64 overflow-y-auto px-4 py-3 space-y-2">
          {chatMsgs.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-white/40 mr-2">{new Date(m.ts).toLocaleTimeString()}</span>
              <span className="font-medium">{m.from === userId ? 'Vous' : 'Adversaire'}</span>
              <span className="mx-2 text-white/40">•</span>
              <span className="text-white/90">{m.text}</span>
            </div>
          ))}
          {chatMsgs.length === 0 && <div className="text-white/40 text-sm">Aucun message pour l'instant.</div>}
        </div>
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e)=> e.key === 'Enter' && sendChat()}
            placeholder="Écris un message…"
            className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
          />
          <button onClick={sendChat} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-black">
            <Send className="w-4 h-4" /> Envoyer
          </button>
        </div>
      </div>

      {/* Match finished banner */}
      {phase === 'finished' && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {meLost ? <XCircle className="text-red-400" /> : <Trophy className="text-emerald-400" />}
            <div>
              <div className="text-white font-semibold">
                {meLost && oppLost ? 'Match terminé' : meLost ? 'Défaite' : 'Victoire'}
              </div>
              <div className="text-sm text-gray-300">Gagnant: {winnerLabel} · +50 XP</div>
            </div>
          </div>
          <button onClick={resetMatch} className="text-sm px-3 py-1.5 rounded-md bg-dark-700 hover:bg-dark-600 text-gray-200 border border-dark-500">
            Nouvelle partie
          </button>
        </div>
      )}
    </div>
  );
}

async function awardExperience(points: number) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;
    const tryProfiles = await supabase.from('profiles').update({ total_xp: (undefined as unknown) as number }).eq('id', userId);
    if (tryProfiles.error) {
      await supabase.rpc('award_xp', { user_id: userId, delta_xp: points });
      return;
    }
    const { data, error } = await supabase.from('profiles').select('total_xp').eq('id', userId).maybeSingle();
    if (error || !data || typeof data.total_xp !== 'number') return;
    await supabase.from('profiles').update({ total_xp: data.total_xp + points }).eq('id', userId);
  } catch { /* optional */ }
}

// Signaling + P2P helpers
function initSignaling(
  args: {
    roomId: string;
    userId: string;
    localStreamGetter: () => MediaStream | null;
    onRemoteStream: (ms: MediaStream | null) => void;
    onPeersChange: (peers: string[]) => void;
    onLettersRemote: (senderId: string, letters: string) => void;
  }
) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const channel = supabase.channel(`skate-live-${args.roomId}`, { config: { presence: { key: args.userId } } });

  const ensureRemoteStream = () => {
    const ms = new MediaStream();
    pc.getReceivers().forEach((r) => { if (r.track) ms.addTrack(r.track); });
    if (ms.getTracks().length > 0) args.onRemoteStream(ms);
  };

  pc.ontrack = () => ensureRemoteStream();
  pc.onicecandidate = (ev) => {
    if (ev.candidate) channel.send({ type: 'broadcast', event: 'ice', payload: { from: args.userId, candidate: ev.candidate } });
  };

  const maybeAttachLocalTracks = () => {
    const ls = args.localStreamGetter();
    if (ls) {
      const existing = pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[];
      ls.getTracks().forEach((t) => { if (!existing.includes(t)) pc.addTrack(t, ls); });
    }
  };

  const makeOffer = async () => {
    await maybeAttachLocalTracks();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channel.send({ type: 'broadcast', event: 'offer', payload: { from: args.userId, sdp: offer } });
  };
  const makeAnswer = async () => {
    await maybeAttachLocalTracks();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    channel.send({ type: 'broadcast', event: 'answer', payload: { from: args.userId, sdp: answer } });
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const ids = Object.keys(state);
      args.onPeersChange(ids);
      const isInitiator = ids.length >= 2 && ids.sort()[0] === args.userId;
      if (isInitiator && pc.signalingState === 'stable') void makeOffer();
    })
    .on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (!payload?.sdp || payload.from === args.userId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      await makeAnswer();
    })
    .on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (!payload?.sdp || payload.from === args.userId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    })
    .on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (!payload?.candidate || payload.from === args.userId) return;
      try { await pc.addIceCandidate(payload.candidate); } catch {}
    })
    .on('broadcast', { event: 'letters' }, ({ payload }) => {
      if (!payload?.letters || !payload?.from) return;
      args.onLettersRemote(payload.from, String(payload.letters));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ user_id: args.userId, ts: Date.now() });
    });

  return { pc, channel } as const;
}
