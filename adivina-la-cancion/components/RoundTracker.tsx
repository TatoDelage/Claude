"use client";

import { Round } from "@/lib/types";

const STATUS_STYLES = {
  completed: {
    circle: "bg-canvas-700 text-zinc-400",
    line: "bg-canvas-700",
    card: "opacity-55",
    badge: "bg-canvas-700/70 text-zinc-400",
    badgeText: "Completada",
  },
  active: {
    circle: "bg-gold-300 text-canvas-950 ring-4 ring-gold-300/10 shadow-[0_0_24px_rgba(233,198,108,.2)]",
    line: "bg-canvas-700",
    card: "opacity-100 border-gold-300/25 bg-gold-300/[0.045]",
    badge: "bg-gold-300/10 text-gold-300 border border-gold-300/20",
    badgeText: "En curso",
  },
  pending: {
    circle: "bg-canvas-800 text-zinc-600 border border-canvas-700",
    line: "bg-canvas-800",
    card: "opacity-35",
    badge: "bg-canvas-800 text-zinc-600",
    badgeText: "Pendiente",
  },
};

export default function RoundTracker({ rounds }: { rounds: Round[] }) {
  return (
    <section>
      <h2 className="game-kicker mb-4">La partida</h2>

      <div className="space-y-2">
        {rounds.map((round, i) => {
          const s = STATUS_STYLES[round.status];
          return (
            <div key={round.number} className="flex gap-3 items-start">
              <div className="flex flex-col items-center pt-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${s.circle}`}>
                  {round.status === "completed" ? "✓" : round.number}
                </div>
                {i < rounds.length - 1 && <div className={`w-0.5 h-4 mt-1 ${s.line}`} />}
              </div>

              <div className={`flex-1 border border-canvas-700 rounded-2xl px-4 py-3.5 transition-all bg-canvas-900 ${s.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-sm text-cream-50 truncate">{round.name}</p>
                    <p className="text-xs game-muted mt-0.5 truncate">{round.shortDesc}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0 ${s.badge}`}>{s.badgeText}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
