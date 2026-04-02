"use client";

import { useState } from "react";
import { Team, WildcardId } from "@/lib/types";
import { useGame } from "@/context/GameContext";

const COLOR_MAP: Record<string, { header: string; used: string; active: string; border: string }> = {
  violet: {
    header: "text-violet-300",
    border: "border-violet-700/40",
    active: "bg-violet-900/40 border-violet-700/60 hover:bg-violet-900/60",
    used: "bg-zinc-900/40 border-zinc-800 opacity-40",
  },
  amber: {
    header: "text-amber-300",
    border: "border-amber-700/40",
    active: "bg-amber-900/40 border-amber-700/60 hover:bg-amber-900/60",
    used: "bg-zinc-900/40 border-zinc-800 opacity-40",
  },
  teal: {
    header: "text-teal-300",
    border: "border-teal-700/40",
    active: "bg-teal-900/40 border-teal-700/60 hover:bg-teal-900/60",
    used: "bg-zinc-900/40 border-zinc-800 opacity-40",
  },
  rose: {
    header: "text-rose-300",
    border: "border-rose-700/40",
    active: "bg-rose-900/40 border-rose-700/60 hover:bg-rose-900/60",
    used: "bg-zinc-900/40 border-zinc-800 opacity-40",
  },
};

function TeamWildcards({ team }: { team: Team }) {
  const { useWildcard } = useGame();
  const [confirming, setConfirming] = useState<WildcardId | null>(null);
  const c = COLOR_MAP[team.color];

  const available = team.wildcards.filter((w) => !w.used);
  const used = team.wildcards.filter((w) => w.used);

  const handleClick = (id: WildcardId) => {
    if (confirming === id) {
      useWildcard(team.id, id);
      setConfirming(null);
    } else {
      setConfirming(id);
    }
  };

  return (
    <div className={`border-t ${c.border} pt-4`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${c.header} mb-3`}>
        {team.name}
        <span className="text-zinc-600 font-normal ml-2">
          {available.length}/{team.wildcards.length} comodines
        </span>
      </p>

      <div className="grid grid-cols-3 gap-2">
        {team.wildcards.map((wc) => {
          const isConfirming = confirming === wc.id;
          return (
            <button
              key={wc.id}
              disabled={wc.used}
              onClick={() => !wc.used && handleClick(wc.id)}
              className={`relative border rounded-xl p-2.5 text-center transition-all active:scale-95 ${
                wc.used ? c.used + " cursor-default" : c.active + " cursor-pointer"
              } ${isConfirming ? "ring-2 ring-white/30 scale-105" : ""}`}
            >
              {wc.used && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-zinc-600 text-lg">✓</span>
                </div>
              )}
              <div className={wc.used ? "opacity-30" : ""}>
                <div className="text-xl mb-1">{wc.emoji}</div>
                <p className="text-xs font-bold text-white leading-tight">{wc.name}</p>
                {isConfirming && (
                  <p className="text-xs text-yellow-400 mt-1 leading-tight">
                    Pulsa otra vez
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tooltip for confirming state */}
      {confirming && (
        <p className="text-xs text-zinc-500 text-center mt-2">
          {team.wildcards.find((w) => w.id === confirming)?.description} — confirma para usar
        </p>
      )}
    </div>
  );
}

export default function WildcardsPanel({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Comodines
        </h2>
        <span className="text-zinc-600 text-xs">{open ? "▲ ocultar" : "▼ ver"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {teams.map((team) => (
            <TeamWildcards key={team.id} team={team} />
          ))}
        </div>
      )}
    </section>
  );
}
