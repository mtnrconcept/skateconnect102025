import { useEffect, useState } from 'react';
import type { Profile } from '../../types';
import { supabase } from '../../lib/supabase.js';

interface LobbyProps {
  currentUserId?: string | null;
  onCreateMatch: (opponentId: string, mode: 'live' | 'remote') => void;
}

export default function Lobby({ currentUserId, onCreateMatch }: LobbyProps) {
  const [riders, setRiders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').limit(20);
        if (error) throw error;
        if (mounted) setRiders((data as any) || []);
      } catch {
        if (mounted) setRiders([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="text-gray-400">Chargement du lobby...</div>;
  }

  return (
    <div className="space-y-3">
      {riders.filter(r => r.id !== currentUserId).map((r) => (
        <div key={r.id} className="flex items-center justify-between bg-dark-800 border border-dark-700 rounded-lg p-3">
          <div>
            <div className="text-white font-semibold">{r.display_name || r.username || r.id}</div>
            <div className="text-xs text-gray-400">{r.country || '—'}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-600 text-white" onClick={() => onCreateMatch(r.id, 'live')}>Défier (Live)</button>
            <button className="px-3 py-1.5 rounded border border-dark-600 text-white hover:bg-dark-700" onClick={() => onCreateMatch(r.id, 'remote')}>Défier (Remote)</button>
          </div>
        </div>
      ))}
      {riders.length === 0 && (
        <div className="text-gray-400">Aucun rider disponible pour le moment.</div>
      )}
    </div>
  );
}

