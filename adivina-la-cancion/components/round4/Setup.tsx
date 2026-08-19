"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import {
  Round4Setup,
  DEFAULT_TURN_DURATION,
  DEFAULT_WINS_TO_WIN,
  POINTS_WIN,
} from "@/lib/round4";

function DurationControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">Tiempo por turno</p>
        <p className="text-xs text-zinc-500">Segundos para dar una respuesta válida</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(5, value - 5))}
          className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
        >
          −
        </button>
        <span className="w-12 text-center text-white font-black tabular-nums">{value}s</span>
        <button
          onClick={() => onChange(Math.min(60, value + 5))}
          className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function Setup({
  teams,
  onStart,
}: {
  teams: Team[];
  onStart: (setup: Round4Setup) => void;
}) {
  const [topic, setTopic] = useState("");
  const [turnDuration, setTurnDuration] = useState(DEFAULT_TURN_DURATION);
  const [winsToWin, setWinsToWin] = useState(DEFAULT_WINS_TO_WIN);

  const canStart = topic.trim().length > 0 && teams.length > 1;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 4 · Preparación
        </p>
        <h1 className="text-2xl font-black">Cultura musical</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Mini-partidas de eliminación · una vida por equipo
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-6 max-w-2xl mx-auto w-full">
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Mecánica</p>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Todos empiezan cada mini-partida con una vida. Cuando un equipo falla o se queda sin tiempo,
            queda eliminado solo de esa mini-partida. Se sigue jugando hasta que quede un único equipo.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-canvas-800 border border-canvas-700 rounded-xl py-3 px-2">
              <p className="text-xl font-black text-white">1</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">vida por partida</p>
            </div>
            <div className="bg-canvas-800 border border-canvas-700 rounded-xl py-3 px-2">
              <p className="text-xl font-black text-white">{winsToWin}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">victorias para ganar</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl py-3 px-2">
              <p className="text-xl font-black text-green-400">+{POINTS_WIN}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">al campeón final</p>
            </div>
          </div>
          <p className="text-xs text-zinc-600">
            Al terminar cada mini-partida vuelven todos los equipos y el presentador introduce un nuevo reto.
          </p>
        </section>

        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Primer reto</p>
          <input
            type="text"
            placeholder="Ej: Cantantes españoles en solitario, grupos con nombre de animal…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <p className="text-xs text-zinc-600">
            Después de cada victoria podrás cambiar el reto antes de empezar la siguiente mini-partida.
          </p>
        </section>

        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Duración de la ronda</p>
            <p className="text-sm font-semibold text-white mt-1">Victorias necesarias</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[2, 3].map((value) => (
              <button
                key={value}
                onClick={() => setWinsToWin(value)}
                className={`rounded-xl py-3 border font-black transition-all active:scale-95 ${
                  winsToWin === value
                    ? "bg-white text-zinc-900 border-white"
                    : "bg-canvas-800 text-zinc-300 border-canvas-700 hover:border-zinc-500"
                }`}
              >
                Primero a {value}
                <span className={`block text-[11px] mt-0.5 font-semibold ${winsToWin === value ? "text-zinc-500" : "text-zinc-600"}`}>
                  {value === 2 ? "modo rápido" : "recomendado"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4">
          <DurationControl value={turnDuration} onChange={setTurnDuration} />
        </section>

        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Equipos participantes</p>
          <div className="flex gap-2 flex-wrap">
            {teams.map((team) => (
              <span key={team.id} className="text-xs font-bold px-3 py-1.5 rounded-full bg-canvas-800 text-white">
                {team.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-600">El equipo que empieza cada mini-partida se decide al azar.</p>
        </section>

        <button
          onClick={() => onStart({ topic: topic.trim(), turnDuration, winsToWin })}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            canStart
              ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 shadow-lg shadow-black/20"
              : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {teams.length < 2
            ? "Se necesitan al menos 2 equipos"
            : canStart
            ? "¡Empezar Cultura Musical! 🎓"
            : "Introduce el primer reto"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
