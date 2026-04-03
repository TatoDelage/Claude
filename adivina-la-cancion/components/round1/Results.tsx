"use client";

import { Team } from "@/lib/types";
import { TurnResult, scoresByTeam, POINTS_CORRECT } from "@/lib/round1";

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
  results,
  teams,
  onContinue,
}: {
  results: TurnResult[];
  teams: Team[];
  onContinue: () => void;
}) {
  const scores = scoresByTeam(results);
  const best = Math.max(...Object.values(scores));

  // Build per-team song log
  const logByTeam: Record<string, TurnResult[]> = Object.fromEntries(
    teams.map((t) => [t.id, []])
  );
  for (const r of results) {
    logByTeam[r.teamId]?.push(r);
  }

  const totalCorrect = results.filter((r) => r.correct).length;
  const totalTurns = results.length;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 1 completada
        </p>
        <h1 className="text-3xl font-black">Resultados</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {totalCorrect} de {totalTurns} canciones acertadas
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
        {/* Score summary per team */}
        <section className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 2)}, 1fr)` }}>
          {teams.map((team) => {
            const pts = scores[team.id] ?? 0;
            const isLeader = pts === best && best > 0;
            return (
              <div
                key={team.id}
                className={`rounded-2xl p-4 text-center border ${
                  isLeader
                    ? `${TEAM_ACCENT[team.color]} border-transparent`
                    : "bg-canvas-900 border-canvas-700"
                }`}
              >
                {isLeader && (
                  <p className="text-xs font-bold text-white/80 mb-1">👑 Líder</p>
                )}
                <p
                  className={`text-xs font-bold uppercase tracking-wide truncate ${
                    isLeader ? "text-white/80" : TEAM_TEXT[team.color]
                  }`}
                >
                  {team.name}
                </p>
                <p className={`text-4xl font-black mt-1 ${isLeader ? "text-white" : "text-white"}`}>
                  {pts > 0 ? `+${pts}` : "0"}
                </p>
                <p className={`text-xs mt-0.5 ${isLeader ? "text-white/60" : "text-zinc-500"}`}>
                  pts esta ronda
                </p>
              </div>
            );
          })}
        </section>

        {/* Song log per team */}
        {teams.map((team) => {
          const log = logByTeam[team.id] ?? [];
          const teamPts = scores[team.id] ?? 0;
          return (
            <section key={team.id} className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-700">
                <span className={`text-sm font-bold ${TEAM_TEXT[team.color]}`}>
                  {team.name}
                </span>
                <span className="text-sm font-black text-white">
                  +{teamPts} pts
                </span>
              </div>
              <div className="divide-y divide-canvas-700/60">
                {log.map((r, i) => {
                  const label =
                    [r.song.title, r.song.artist].filter(Boolean).join(" — ") ||
                    "Sin info";
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300 truncate">{label}</p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                          r.correct
                            ? "bg-green-500/15 text-green-400"
                            : "bg-canvas-800 text-zinc-500"
                        }`}
                      >
                        {r.correct ? `+${POINTS_CORRECT}` : "0"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Continue button */}
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl font-black text-lg bg-white hover:bg-zinc-100 active:scale-95 transition-all text-zinc-900 font-black shadow-lg shadow-black/20"
        >
          Ver marcador general →
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
