"use client";

import { Team } from "@/lib/types";
import { Round4Result, POINTS_WIN } from "@/lib/round4";

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
  result: Round4Result;
  teams: Team[];
  onContinue: () => void;
}) {
  const winner = teams.find((team) => team.id === result.winnerTeamId);

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 4 completada
        </p>
        <h1 className="text-3xl font-black">Cultura musical</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {result.matches.length} mini-partida{result.matches.length !== 1 ? "s" : ""}
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
        {winner && (
          <section className={`rounded-2xl p-6 text-center ${TEAM_ACCENT[winner.color]}`}>
            <p className="text-4xl mb-2">🏆</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Campeón de la ronda</p>
            <p className="text-3xl font-black text-white mt-1">{winner.name}</p>
            <p className="text-5xl font-black text-white mt-3">+{POINTS_WIN}</p>
            <p className="text-xs text-white/60 mt-1">pts al marcador general</p>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          {teams
            .slice()
            .sort((a, b) => (result.victoriesByTeam[b.id] ?? 0) - (result.victoriesByTeam[a.id] ?? 0))
            .map((team) => {
              const wins = result.victoriesByTeam[team.id] ?? 0;
              return (
                <div key={team.id} className="rounded-2xl p-4 text-center bg-canvas-900 border border-canvas-700">
                  <p className={`text-sm font-black truncate ${TEAM_TEXT[team.color]}`}>{team.name}</p>
                  <p className="text-4xl font-black text-white mt-2">{wins}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">victoria{wins !== 1 ? "s" : ""}</p>
                  <div className="mt-2 flex justify-center gap-1">
                    {Array.from({ length: result.winsToWin }).map((_, index) => (
                      <span key={index} className={index < wins ? "text-amber-300" : "text-zinc-700"}>★</span>
                    ))}
                  </div>
                </div>
              );
            })}
        </section>

        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-canvas-700">
            <p className="text-sm font-bold text-zinc-300">Historial de mini-partidas</p>
          </div>
          <div className="divide-y divide-canvas-700/40">
            {result.matches.map((match) => {
              const matchWinner = teams.find((team) => team.id === match.winnerTeamId);
              return (
                <div key={match.matchNumber} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-600">Partida {match.matchNumber}</p>
                    <p className="text-sm text-zinc-300 truncate">{match.topic}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-black ${matchWinner ? TEAM_TEXT[matchWinner.color] : "text-white"}`}>
                      {matchWinner?.name ?? "Ganador"}
                    </p>
                    <p className="text-[10px] text-zinc-600">{match.usedAnswers.length} respuestas válidas</p>
                  </div>
                </div>
              );
            })}
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
