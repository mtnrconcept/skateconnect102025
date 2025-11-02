import { useMemo } from "react";
import GameOfSkateSelfRef from "@/components/skate/GameOfSkateSelfRef";
import { useRouter } from "@/lib/router";

function MissingParamsNotice() {
  const exampleUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/skate/live?match=GOS_MATCH_ID&me=USER_ID`
      : "/skate/live?match=GOS_MATCH_ID&me=USER_ID";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070b] px-4 py-12 text-white">
      <div className="max-w-xl rounded-3xl border border-white/10 bg-[#10141d]/90 p-8 shadow-[0_20px_45px_rgba(5,7,11,0.6)]">
        <h1 className="text-2xl font-semibold tracking-[0.2em] text-white/80">
          Game of S.K.A.T.E — configuration requise
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          Renseigne l&apos;identifiant du match et le rider connecté via les paramètres d&apos;URL pour
          afficher l&apos;interface en temps réel. Exemple&nbsp;:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/50 px-4 py-3 text-sm text-orange-200">
{exampleUrl}
        </pre>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <span className="font-semibold text-white">match</span> — identifiant d&apos;une ligne dans
            <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white">gos_match</code>
          </li>
          <li>
            <span className="font-semibold text-white">me</span> — identifiant Supabase du rider en
            cours (rider_a ou rider_b)
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function GameOfSkateRoom() {
  const { location } = useRouter();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const matchId = params.get("match");
  const me = params.get("me");

  if (!matchId || !me) {
    return <MissingParamsNotice />;
  }

  return <GameOfSkateSelfRef matchId={matchId} me={me} />;
}
