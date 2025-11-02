import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Match, MatchState } from '@/types'; // Assurez-vous que vos types sont corrects
import { CountdownAnimation } from './CountdownAnimation';

// Type pour la mutation
type CreateTurnPayload = {
  match_id: string;
  trick_id?: string;
  outcome: 'landed' | 'missed';
};

export const GameOfSkateSelfRef = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const queryClient = useQueryClient();
  const [isCountdown, setIsCountdown] = useState(false);
  const [isTurnActive, setIsTurnActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- OBTENIR L'UTILISATEUR ACTUEL ---
  const { data: sessionData } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data;
    }
  });
  const userId = sessionData?.session?.user.id;

  // --- REQUÊTE POUR LES INFOS DU MATCH (state) ---
  // C'est cette requête qui sera rafraîchie en temps réel
  const { data: matchState, isLoading: isLoadingMatchState } = useQuery({
    queryKey: ['matchState', matchId],
    queryFn: async () => {
      if (!matchId) return null;
      // Nous chargeons l'état du match, qui contient les lettres et le joueur actuel
      const { data, error } = await supabase
        .from('gos_match_state')
        .select('*')
        .eq('match_id', matchId)
        .single();
      if (error) throw new Error(error.message);
      return data as MatchState;
    },
    enabled: !!matchId, // Ne pas exécuter si matchId n'est pas défini
  });

  // --- NOUVEAU: ABONNEMENT REALTIME ---
  useEffect(() => {
    if (!matchId) return;

    // S'abonner aux changements sur la table gos_match_state
    const channel = supabase
      .channel(`realtime:match_state:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gos_match_state',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          console.log('Realtime update received!', payload);
          
          // Forcer react-query à recharger les données de l'état du match
          // Cela mettra à jour l'interface pour *les deux* joueurs.
          queryClient.invalidateQueries({ queryKey: ['matchState', matchId] });

          // Réinitialiser l'interface locale (arrêter le timer, etc.)
          setIsTurnActive(false);
          setIsCountdown(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to match state ${matchId}`);
        }
        if (err) {
          console.error('Realtime subscription error:', err);
        }
      });

    // Nettoyage : se désabonner lors du démontage du composant
    return () => {
      console.log(`Unsubscribing from match state ${matchId}`);
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);
  // ------------------------------------

  // Mutation pour créer un tour
  const { mutate: createTurn, isPending: isSubmittingTurn } = useMutation({
    mutationFn: async (payload: CreateTurnPayload) => {
      const { data, error } = await supabase.functions.invoke('skate-turns-create', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalider la requête n'est même plus nécessaire ici,
      // car le backend va changer la BDD, ce qui va déclencher
      // l'abonnement Realtime pour tout le monde (y compris nous).
      // queryClient.invalidateQueries({ queryKey: ['matchState', matchId] });
    },
    onError: (error) => {
      console.error('Failed to create turn:', error);
      // Réactiver les boutons si la soumission échoue
      setIsTurnActive(true);
    }
  });

  const onCountdownComplete = () => {
    setIsCountdown(false);
    setIsTurnActive(true);
    setTimeLeft(30);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

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
    if (!isTurnActive || isSubmittingTurn) return; // Protection clics multiples
    
    setIsTurnActive(false); // Désactiver le tour
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (matchId) {
      createTurn({
        match_id: matchId,
        outcome: outcome,
      });
    }
  };

  if (isLoadingMatchState) {
    return <div>Chargement du match...</div>;
  }

  if (!matchState) {
    return <div>Erreur: Match non trouvé.</div>;
  }

  // Déterminer si c'est mon tour
  const isMyTurn = matchState.current_player_id === userId;
  const matchEnded = matchState.status === 'completed';

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Game of S.K.A.T.E.</h1>
      
      {/* --- AFFICHAGE DES LETTRES (mis à jour en temps réel) --- */}
      <div className="flex justify-around mb-4 text-2xl">
        <div>
          <span className="font-bold">Joueur 1: </span>
          <span className="font-bold text-red-500 tracking-widest">
            {matchState.player_1_letters}
          </span>
        </div>
        <div>
          <span className="font-bold">Joueur 2: </span>
          <span className="font-bold text-red-500 tracking-widest">
            {matchState.player_2_letters}
          </span>
        </div>
      </div>

      {isCountdown && <CountdownAnimation onComplete={onCountdownComplete} />}

      {isTurnActive && (
        <div className="mt-4">
          <div className="text-5xl font-bold text-white mb-6">
            {timeLeft}s
          </div>
          <p className="text-lg mb-4">À vous !</p>
          <button 
            onClick={() => handleTrickOutcome('landed')}
            disabled={!isTurnActive || isSubmittingTurn}
            className="btn btn-success btn-lg mr-4"
          >
            Trick Landed
          </button>
          <button 
            onClick={() => handleTrickOutcome('missed')}
            disabled={!isTurnActive || isSubmittingTurn}
            className="btn btn-error btn-lg"
          >
            Trick Raté
          </button>
        </div>
      )}

      {/* --- GESTION DE L'ÉTAT DU JEU --- */}
      {!matchEnded && !isCountdown && !isTurnActive && (
        <div className="mt-8">
          {isMyTurn ? (
            <button 
              onClick={() => setIsCountdown(true)} // Démarrer le compte à rebours
              className="btn btn-primary btn-lg"
            >
              Démarrer mon tour
            </button>
          ) : (
            <p className="text-lg text-gray-400">
              En attente du tour de l'adversaire...
            </p>
          )}
        </div>
      )}

      {matchEnded && (
        <div className="mt-8">
          <h2 className="text-3xl font-bold text-green-500">Partie terminée !</h2>
          <p className="text-xl">
            {/* Vous devrez déterminer le gagnant en fonction des lettres */}
            Le gagnant est {matchState.winner_id === userId ? 'vous' : 'l\'adversaire'} !
          </p>
        </div>
      )}
    </div>
  );
};
