"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import { Round4Setup, DEFAULT_TURN_DURATION } from "@/lib/round4";

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
        >−</button>
        <span className="w-12 text-center text-white font-black tabular-nums">{value}s</span>
        <button
          onClick={() => onChange(Math.min(60, value + 5))}
          className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
        >+</button>
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

  const canStart = topic.trim().length > 0;

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 4 · Preparación
        </p>
        <h1 className="text-2xl font-black">Cultura musical</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Los equipos se turnan nombrando respuestas sobre un tema
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-6 max-w-2xl mx-auto w-full">
        {/* Mechanic reminder */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Mecánica</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Los equipos se alternan. Cada turno, el equipo en juego dice en voz alta una respuesta dentro del tema.
            El presentador la valida. Si el tiempo se acaba o la respuesta no es válida, ese equipo pierde.
          </p>
          <div className="flex gap-3 text-sm pt-1">
            <div className="flex-1 text-center bg-green-500/10 border border-green-500/20 rounded-xl py-2.5">
              <p className="font-black text-green-400 text-xl">+{100}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Ganador</p>
            </div>
            <div className="flex-1 text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2.5">
              <p className="font-black text-red-400 text-xl">−{50}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Perdedor</p>
            </div>
            <div className="flex-1 text-center bg-canvas-800 border border-canvas-700 rounded-xl py-2.5">
              <p className="font-black text-zinc-500 text-xs leading-tight">Sin comodines</p>
              <p className="text-zinc-600 text-xs mt-0.5">No disponibles</p>
            </div>
          </div>
        </section>

        {/* Topic */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Tema de la ronda</p>
          <input
            type="text"
            placeholder="Ej: Canciones de reggaeton antes de 2012, Cantantes españoles en solitario…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-3 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <p className="text-xs text-zinc-600">
            Este texto se mostrará en pantalla durante toda la ronda
          </p>
        </section>

        {/* Timer config */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4">
          <DurationControl value={turnDuration} onChange={setTurnDuration} />
        </section>

        {/* Teams reminder */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Equipos participantes</p>
          <div className="flex gap-2 flex-wrap">
            {teams.map((team) => (
              <span
                key={team.id}
                className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                style={{}}
              >
                {team.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-600">El equipo que empieza se decide al azar</p>
        </section>

        <button
          onClick={() => onStart({ topic: topic.trim(), turnDuration })}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            canStart
              ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 shadow-lg shadow-black/20"
              : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {canStart ? "¡Empezar Ronda 4! 🎓" : "Introduce el tema de la ronda"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
