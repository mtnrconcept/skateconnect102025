import { useEffect, useMemo, useState } from "react";
import GameOfSkateSelfRef from "@/components/skate/GameOfSkateSelfRef";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "@/lib/router";

function FullscreenNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10141d]/90 p-8 text-center shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
        <h1 className="text-2xl font-semibold tracking-[0.2em] text-white/80">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{message}</p>
      </div>
    </div>
  );
}

export default function LiveSkateRoom() {
  const { location } = useRouter();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const matchId = searchParams.get("room") ?? searchParams.get("match") ?? "";

  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: sessionError } = await supabase.auth.getUser();
      if (cancelled) {
        return;
      }
      if (sessionError) {
        setError("Impossible de récupérer ta session Supabase.");
      } else {
        setMe(data.user?.id ?? null);
        if (!data.user?.id) {
          setError("Connecte-toi pour rejoindre le match.");
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!matchId) {
    return (
      <FullscreenNotice
        title="Salle introuvable"
        message="Le paramètre de match est manquant. Utilise un lien d'invitation valide pour rejoindre une salle Game of S.K.A.T.E."
      />
    );
  }

  if (loading) {
    return (
      <FullscreenNotice
        title="Connexion"
        message="Préparation de ta session Game of S.K.A.T.E…"
      />
    );
  }

  if (error || !me) {
    return (
      <FullscreenNotice
        title="Accès refusé"
        message={error ?? "Impossible d'identifier ton profil Supabase."}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#05070b]">
      <GameOfSkateSelfRef matchId={matchId} me={me} />
    </div>
  );
}
