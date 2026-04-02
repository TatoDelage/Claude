"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import Scoreboard from "@/components/Scoreboard";
import RoundTracker from "@/components/RoundTracker";
import WildcardsPanel from "@/components/WildcardsPanel";

const ROUND_ROUTES: Record<number, string> = {
  1: "/round1",
};

const ROUND_LABELS: Record<number, string> = {
  1: "Jugar Ronda 1 →",
  2: "Jugar Ronda 2 →",
  3: "Jugar Ronda 3 →",
  4: "Jugar Ronda 4 →",
  5: "Jugar Ronda 5 →",
};

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
  const activeRoute = activeRound ? ROUND_ROUTES[activeRound.number] : null;

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
        {/* Play active round CTA */}
        {activeRound && (
          <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-widest">En curso</p>
              <p className="font-black text-white truncate">
                Ronda {activeRound.number} — {activeRound.name}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{activeRound.shortDesc}</p>
            </div>
            {activeRoute ? (
              <button
                onClick={() => router.push(activeRoute)}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 active:scale-95 text-white text-sm font-bold transition-all"
              >
                {ROUND_LABELS[activeRound.number]}
              </button>
            ) : (
              <span className="flex-shrink-0 text-xs text-zinc-600 italic">Próximamente</span>
            )}
          </div>
        )}

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
