"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import {
  SongEntry,
  Round3Setup,
  emptySongs,
  SONGS_TOTAL,
  DEFAULT_RESPONSE_DURATION,
} from "@/lib/round3";

const TEAM_ACCENT: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
};

const TEAM_TEXT: Record<string, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
};

function DurationControl({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onChange(Math.max(min, value - 5))}
          className="w-8 h-8 rounded-lg bg-canvas-800 hover:bg-canvas-700 text-white font-bold text-lg transition-colors active:scale-95"
        >
          −
        </button>
        <span className="w-12 text-center text-white font-black tabular-nums">
          {value}s
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 5))}
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
  onStart: (setup: Round3Setup) => void;
}) {
  const [responseDuration, setResponseDuration] = useState(DEFAULT_RESPONSE_DURATION);
  const [songs, setSongs] = useState<SongEntry[]>(emptySongs);
  const [reserveSong, setReserveSong] = useState<SongEntry>({ title: "", artist: "" });

  const updateSong = (index: number, field: keyof SongEntry, value: string) => {
    setSongs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const allComplete = songs.every((s) => s.title.trim() || s.artist.trim());

  const handleStart = () => {
    onStart({ responseDuration, songs, reserveSong });
  };

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 3 · Preparación
        </p>
        <h1 className="text-2xl font-black">Introduce las canciones</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {SONGS_TOTAL} canciones compartidas + 1 de reserva
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-6 max-w-2xl mx-auto w-full">
        {/* Scoring + mechanic reminder */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Mecánica
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Suena una canción. El equipo que pulsa primero responde. Si falla, los rivales pueden intentar el rebote.
          </p>
          <div className="flex gap-3 text-sm pt-1">
            <div className="flex-1 text-center bg-green-500/10 border border-green-500/20 rounded-xl py-2.5">
              <p className="font-black text-green-400 text-xl">+20</p>
              <p className="text-zinc-500 text-xs mt-0.5">Acierto</p>
            </div>
            <div className="flex-1 text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2.5">
              <p className="font-black text-red-400 text-xl">−10</p>
              <p className="text-zinc-500 text-xs mt-0.5">Fallo</p>
            </div>
            <div className="flex-1 text-center bg-canvas-800 border border-canvas-700 rounded-xl py-2.5">
              <p className="font-black text-zinc-300 text-sm">Rebote</p>
              <p className="text-zinc-500 text-xs mt-0.5">Rivales pueden robar</p>
            </div>
          </div>
          {/* Team color reference */}
          <div className="flex gap-2 flex-wrap pt-1">
            {teams.map((team) => (
              <span
                key={team.id}
                className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${TEAM_ACCENT[team.color]}`}
              >
                {team.name}
              </span>
            ))}
          </div>
        </section>

        {/* Timer config */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Tiempos</p>
          <DurationControl
            label="Respuesta"
            hint="Tiempo para responder tras pulsar el botón"
            value={responseDuration}
            onChange={setResponseDuration}
            min={5}
            max={60}
          />
        </section>

        {/* Songs */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Canciones
          </p>
          {songs.map((song, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs text-zinc-500 font-medium">Canción {i + 1}</p>
              <input
                type="text"
                placeholder="Título"
                value={song.title}
                onChange={(e) => updateSong(i, "title", e.target.value)}
                className="w-full bg-canvas-800/80 border border-canvas-700/60 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Artista"
                value={song.artist}
                onChange={(e) => updateSong(i, "artist", e.target.value)}
                className="w-full bg-canvas-800/80 border border-canvas-700/60 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          ))}

          {/* Reserve song */}
          <div className="border-t border-canvas-700/40 pt-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🔄</span>
              <div>
                <p className="text-xs font-bold text-zinc-400">Canción de reserva</p>
                <p className="text-xs text-zinc-600">
                  Solo se usa si se activa el comodín «Otra canción» · Opcional
                </p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Título (opcional)"
              value={reserveSong.title}
              onChange={(e) => setReserveSong({ ...reserveSong, title: e.target.value })}
              className="w-full bg-canvas-800/80 border border-canvas-700/40 rounded-xl px-3 py-2.5 text-white placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <input
              type="text"
              placeholder="Artista (opcional)"
              value={reserveSong.artist}
              onChange={(e) => setReserveSong({ ...reserveSong, artist: e.target.value })}
              className="w-full bg-canvas-800/80 border border-canvas-700/40 rounded-xl px-3 py-2.5 text-white placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </section>

        <button
          onClick={handleStart}
          disabled={!allComplete}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            allComplete
              ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 shadow-lg shadow-black/20"
              : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {allComplete ? "¡Empezar Ronda 3! 🔔" : "Rellena todas las canciones"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
