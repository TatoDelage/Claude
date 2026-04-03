"use client";

import { Team } from "@/lib/types";
import { TurnResult, scoresByTeam, POINTS_CORRECT, POINTS_FAIL } from "@/lib/round2";

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
  const allScores = Object.values(scores);
  const best = allScores.length > 0 ? Math.max(...allScores) : 0;

  const logByTeam: Record<string, TurnResult[]> = Object.fromEntries(
    teams.map((t) => [t.id, []])
  );
  for (const r of results) logByTeam[r.teamId]?.push(r);

  const totalCorrect = results.filter((r) => r.primaryCorrect).length;
  const totalTurns = results.length;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 2 completada
        </p>
        <h1 className="text-3xl font-black">Resultados</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {totalCorrect} de {totalTurns} canciones acertadas a la primera
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
        {/* Score summary */}
        <section
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 2)}, 1fr)` }}
        >
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
                {isLeader && <p className="text-xs font-bold text-white/80 mb-1">👑 Líder</p>}
                <p className={`text-xs font-bold uppercase tracking-wide truncate ${isLeader ? "text-white/80" : TEAM_TEXT[team.color]}`}>
                  {team.name}
                </p>
                <p className="text-4xl font-black mt-1">
                  {pts > 0 ? `+${pts}` : pts < 0 ? `${pts}` : "0"}
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
                <span className={`text-sm font-bold ${TEAM_TEXT[team.color]}`}>{team.name}</span>
                <span className="text-sm font-black text-white">
                  {teamPts > 0 ? `+${teamPts}` : teamPts} pts
                </span>
              </div>
              <div className="divide-y divide-canvas-700/60">
                {log.map((r, i) => {
                  const label =
                    [r.song.title, r.song.artist].filter(Boolean).join(" — ") || "Sin info";
                  return (
                    <div key={i} className="px-4 py-3 space-y-1.5">
                      {/* Primary result row */}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-zinc-300 truncate min-w-0">{label}</p>
                        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                          r.primaryCorrect
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {r.primaryCorrect ? `+${POINTS_CORRECT}` : `${POINTS_FAIL}`}
                        </span>
                      </div>
                      {/* Rebound rows */}
                      {r.rebounds.filter((rb) => rb.choice !== "pass").map((rb) => {
                        const rbt = teams.find((t) => t.id === rb.teamId)!;
                        return (
                          <div key={rb.teamId} className="flex items-center justify-between gap-3 pl-3 border-l-2 border-canvas-700">
                            <p className={`text-xs ${TEAM_TEXT[rbt.color]}`}>
                              ↩ {rbt.name}
                            </p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              rb.choice === "correct"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                              {rb.choice === "correct" ? `+${POINTS_CORRECT}` : `${POINTS_FAIL}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl font-black text-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/25"
        >
          Ver marcador general →
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
