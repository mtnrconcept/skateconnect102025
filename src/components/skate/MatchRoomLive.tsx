import { useEffect, useMemo, useState } from "react";
import type { Profile } from "../../types";
import { supabase } from "../../lib/supabase.js";
import GameOfSkateSelfRef from "./GameOfSkateSelfRef";
import { createGOSMatch } from "../../lib/skate";

interface MatchRoomLiveProps {
  matchId: string; // id de skate_matches (room/lobby)
  profile?: Profile | null;
}

const getDisplayName = (user?: Profile | null) =>
  user?.display_name || user?.username || "Rider";

export default function MatchRoomLive({ matchId, profile }: MatchRoomLiveProps) {
  const [gosMatchId, setGosMatchId] = useState<string | null>(null);
  const [playerAProfile, setPlayerAProfile] = useState<Profile | null>(null);
  const [playerBProfile, setPlayerBProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Charger le match “source” (skate_matches)
        const { data: skateMatch, error: skateError } = await supabase
          .from("skate_matches")
          .select("*") // PAS de colonnes optionnelles ici
          .eq("id", matchId)
          .single();

        if (skateError) throw skateError;
        if (!skateMatch || !mounted) return;

        const { player_a, player_b } = skateMatch as {
          player_a: string;
          player_b: string;
        };

        // 2) Profils A/B
        const [{ data: profileA }, { data: profileB }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", player_a).single(),
          supabase.from("profiles").select("*").eq("id", player_b).single(),
        ]);

        if (!mounted) return;
        setPlayerAProfile((profileA as Profile) || null);
        setPlayerBProfile((profileB as Profile) || null);

        // 3) Créer systématiquement un nouveau match "Game of SKATE" pour cette salle.
        // La logique de réutilisation des anciennes parties est supprimée.
        // Assurons-nous que l'utilisateur actuel est bien le joueur A (l'invitant)
        const inviterId = profile?.id;
        const invitedId = inviterId === player_a ? player_b : player_a;
        const inviterProfile = inviterId === player_a ? profileA : profileB;
        
        // Ajout d'une garde de sécurité pour s'assurer que l'invitant est bien défini.
        if (!inviterId) {
          throw new Error("L'ID de l'utilisateur actuel (invitant) est manquant. Impossible de créer le match.");
        }

        const created = await createGOSMatch(inviterId, invitedId, {
          inviterName: getDisplayName(inviterProfile as Profile | null),
        });

        const gosId = created.id;

        if (!gosId) throw new Error("Match live introuvable");
        if (mounted) setGosMatchId(gosId);
      } catch (err) {
        if (mounted) {
          console.error("[MatchRoomLive] load error", err);
          setError("Impossible de charger la salle Game of SKATE.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [matchId]);

  const riderAName = useMemo(() => getDisplayName(playerAProfile), [playerAProfile]);
  const riderBName = useMemo(() => getDisplayName(playerBProfile), [playerBProfile]);

  if (!profile) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#121214] p-8 text-sm text-white/60">
        Profil requis pour rejoindre la salle live.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#121214] p-8 text-sm text-white/60">
        Préparation de la salle…
      </div>
    );
  }

  if (error || !gosMatchId) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-sm text-red-200">
        {error ?? "Impossible d'initialiser le match."}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0E0E11] pb-24 text-white">
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-[#2D2D33] bg-black/90 px-8 backdrop-blur">
        <span className="text-lg font-bold uppercase tracking-[0.3em] text-[#FF8C1A]">{riderAName}</span>
        <span className="text-xs uppercase tracking-[0.5em] text-white/30">Game Of S.K.A.T.E</span>
        <span className="text-lg font-bold uppercase tracking-[0.3em] text-[#FF8C1A]">{riderBName}</span>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-28">
        <GameOfSkateSelfRef
          matchId={gosMatchId}
          me={profile.id}
          riderAName={riderAName}
          riderBName={riderBName}
        />
      </main>
    </div>
  );
}
