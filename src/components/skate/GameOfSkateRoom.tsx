import GameOfSkateLiveMock from "@/components/skate/GameOfSkateLiveMock";

export default function GameOfSkateRoom() {
  // Aperçu front-end seul, pas de Supabase ici
  return (
    <div className="p-4">
      <GameOfSkateLiveMock />
    </div>
  );
}
