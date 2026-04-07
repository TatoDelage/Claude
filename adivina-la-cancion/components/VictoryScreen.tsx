"use client";

import { useEffect, useRef } from "react";
import { Team } from "@/lib/types";

const TEAM_BG: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
};

const TEAM_TEXT_COLOR: Record<string, string> = {
  violet: "#a855f7",
  amber: "#f59e0b",
  sky: "#38bdf8",
  rose: "#f43f5e",
};

const TEAM_SHADOW: Record<string, string> = {
  violet: "shadow-violet-500/30",
  amber: "shadow-amber-500/30",
  sky: "shadow-sky-500/30",
  rose: "shadow-rose-500/30",
};

const CONFETTI_COLORS = [
  "#a855f7", "#f59e0b", "#38bdf8", "#f43f5e",
  "#22c55e", "#ffffff", "#facc15", "#e879f9",
  "#34d399", "#fb923c", "#60a5fa", "#f472b6",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  w: number;
  h: number;
  angle: number;
  spin: number;
  opacity: number;
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (count: number, fromTop = false) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * (canvas?.width ?? window.innerWidth),
          y: fromTop ? -20 : (Math.random() * (canvas?.height ?? window.innerHeight) * 0.4),
          vx: (Math.random() - 0.5) * 9,
          vy: fromTop ? Math.random() * 4 + 1 : Math.random() * 5 + 2,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          w: Math.random() * 11 + 5,
          h: Math.random() * 7 + 3,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.22,
          opacity: 1,
        });
      }
    };

    // Initial burst
    spawn(240);

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      frame++;
      // Continuous trickle
      if (frame % 4 === 0 && particles.length < 350) spawn(6, true);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.995;
        p.angle += p.spin;
        // Fade out near bottom
        if (p.y > canvas.height * 0.75) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }
        if (p.y > canvas.height + 30 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}

export default function VictoryScreen({
  teams,
  onNewGame,
}: {
  teams: Team[];
  onNewGame: () => void;
}) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const topScore = sorted[0].score;
  const winners = sorted.filter((t) => t.score === topScore);
  const isTie = winners.length > 1;

  return (
    <div className="fixed inset-0 bg-canvas-950 flex flex-col items-center justify-center z-50 overflow-hidden">
      <ConfettiCanvas />

      <div className="relative z-10 flex flex-col items-center px-6 py-10 max-w-lg w-full mx-auto text-center gap-8">

        {/* Crown / trophy icon */}
        <div className="text-7xl leading-none select-none" style={{ filter: "drop-shadow(0 0 24px #f59e0b)" }}>
          {isTie ? "🤝" : "🏆"}
        </div>

        {/* Winner announcement */}
        {isTie ? (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Resultado final</p>
            <p className="text-5xl font-black text-white">¡Empate!</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {winners.map((t) => (
                <span
                  key={t.id}
                  className={`text-xl font-black px-4 py-1.5 rounded-full text-white ${TEAM_BG[t.color]}`}
                >
                  {t.name}
                </span>
              ))}
            </div>
            <p className="text-zinc-400 text-base">con {topScore} puntos cada equipo</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Campeón</p>
            <p
              className="text-7xl font-black leading-tight"
              style={{
                color: TEAM_TEXT_COLOR[winners[0].color],
                textShadow: `0 0 60px ${TEAM_TEXT_COLOR[winners[0].color]}88`,
              }}
            >
              {winners[0].name}
            </p>
            <p className="text-3xl font-black text-white mt-1">
              {topScore}
              <span className="text-lg font-medium text-zinc-400 ml-1">pts</span>
            </p>
          </div>
        )}

        {/* Final scoreboard */}
        <div className="w-full space-y-2.5">
          {sorted.map((team, i) => {
            const isWinner = team.score === topScore;
            const medalEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
            return (
              <div
                key={team.id}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                  isWinner
                    ? `${TEAM_BG[team.color]} shadow-2xl ${TEAM_SHADOW[team.color]}`
                    : "bg-canvas-800"
                }`}
              >
                <span className="text-xl w-8 text-center select-none">{medalEmoji}</span>
                <span className={`flex-1 text-left font-black text-lg ${isWinner ? "text-white" : "text-zinc-300"}`}>
                  {team.name}
                </span>
                <span className={`text-2xl font-black tabular-nums ${isWinner ? "text-white" : "text-zinc-200"}`}>
                  {team.score}
                  <span className="text-sm font-medium ml-1 opacity-60">pts</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={onNewGame}
          className="w-full py-4 rounded-2xl bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 text-lg font-black transition-all shadow-2xl shadow-black/60"
        >
          Nueva partida
        </button>
      </div>
    </div>
  );
}
