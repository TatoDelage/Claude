"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { createGame, TeamConfig } from "@/lib/gameFactory";

const TEAM_COUNT_OPTIONS = [2, 3, 4] as const;

const DEFAULT_TEAM_NAMES = [
  "Equipo Rojo",
  "Equipo Azul",
  "Equipo Verde",
  "Equipo Amarillo",
];

const TEAM_ACCENT = [
  "bg-violet-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-rose-500",
];

const TEAM_BORDER = [
  "border-violet-700/50",
  "border-amber-700/50",
  "border-teal-700/50",
  "border-rose-700/50",
];

const TEAM_BG = [
  "bg-violet-950/40",
  "bg-amber-950/40",
  "bg-teal-950/40",
  "bg-rose-950/40",
];

interface TeamDraft {
  name: string;
  playerCount: number;
  playerNames: string[];
  captainIndex: number;
}

function initTeamDraft(): TeamDraft {
  return { name: "", playerCount: 2, playerNames: ["", ""], captainIndex: 0 };
}

function resizePlayers(draft: TeamDraft, newCount: number): TeamDraft {
  const names = [...draft.playerNames];
  while (names.length < newCount) names.push("");
  return {
    ...draft,
    playerCount: newCount,
    playerNames: names.slice(0, newCount),
    captainIndex: Math.min(draft.captainIndex, newCount - 1),
  };
}

export default function SetupPage() {
  const router = useRouter();
  const { setGame } = useGame();

  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [activeTeam, setActiveTeam] = useState(0);
  const [drafts, setDrafts] = useState<TeamDraft[]>(() =>
    Array.from({ length: 4 }, initTeamDraft)
  );

  const update = (i: number, patch: Partial<TeamDraft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const handleTeamCount = (n: 2 | 3 | 4) => {
    setTeamCount(n);
    setActiveTeam((prev) => Math.min(prev, n - 1));
  };

  const handlePlayerCount = (teamIdx: number, delta: number) => {
    const next = Math.max(1, drafts[teamIdx].playerCount + delta);
    setDrafts((prev) =>
      prev.map((d, i) => (i === teamIdx ? resizePlayers(d, next) : d))
    );
  };

  const handlePlayerName = (teamIdx: number, playerIdx: number, val: string) => {
    const names = [...drafts[teamIdx].playerNames];
    names[playerIdx] = val;
    update(teamIdx, { playerNames: names });
  };

  const handleStart = () => {
    const configs: TeamConfig[] = drafts.slice(0, teamCount).map((d, i) => ({
      name: d.name.trim() || DEFAULT_TEAM_NAMES[i],
      players: d.playerNames.map((n, j) => ({
        name: n.trim() || `Jugador ${j + 1}`,
        isCaptain: j === d.captainIndex,
      })),
    }));
    setGame(createGame(configs));
    router.push("/game");
  };

  const draft = drafts[activeTeam];

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Title */}
      <div className="text-center pt-10 pb-5 px-4">
        <div className="text-4xl mb-2">🎵</div>
        <h1 className="text-3xl font-black tracking-tight">
          Adivina la <span className="text-violet-400">Canción</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">El juego musical en grupo</p>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-10 space-y-6 max-w-sm mx-auto w-full">

        {/* ── 1. Número de equipos ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Número de equipos
          </p>
          <div className="flex gap-3">
            {TEAM_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => handleTeamCount(n)}
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

        {/* ── 2. Tabs de equipo ── */}
        <div className="flex gap-2">
          {Array.from({ length: teamCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveTeam(i)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTeam === i
                  ? `${TEAM_ACCENT[i]} text-white shadow-lg`
                  : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* ── 3. Configuración del equipo activo ── */}
        <section
          className={`border rounded-2xl p-4 space-y-5 ${TEAM_BG[activeTeam]} ${TEAM_BORDER[activeTeam]}`}
        >
          {/* Nombre del equipo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Nombre del equipo
            </p>
            <input
              type="text"
              placeholder={DEFAULT_TEAM_NAMES[activeTeam]}
              value={draft.name}
              onChange={(e) => update(activeTeam, { name: e.target.value })}
              maxLength={20}
              className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-sm transition-colors"
            />
          </div>

          {/* Número de integrantes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Número de integrantes
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handlePlayerCount(activeTeam, -1)}
                disabled={draft.playerCount <= 1}
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white text-xl font-bold transition-all active:scale-95"
              >
                −
              </button>
              <span className="text-3xl font-black w-8 text-center tabular-nums">
                {draft.playerCount}
              </span>
              <button
                onClick={() => handlePlayerCount(activeTeam, +1)}
                className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xl font-bold transition-all active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Jugadores + Capitán */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Jugadores
              </p>
              <p className="text-xs text-zinc-600">
                👑 = Capitán
              </p>
            </div>
            <div className="space-y-2">
              {draft.playerNames.map((name, j) => (
                <div key={j} className="flex items-center gap-2">
                  <button
                    onClick={() => update(activeTeam, { captainIndex: j })}
                    title="Marcar como capitán"
                    className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-base transition-all active:scale-90 ${
                      draft.captainIndex === j
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                        : "bg-zinc-800 text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    👑
                  </button>
                  <input
                    type="text"
                    placeholder={`Jugador ${j + 1}`}
                    value={name}
                    onChange={(e) => handlePlayerName(activeTeam, j, e.target.value)}
                    maxLength={20}
                    className="flex-1 bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-sm transition-colors"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Capitán actual:{" "}
              <span className="text-amber-400 font-medium">
                {draft.playerNames[draft.captainIndex]?.trim() ||
                  `Jugador ${draft.captainIndex + 1}`}
              </span>
            </p>
          </div>
        </section>

        {/* ── 4. Botón de inicio ── */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-lg bg-violet-500 hover:bg-violet-400 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
        >
          ¡Empezar la partida! 🎮
        </button>

        <p className="text-zinc-600 text-xs text-center pb-2">
          Los campos vacíos usarán nombres por defecto
        </p>
      </div>
    </main>
  );
}
