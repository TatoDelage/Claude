"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { createGame } from "@/lib/gameFactory";

const TEAM_COUNT_OPTIONS = [2, 3, 4] as const;
const DEFAULT_NAMES = ["Equipo Rojo", "Equipo Azul", "Equipo Verde", "Equipo Amarillo"];
const TEAM_EMOJIS = ["🟣", "🟠", "🟢", "🌸"];

export default function SetupPage() {
  const router = useRouter();
  const { setGame } = useGame();

  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [names, setNames] = useState(["", "", "", ""]);

  const handleStart = () => {
    const teamNames = names
      .slice(0, teamCount)
      .map((n, i) => n.trim() || DEFAULT_NAMES[i]);
    setGame(createGame(teamNames));
    router.push("/game");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-5 py-12">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🎵</div>
        <h1 className="text-4xl font-black tracking-tight">
          Adivina la{" "}
          <span className="text-violet-400">Canción</span>
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          El juego musical para jugar en grupo
        </p>
      </div>

      {/* Team count selector */}
      <section className="w-full max-w-sm mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Número de equipos
        </p>
        <div className="flex gap-3">
          {TEAM_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setTeamCount(n)}
              className={`flex-1 py-4 rounded-2xl text-2xl font-black transition-all ${
                teamCount === n
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30 scale-105"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Team name inputs */}
      <section className="w-full max-w-sm mb-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Nombres de los equipos
        </p>
        {Array.from({ length: teamCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xl w-7 text-center">{TEAM_EMOJIS[i]}</span>
            <input
              type="text"
              placeholder={DEFAULT_NAMES[i]}
              value={names[i]}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              maxLength={20}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>
        ))}
      </section>

      {/* Start button */}
      <button
        onClick={handleStart}
        className="w-full max-w-sm py-4 rounded-2xl font-black text-lg bg-violet-500 hover:bg-violet-400 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
      >
        ¡Empezar! 🎮
      </button>

      <p className="text-zinc-600 text-xs mt-5 text-center">
        Los campos vacíos usarán los nombres por defecto
      </p>
    </main>
  );
}
