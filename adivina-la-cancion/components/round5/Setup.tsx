"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import {
  SongEntry,
  Round5Setup,
  BANK_SIZE,
  TURN_DURATION,
  MIN_TURN_DURATION,
  MAX_TURN_DURATION,
  POINTS_WIN,
  emptyBank,
} from "@/lib/round5";

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} segundos`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs === 0 ? `${mins} minuto${mins !== 1 ? "s" : ""}` : `${mins} min ${secs}s`;
}

export default function Setup({
  teams,
  onStart,
}: {
  teams: Team[];
  onStart: (setup: Round5Setup) => void;
}) {
  const [songs, setSongs] = useState<SongEntry[]>(emptyBank);
  const [turnDuration, setTurnDuration] = useState(TURN_DURATION);

  const updateSong = (id: string, field: "title" | "artist", value: string) => {
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
  // Title is always required; artist is optional in R5 (Cantante wildcard not available)
  const allFilled = songs.every((s) => s.title.trim() !== "");
  const canStart = allFilled && totalPlayers > 0;

  const teamsWithNoPlayers = teams.filter((t) => t.players.length === 0);

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 5 · Preparación
        </p>
        <h1 className="text-2xl font-black">Relámpago</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {BANK_SIZE} canciones · {turnDuration}s por jugador · solo aciertos
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-6 max-w-2xl mx-auto w-full">
        {/* Mechanic reminder */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Mecánica</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Cada jugador tiene 1 minuto. Las canciones del banco salen una a una. El presentador pulsa
            «Acierto» o «Paso». Sin penalización por fallar o pasar. Al final el equipo con más aciertos
            gana +{POINTS_WIN} pts.
          </p>
          <div className="flex gap-3 text-sm pt-1">
            <div className="flex-1 text-center bg-green-500/10 border border-green-500/20 rounded-xl py-2.5">
              <p className="font-black text-green-400 text-xl">+{POINTS_WIN}</p>
              <p className="text-zinc-500 text-xs mt-0.5">Más aciertos</p>
            </div>
            <div className="flex-1 text-center bg-canvas-800 border border-canvas-700 rounded-xl py-2.5">
              <p className="font-black text-zinc-400 text-xl">0</p>
              <p className="text-zinc-500 text-xs mt-0.5">Empate</p>
            </div>
            <div className="flex-1 text-center bg-canvas-800 border border-canvas-700 rounded-xl py-2.5">
              <p className="font-black text-zinc-500 text-xs leading-tight">Sin penalización</p>
              <p className="text-zinc-600 text-xs mt-0.5">por paso o fallo</p>
            </div>
          </div>
          <p className="text-xs text-zinc-600 pt-1">
            Los comodines <span className="text-zinc-500">Silencio</span> y{" "}
            <span className="text-zinc-500">Robo</span> no están disponibles en esta ronda.
          </p>
        </section>

        {/* Timer config */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Tiempo por jugador</p>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Duración del turno</p>
              <p className="text-xs text-zinc-500">Mín. {MIN_TURN_DURATION}s · Máx. {MAX_TURN_DURATION}s</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setTurnDuration((v) => Math.max(MIN_TURN_DURATION, v - 15))}
                className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
              >
                −
              </button>
              <span className="w-14 text-center text-white font-black tabular-nums">{turnDuration}s</span>
              <button
                onClick={() => setTurnDuration((v) => Math.min(MAX_TURN_DURATION, v + 15))}
                className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
              >
                +
              </button>
            </div>
          </div>
          {/* Time estimate */}
          {totalPlayers > 0 && (
            <div className="bg-canvas-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">⏱</span>
              <div>
                <p className="text-sm font-bold text-white">
                  {totalPlayers} jugador{totalPlayers !== 1 ? "es" : ""} × {turnDuration}s
                  {" = "}
                  <span className="text-zinc-300">{formatDuration(totalPlayers * turnDuration)}</span>
                  {" "}aproximadamente
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">sin contar el tiempo de recarga del banco</p>
              </div>
            </div>
          )}
        </section>

        {/* Players warning */}
        {teamsWithNoPlayers.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-1">
            <p className="text-xs font-bold text-amber-400">⚠ Equipos sin jugadores registrados</p>
            <p className="text-xs text-amber-300/70">
              {teamsWithNoPlayers.map((t) => t.name).join(", ")} — estos equipos no tendrán turno
            </p>
          </div>
        )}
        {totalPlayers === 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
            <p className="text-xs font-bold text-red-400">
              ✗ No hay jugadores registrados en ningún equipo
            </p>
            <p className="text-xs text-red-300/70 mt-0.5">
              Vuelve al marcador y añade jugadores antes de iniciar esta ronda
            </p>
          </div>
        )}

        {/* Song bank */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Banco de canciones
            </p>
            <span className="text-xs text-zinc-600">{songs.filter((s) => s.title.trim()).length}/{BANK_SIZE}</span>
          </div>

          <div className="space-y-3">
            {songs.map((song, i) => {
              const titleMissing = song.artist.trim() !== "" && song.title.trim() === "";
              return (
                <div key={song.id} className="space-y-1.5">
                  <p className="text-xs text-zinc-600 font-medium">#{i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <input
                        type="text"
                        placeholder="Título *"
                        value={song.title}
                        onChange={(e) => updateSong(song.id, "title", e.target.value)}
                        className={`w-full bg-canvas-800/80 border rounded-xl px-3 py-2 text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors ${
                          titleMissing
                            ? "border-red-500/60 focus:border-red-400"
                            : "border-canvas-700/60 focus:border-zinc-500"
                        }`}
                      />
                      {titleMissing && (
                        <p className="text-[10px] text-red-400 font-medium px-1">Título obligatorio</p>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Artista"
                      value={song.artist}
                      onChange={(e) => updateSong(song.id, "artist", e.target.value)}
                      className="bg-canvas-800/80 border border-canvas-700/60 rounded-xl px-3 py-2 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button
          onClick={() => onStart({ songs: songs.filter((s) => s.title.trim()), turnDuration })}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            canStart
              ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 shadow-lg shadow-black/20"
              : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {totalPlayers === 0
            ? "Sin jugadores registrados"
            : !allFilled
            ? `Rellena las ${BANK_SIZE} canciones`
            : "¡Empezar Ronda 5! ⚡"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
