"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import Scoreboard from "@/components/Scoreboard";
import RoundTracker from "@/components/RoundTracker";
import WildcardsPanel from "@/components/WildcardsPanel";

export default function GamePage() {
  const router = useRouter();
  const { game, resetGame } = useGame();

  useEffect(() => {
    if (!game) router.replace("/");
  }, [game, router]);

  if (!game) return null;

  const handleReset = () => {
    if (confirm("¿Seguro que quieres terminar la partida y volver al inicio?")) {
      resetGame();
      router.replace("/");
    }
  };

  const activeRound = game.rounds.find((r) => r.status === "active");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-black text-violet-400">🎵 Adivina la Canción</span>
          {activeRound && (
            <span className="ml-3 text-xs text-zinc-500">
              Ronda {activeRound.number} — {activeRound.name}
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Terminar
        </button>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Scoreboard */}
        <Scoreboard teams={game.teams} />

        {/* Divider */}
        <div className="border-t border-zinc-800/60" />

        {/* Round tracker */}
        <RoundTracker rounds={game.rounds} />

        {/* Divider */}
        <div className="border-t border-zinc-800/60" />

        {/* Wildcards */}
        <WildcardsPanel teams={game.teams} />

        {/* Bottom padding */}
        <div className="h-6" />
      </div>
    </main>
  );
}
