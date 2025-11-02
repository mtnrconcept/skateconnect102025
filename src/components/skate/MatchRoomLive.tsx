import { useEffect, useState } from 'react';
import { Video, Play } from 'lucide-react';
import type { Profile } from '../../types';
import { supabase } from '../../lib/supabase.js';
// CORRECTION: Ajout des accolades {} pour un import nommé
import { GameOfSkateSelfRef } from './GameOfSkateSelfRef'; 
import CountdownAnimation from './CountdownAnimation'; // Celui-ci est déjà correct (default)

interface MatchRoomLiveProps {
  matchId: string;
  profile?: Profile | null;
}

export default function MatchRoomLive({ matchId, profile }: MatchRoomLiveProps) {
  const [gosMatch, setGosMatch] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showCountdown, setShowCountdown] = useState(true);
  const [playerAProfile, setPlayerAProfile] = useState<Profile | null>(null);
  const [playerBProfile, setPlayerBProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Load or create GOS match from skate_match
      const { data: skateMatch } = await supabase.from('skate_matches').select('*').eq('id', matchId).single();
      
      if (mounted && skateMatch) {
        // ... (logique pour trouver/créer le match GOS) ...
        // (le reste de votre logique est inchangé)
        
        // Simule un ID de match pour l'exemple
        const gosMatchId = skateMatch.id; // Utilisez la logique appropriée

        if (gosMatchId) {
          const { data: gos } = await supabase.from('gos_match').select('*').eq('id', gosMatchId).single();
          if (mounted && gos) setGosMatch(gos);
        }

        // Load profiles
        const { data: profileA } = await supabase.from('profiles').select('*').eq('id', skateMatch.player_a).single();
        const { data: profileB } = await supabase.from('profiles').select('*').eq('id', skateMatch.player_b).single();
        if (mounted) {
          setPlayerAProfile((profileA as any) || null);
          setPlayerBProfile((profileB as any) || null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [matchId]);

  const handleCountdownComplete = () => {
    setShowCountdown(false);
  };

  if (!profile) {
     return <div className="text-gray-400">Chargement du profil…</div>;
  }
  
  // Utiliser un ID de match bidon si gosMatch n'est pas chargé, 
  // mais vous devriez avoir un meilleur état de chargement
  const effectiveMatchId = gosMatch?.id || matchId; 

  return (
    <>
      {showCountdown && <CountdownAnimation onComplete={handleCountdownComplete} />}
      <div className="space-y-6">
        {/* Game of Skate Self-Ref */}
        <GameOfSkateSelfRef matchId={effectiveMatchId} me={profile.id} />

        {/* Blocs vidéo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-black rounded-lg border border-dark-700 aspect-video flex items-center justify-center text-white/60">
            {isStreaming ? <Video className="text-orange-400" size={32} /> : 'Vidéo Rider A'}
          </div>
          <div className="bg-black rounded-lg border border-dark-700 aspect-video flex items-center justify-center text-white/60">
            {isStreaming ? <Video className="text-orange-400" size={32} /> : 'Vidéo Rider B'}
          </div>
        </div>

        {/* Bouton stream */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 ${
              isStreaming
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            <Play size={24} />
            {isStreaming ? 'ARRÊTER LE STREAM' : 'LANCER LE STREAM'}
          </button>
        </div>
      </div>
    </>
  );
}
