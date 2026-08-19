"use client";

import { Team } from "@/lib/types";
import { useGame } from "@/context/GameContext";

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; text: string; dot: string; plus: string; minus: string }
> = {
  violet: {
    bg: "bg-violet-950/30",
    border: "border-violet-700/40",
    text: "text-violet-200",
    dot: "bg-violet-400",
    minus: "bg-violet-950/60 hover:bg-violet-900/70",
    plus: "bg-violet-500/90 hover:bg-violet-400",
  },
  amber: {
    bg: "bg-amber-950/25",
    border: "border-amber-700/40",
    text: "text-amber-200",
    dot: "bg-amber-400",
    minus: "bg-amber-950/60 hover:bg-amber-900/70",
    plus: "bg-amber-500/90 hover:bg-amber-400",
  },
  sky: {
    bg: "bg-sky-950/25",
    border: "border-sky-700/40",
    text: "text-sky-200",
    dot: "bg-sky-400",
    minus: "bg-sky-950/60 hover:bg-sky-900/70",
    plus: "bg-sky-500/90 hover:bg-sky-400",
  },
  rose: {
    bg: "bg-rose-950/25",
    border: "border-rose-700/40",
    text: "text-rose-200",
    dot: "bg-rose-400",
    minus: "bg-rose-950/60 hover:bg-rose-900/70",
    plus: "bg-rose-500/90 hover:bg-rose-400",
  },
};

const SCORE_STEPS = [10, 20, 50, 100];

function TeamCard({ team, onWildcard }: { team: Team; onWildcard?: () => void }) {
  const { adjustScore } = useGame();
  const c = COLOR_MAP[team.color];
  const availableWildcards = team.wildcards.filter((w) => !w.used).length;

  return (
    <div className={`flex-1 min-w-0 rounded-3xl border ${c.bg} ${c.border} p-4 sm:p-5 flex flex-col gap-4 shadow-xl shadow-black/10`}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${c.text} truncate`}>{team.name}</p>
        </div>
        <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none mt-3 text-cream-50 tracking-tight">{team.score}</p>
        <p className="text-[10px] uppercase tracking-[0.2em] game-muted mt-1">puntos</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {SCORE_STEPS.map((step) => (
          <button
            key={`plus-${step}`}
            onClick={() => adjustScore(team.id, step)}
            className={`${c.plus} text-white text-[11px] font-black py-2 rounded-xl transition-all active:scale-95`}
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
            className={`${c.minus} text-zinc-300 text-[11px] font-black py-2 rounded-xl transition-all active:scale-95`}
          >
            −{step}
          </button>
        ))}
      </div>

      {onWildcard && (
        <button
          onClick={availableWildcards > 0 ? onWildcard : undefined}
          className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
            availableWildcards > 0
              ? "border border-gold-300/25 bg-gold-300/10 text-gold-300 hover:bg-gold-300/15 active:scale-95"
              : "bg-black/10 text-zinc-600 cursor-default"
          }`}
        >
          🃏 Comodín{availableWildcards > 0 ? ` · ${availableWildcards}` : " · agotados"}
        </button>
      )}
    </div>
  );
}

export default function Scoreboard({ teams, onWildcard }: { teams: Team[]; onWildcard?: (teamId: string) => void }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const leader = sorted[0];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="game-kicker">Marcador</h2>
        {leader && (
          <span className="text-xs game-muted">
            Lidera <span className={`font-black ${COLOR_MAP[leader.color].text}`}>{leader.name}</span>
          </span>
        )}
      </div>
      <div className="flex gap-3">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} onWildcard={onWildcard ? () => onWildcard(team.id) : undefined} />
        ))}
      </div>
    </section>
  );
}
