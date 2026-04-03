"use client";

import { Team } from "@/lib/types";
import { useGame } from "@/context/GameContext";

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; text: string; ring: string; minus: string; plus: string }
> = {
  violet: {
    bg: "bg-violet-950/60",
    border: "border-violet-700/50",
    text: "text-violet-300",
    ring: "ring-violet-500",
    minus: "bg-violet-900/80 hover:bg-violet-800/80",
    plus: "bg-violet-500 hover:bg-violet-400",
  },
  amber: {
    bg: "bg-amber-950/60",
    border: "border-amber-700/50",
    text: "text-amber-300",
    ring: "ring-amber-500",
    minus: "bg-amber-900/80 hover:bg-amber-800/80",
    plus: "bg-amber-500 hover:bg-amber-400",
  },
  sky: {
    bg: "bg-sky-950/60",
    border: "border-sky-700/50",
    text: "text-sky-300",
    ring: "ring-sky-500",
    minus: "bg-sky-900/80 hover:bg-sky-800/80",
    plus: "bg-sky-500 hover:bg-sky-400",
  },
  rose: {
    bg: "bg-rose-950/60",
    border: "border-rose-700/50",
    text: "text-rose-300",
    ring: "ring-rose-500",
    minus: "bg-rose-900/80 hover:bg-rose-800/80",
    plus: "bg-rose-500 hover:bg-rose-400",
  },
};

const SCORE_STEPS = [10, 20, 50, 100];

function TeamCard({
  team,
  onWildcard,
}: {
  team: Team;
  onWildcard?: () => void;
}) {
  const { adjustScore } = useGame();
  const c = COLOR_MAP[team.color];
  const availableWildcards = team.wildcards.filter((w) => !w.used).length;

  return (
    <div
      className={`flex-1 min-w-0 rounded-2xl border ${c.bg} ${c.border} p-4 flex flex-col gap-3`}
    >
      {/* Name + score */}
      <div className="text-center">
        <p className={`text-xs font-semibold uppercase tracking-widest ${c.text} truncate`}>
          {team.name}
        </p>
        <p className="text-5xl font-black tabular-nums leading-tight mt-1">
          {team.score}
        </p>
        <p className={`text-xs ${c.text} opacity-60`}>puntos</p>
      </div>

      {/* Quick score buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {SCORE_STEPS.map((step) => (
          <button
            key={`plus-${step}`}
            onClick={() => adjustScore(team.id, step)}
            className={`${c.plus} text-white text-xs font-bold py-1.5 rounded-lg transition-colors active:scale-95`}
          >
            +{step}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {SCORE_STEPS.slice(0, 2).map((step) => (
          <button
            key={`minus-${step}`}
            onClick={() => adjustScore(team.id, -step)}
            className={`${c.minus} text-zinc-300 text-xs font-bold py-1.5 rounded-lg transition-colors active:scale-95`}
          >
            -{step}
          </button>
        ))}
      </div>

      {/* Wildcard button */}
      {onWildcard && (
        <button
          onClick={availableWildcards > 0 ? onWildcard : undefined}
          className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
            availableWildcards > 0
              ? `${c.plus} text-white opacity-90 hover:opacity-100 active:scale-95`
              : "bg-canvas-800 text-zinc-600 cursor-default"
          }`}
        >
          🃏 Comodín{availableWildcards > 0 ? ` (${availableWildcards})` : " — agotados"}
        </button>
      )}
    </div>
  );
}

export default function Scoreboard({
  teams,
  onWildcard,
}: {
  teams: Team[];
  onWildcard?: (teamId: string) => void;
}) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const leader = sorted[0];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Marcador
        </h2>
        {leader && (
          <span className="text-xs text-zinc-400">
            Lidera{" "}
            <span className={`font-bold ${COLOR_MAP[leader.color].text}`}>
              {leader.name}
            </span>
          </span>
        )}
      </div>
      <div className="flex gap-3">
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            onWildcard={onWildcard ? () => onWildcard(team.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
