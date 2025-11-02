import { useEffect, useRef, useState } from 'react';

export function useCountdown(targetIso: string | null): { secondsLeft: number; expired: boolean } {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!targetIso) { setSecondsLeft(0); return; }
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const leftMs = Math.max(0, target - Date.now());
      setSecondsLeft(Math.floor(leftMs / 1000));
      if (leftMs <= 0 && ref.current) { clearInterval(ref.current); ref.current = null; }
    };
    tick();
    ref.current = window.setInterval(tick, 1000) as unknown as number;
    return () => { if (ref.current) { clearInterval(ref.current); ref.current = null; } };
  }, [targetIso]);

  return { secondsLeft, expired: secondsLeft <= 0 && !!targetIso };
}

export function useRealtimeChannel(channelName: string, onMessage: (payload: any) => void) {
  useEffect(() => {
    // Placeholder: wire to supabase realtime channel in future
    return () => {};
  }, [channelName, onMessage]);
}

