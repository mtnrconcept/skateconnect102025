import React, { useState, useEffect, useRef } from 'react'; // Importation de useEffect et useRef
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Match, MatchState } from '@/types'; // Assurez-vous que vos types sont corrects
import { CountdownAnimation } from './CountdownAnimation';
import { getMatchState } from '@/lib/skate'; // Supposant que cette fonction existe

// Type pour la mutation, ajustez au besoin
type CreateTurnPayload = {
  match_id: string;
  trick_id?: string; // L'ID du trick, si applicable
  outcome: 'landed' | 'missed';
};

export const GameOfSkateSelfRef = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const queryClient = useQueryClient();
  
  const [match, setMatch] = useState<Match | null>(null); // Devrait être chargé via useQuery
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [isCountdown, setIsCountdown] = useState(false);
  const [isTurnActive, setIsTurnActive] = useState(false);
  
  // --- NOUVEAUX ÉTATS POUR LE CHRONOMÈTRE ---
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // ----------------------------------------

  // Fetch match data
  const { data: matchData, isLoading: isLoadingMatch } = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      if (!matchId) return null;
      const { data, error } = await supabase
        .from('gos_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      if (error) throw error;
      setMatch(data);
      // Simuler l'état du match (vous devriez le charger)
      // setMatchState(getMatchState(data)); 
      return data;
    },
  });

  // Mutation pour créer un tour
  const { mutate: createTurn } = useMutation({
    mutationFn: async (payload: CreateTurnPayload) => {
      const { data, error } = await supabase.functions.invoke('skate-turns-create', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Rafraîchir l'état du match après la soumission
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['matchState', matchId] });
    },
    onError: (error) => {
      console.error('Failed to create turn:', error);
      // Réactiver les boutons si la soumission échoue ?
      setIsTurnActive(true); 
    }
  });

  // --- NETTOYAGE DU CHRONOMÈTRE ---
  useEffect(() => {
    // Nettoyer le timer lors du démontage du composant
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  // --------------------------------

  const handleStartTurn = () => {
    // Logique pour vérifier si c'est bien le tour du joueur
    setIsCountdown(true);
  };

  const onCountdownComplete = () => {
    setIsCountdown(false);
    setIsTurnActive(true);
    setTimeLeft(30); // Réinitialiser le chronomètre

    // Effacer l'ancien timer s'il existe
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // --- DÉMARRER LE NOUVEAU CHRONOMÈTRE ---
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current!);
          // Le temps est écoulé ! Compte comme un échec.
          handleTrickOutcome('missed'); 
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const handleTrickOutcome = (outcome: 'landed' | 'missed') => {
    // --- PROTÉGER CONTRE LES CLICS MULTIPLES ---
    if (!isTurnActive) return; 
    
    setIsTurnActive(false); // Désactiver le tour
    
    // --- ARRÊTER LE CHRONOMÈTRE ---
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    console.log(`Outcome reported: ${outcome}`);
    
    // Envoyer le résultat au backend
    if (matchId) {
      createTurn({
        match_id: matchId,
        // trick_id: "current_trick_id", // Vous devez gérer la sélection du trick
        outcome: outcome,
      });
    }
  };

  if (isLoadingMatch) {
    return <div>Loading match...</div>;
  }

  // TODO: Afficher l'état du match (lettres S.K.A.T.E., qui est le setter, etc.)
  // const { player1Letters, player2Letters, currentSetter } = matchState || {};

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Game of S.K.A.T.E.</h1>
      
      {/* Affichage des scores (lettres) */}
      <div className="flex justify-around mb-4">
        <div>
          <span className="font-bold">Player 1: </span>
          {/* {player1Letters.join('')} */}
        </div>
        <div>
          <span className="font-bold">Player 2: </span>
          {/* {player2Letters.join('')} */}
        </div>
      </div>

      {isCountdown && <CountdownAnimation onComplete={onCountdownComplete} />}

      {isTurnActive && (
        <div className="mt-4">
          {/* --- AFFICHAGE DU CHRONOMÈTRE --- */}
          <div className="text-5xl font-bold text-white mb-6">
            {timeLeft}s
          </div>
          
          <p className="text-lg mb-4">C'est votre tour !</p>
          <button 
            onClick={() => handleTrickOutcome('landed')}
            disabled={!isTurnActive}
            className="btn btn-success btn-lg mr-4"
          >
            Trick Landed
          </button>
          <button 
            onClick={() => handleTrickOutcome('missed')}
            disabled={!isTurnActive}
            className="btn btn-error btn-lg"
          >
            Trick Raté
          </button>
        </div>
      )}

      {/* Bouton pour démarrer le tour (à n'afficher que si c'est le tour du joueur) */}
      {!isCountdown && !isTurnActive && (
        <button 
          onClick={handleStartTurn}
          className="btn btn-primary btn-lg mt-4"
          // disabled={!isMyTurn} // Ajouter la logique pour vérifier si c'est mon tour
        >
          Démarrer mon tour
        </button>
      )}

      {/* ... Reste de l'interface (chat, infos, etc.) ... */}
    </div>
  );
};
