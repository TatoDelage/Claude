"use client";

import { Team } from "@/lib/types";
import { Round4Result, POINTS_WIN, POINTS_LOSE } from "@/lib/round4";

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
  const losingTeam = teams.find((t) => t.id === result.losingTeamId);
  const winningTeams = teams.filter((t) => result.winningTeamIds.includes(t.id));

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 4 completada
        </p>
        <h1 className="text-3xl font-black">Resultados</h1>
        <p className="text-zinc-400 text-sm mt-1 truncate px-4">{result.topic}</p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
        {/* End reason */}
        <div className={`p-4 rounded-2xl text-center border ${
          result.endReason === "timeout"
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-red-500/10 border-red-500/20"
        }`}>
          <p className="text-2xl mb-1">{result.endReason === "timeout" ? "⏰" : "✗"}</p>
          <p className="font-black text-white text-lg">
            {result.endReason === "timeout"
              ? `${losingTeam?.name ?? "Un equipo"} se quedó sin tiempo`
              : `${losingTeam?.name ?? "Un equipo"} dio una respuesta no válida`}
          </p>
        </div>

        {/* Score changes */}
        <section
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 2)}, 1fr)` }}
        >
          {winningTeams.map((team) => (
            <div
              key={team.id}
              className={`rounded-2xl p-4 text-center ${TEAM_ACCENT[team.color]}`}
            >
              <p className="text-xs font-bold text-white/80 mb-1">🏆 Ganador</p>
              <p className="text-sm font-bold text-white/90 truncate">{team.name}</p>
              <p className="text-4xl font-black mt-1 text-white">+{POINTS_WIN}</p>
              <p className="text-xs text-white/60 mt-0.5">pts esta ronda</p>
            </div>
          ))}
          {losingTeam && (
            <div className="rounded-2xl p-4 text-center bg-canvas-900 border border-canvas-700">
              <p className="text-xs font-bold text-zinc-500 mb-1">Perdedor</p>
              <p className={`text-sm font-bold truncate ${TEAM_TEXT[losingTeam.color]}`}>{losingTeam.name}</p>
              <p className="text-4xl font-black mt-1 text-red-400">{POINTS_LOSE}</p>
              <p className="text-xs text-zinc-500 mt-0.5">pts esta ronda</p>
            </div>
          )}
        </section>

        {/* Used answers */}
        {result.usedAnswers.length > 0 && (
          <section className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-canvas-700">
              <p className="text-sm font-bold text-zinc-300">
                Respuestas válidas ({result.usedAnswers.length})
              </p>
            </div>
            <div className="divide-y divide-canvas-700/40">
              {result.usedAnswers.map((ans, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-zinc-600 text-xs font-mono w-5 text-right">{i + 1}.</span>
                  <span className="text-sm text-zinc-300">{ans}</span>
                </div>
              ))}
            </div>
          </section>
        )}

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
