"use client";

import { Team } from "@/lib/types";
import { Round5Result, POINTS_WIN } from "@/lib/round5";

const TEAM_ACCENT: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
};

const TEAM_TEXT: Record<string, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
};

export default function Results({
  result,
  teams,
  onContinue,
}: {
  result: Round5Result;
  teams: Team[];
  onContinue: () => void;
}) {
  const isTie = result.winningTeamIds.length === 0;
  const winnerTeam = !isTie ? teams.find((t) => t.id === result.winningTeamIds[0]) : null;
  const maxCorrect = Math.max(0, ...Object.values(result.correctByTeam));

  // Sort teams by correct count desc
  const sortedTeams = [...teams].sort(
    (a, b) => (result.correctByTeam[b.id] ?? 0) - (result.correctByTeam[a.id] ?? 0)
  );

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 5 completada
        </p>
        <h1 className="text-3xl font-black">Resultados</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {result.playerResults.length} jugadores · {result.playerResults.reduce((s, r) => s + r.correct, 0)} aciertos totales
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
        {/* Win/tie announcement */}
        <div className={`p-4 rounded-2xl text-center border ${
          isTie
            ? "bg-canvas-900 border-canvas-700"
            : `${TEAM_ACCENT[winnerTeam?.color ?? "violet"]} border-transparent`
        }`}>
          {isTie ? (
            <>
              <p className="text-2xl mb-1">🤝</p>
              <p className="font-black text-white text-xl">Empate — sin puntos extra</p>
              <p className="text-zinc-400 text-sm mt-1">Todos los equipos con {maxCorrect} aciertos</p>
            </>
          ) : (
            <>
              <p className="text-2xl mb-1">🏆</p>
              <p className="font-black text-white text-xl">{winnerTeam?.name} gana la ronda</p>
              <p className="text-white/70 text-sm mt-1">+{POINTS_WIN} pts</p>
            </>
          )}
        </div>

        {/* Team scores */}
        <section
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 2)}, 1fr)` }}
        >
          {sortedTeams.map((team) => {
            const correct = result.correctByTeam[team.id] ?? 0;
            const isWinner = result.winningTeamIds.includes(team.id);
            return (
              <div
                key={team.id}
                className={`rounded-2xl p-4 text-center border ${
                  isWinner
                    ? `${TEAM_ACCENT[team.color]} border-transparent`
                    : "bg-canvas-900 border-canvas-700"
                }`}
              >
                {isWinner && <p className="text-xs font-bold text-white/80 mb-1">👑 Ganador</p>}
                <p className={`text-xs font-bold uppercase tracking-wide truncate ${isWinner ? "text-white/80" : TEAM_TEXT[team.color]}`}>
                  {team.name}
                </p>
                <p className="text-4xl font-black mt-1">
                  {correct}
                </p>
                <p className={`text-xs mt-0.5 ${isWinner ? "text-white/60" : "text-zinc-500"}`}>
                  aciertos
                </p>
                {isWinner && (
                  <p className="text-sm font-black text-white/90 mt-1">+{POINTS_WIN} pts</p>
                )}
              </div>
            );
          })}
        </section>

        {/* Per-player breakdown */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-canvas-700">
            <p className="text-sm font-bold text-zinc-300">Jugador a jugador</p>
          </div>
          <div className="divide-y divide-canvas-700/60">
            {result.playerResults.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.playerName}</p>
                  <p className={`text-xs ${TEAM_TEXT[r.teamColor] ?? "text-zinc-400"}`}>{r.teamColor && teams.find(t => t.id === r.teamId)?.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-lg font-black text-green-400">{r.correct}</span>
                  <span className="text-zinc-600 text-xs ml-1">/ {r.songsShown}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl font-black text-lg bg-white hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900 shadow-lg shadow-black/20"
        >
          Ver marcador general →
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
