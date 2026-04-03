"use client";

import { Round } from "@/lib/types";

const STATUS_STYLES = {
  completed: {
    circle: "bg-canvas-700 text-zinc-400",
    line: "bg-canvas-700",
    card: "opacity-50",
    badge: "bg-canvas-700 text-zinc-400",
    badgeText: "Completada",
  },
  active: {
    circle: "bg-white text-zinc-900 ring-4 ring-white/20",
    line: "bg-canvas-700",
    card: "opacity-100",
    badge: "bg-white/10 text-zinc-300",
    badgeText: "En curso",
  },
  pending: {
    circle: "bg-canvas-800 text-zinc-600 border border-canvas-700",
    line: "bg-canvas-800",
    card: "opacity-40",
    badge: "bg-canvas-800 text-zinc-600",
    badgeText: "Pendiente",
  },
};

export default function RoundTracker({ rounds }: { rounds: Round[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Rondas
      </h2>

      <div className="space-y-2">
        {rounds.map((round, i) => {
          const s = STATUS_STYLES[round.status];
          return (
            <div key={round.number} className="flex gap-3 items-start">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all ${s.circle}`}
                >
                  {round.status === "completed" ? "✓" : round.number}
                </div>
                {i < rounds.length - 1 && (
                  <div className={`w-0.5 h-3 mt-1 ${s.line}`} />
                )}
              </div>

              {/* Card — display only, no click */}
              <div
                className={`flex-1 bg-canvas-900 border border-canvas-700 rounded-xl px-4 py-3 transition-all ${s.card}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white truncate">
                      Ronda {round.number} — {round.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {round.shortDesc}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}
                  >
                    {s.badgeText}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
