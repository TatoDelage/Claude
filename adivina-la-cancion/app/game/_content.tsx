"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import Scoreboard from "@/components/Scoreboard";
import RoundTracker from "@/components/RoundTracker";
import WildcardModal from "@/components/WildcardModal";

const ROUND_ROUTES: Record<number, string> = {
  1: "/round1",
  2: "/round2",
  3: "/round3",
};

const ROUND_LABELS: Record<number, string> = {
  1: "Jugar Ronda 1 →",
  2: "Jugar Ronda 2 →",
  3: "Jugar Ronda 3 →",
  4: "Jugar Ronda 4 →",
  5: "Jugar Ronda 5 →",
};

const DEV_KEY = "adivina_dev";

export default function GameContent() {
  const router = useRouter();
  const { game, hydrated, resetGame, setGame } = useGame();
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DEV_KEY) === "1"
  );

  useEffect(() => {
    if (hydrated && !game) router.replace("/");
  }, [hydrated, game, router]);

  if (!hydrated || !game) return null;

  const handleReset = () => {
    if (confirm("¿Seguro que quieres terminar la partida y volver al inicio?")) {
      resetGame();
      router.replace("/");
    }
  };

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem(DEV_KEY, next ? "1" : "0");
  };

  // In dev mode: set the target round as active and navigate directly.
  const jumpToRound = (roundNumber: number) => {
    const roundStatus = (n: number): RoundStatus =>
      n < roundNumber ? "completed" : n === roundNumber ? "active" : "pending";
    const updated: GameState = {
      ...game,
      currentRound: roundNumber,
      rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })),
    };
    setGame(updated);
    router.push(ROUND_ROUTES[roundNumber]);
  };

  const activeRound = game.rounds.find((r) => r.status === "active");
  const activeRoute = activeRound ? ROUND_ROUTES[activeRound.number] : null;

  return (
    <main className="min-h-screen bg-canvas-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-canvas-950/90 backdrop-blur border-b border-canvas-700/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">🎵 Adivina la Canción</span>
          {activeRound && (
            <span className="ml-1 text-xs text-zinc-500">
              Ronda {activeRound.number} — {activeRound.name}
            </span>
          )}
          {devMode && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wide">
              DEV
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDevMode}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
              devMode
                ? "text-amber-400 hover:text-amber-300"
                : "text-zinc-700 hover:text-zinc-500"
            }`}
          >
            {devMode ? "⚙ dev on" : "⚙ dev"}
          </button>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Terminar
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Play active round CTA */}
        {activeRound && (
          <div className="bg-canvas-900 border border-zinc-700/60 rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
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
                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 text-sm font-bold transition-all"
              >
                {ROUND_LABELS[activeRound.number]}
              </button>
            ) : (
              <span className="flex-shrink-0 text-xs text-zinc-600 italic">Próximamente</span>
            )}
          </div>
        )}

        {/* Dev mode jump panel */}
        {devMode && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-4 py-3 space-y-2">
            <p className="text-xs font-bold text-amber-400/70 uppercase tracking-widest">
              Saltar a ronda (dev)
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROUND_ROUTES).map(([num, route]) => {
                const n = Number(num);
                const round = game.rounds.find((r) => r.number === n);
                const isCurrent = game.currentRound === n;
                return (
                  <button
                    key={n}
                    onClick={() => jumpToRound(n)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isCurrent
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        : "bg-canvas-800 text-zinc-400 hover:bg-canvas-700 hover:text-zinc-200"
                    }`}
                  >
                    R{n} — {round?.name ?? route}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scoreboard */}
        <Scoreboard
          teams={game.teams}
          onWildcard={(teamId) => setWildcardTeamId(teamId)}
        />

        <div className="border-t border-canvas-700/60" />

        <RoundTracker rounds={game.rounds} />

        <div className="h-6" />
      </div>

      {/* Wildcard modal */}
      {wildcardTeamId && (() => {
        const wildcardTeam = game.teams.find((t) => t.id === wildcardTeamId);
        return wildcardTeam ? (
          <WildcardModal
            team={wildcardTeam}
            allTeams={game.teams}
            onClose={() => setWildcardTeamId(null)}
            onUsed={() => setWildcardTeamId(null)}
          />
        ) : null;
      })()}
    </main>
  );
}
