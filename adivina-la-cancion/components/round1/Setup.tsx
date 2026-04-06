"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import {
  SongEntry,
  Round1Setup,
  emptySongs,
  buildTurnOrder,
  SONGS_PER_TEAM,
  DEFAULT_FRAGMENT_DURATION,
  DEFAULT_RESPONSE_DURATION,
} from "@/lib/round1";

const TEAM_COLORS: Record<string, string> = {
  violet: "text-violet-300 border-violet-700/50 bg-violet-950/40",
  amber: "text-amber-300 border-amber-700/50 bg-amber-950/40",
  sky: "text-sky-300 border-sky-700/50 bg-sky-950/40",
  rose: "text-rose-300 border-rose-700/50 bg-rose-950/40",
};

const TEAM_ACCENT: Record<string, string> = {
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
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
  onStart: (setup: Round1Setup) => void;
}) {
  const [activeTeam, setActiveTeam] = useState(0);
  const [fragmentDuration, setFragmentDuration] = useState(DEFAULT_FRAGMENT_DURATION);
  const [responseDuration, setResponseDuration] = useState(DEFAULT_RESPONSE_DURATION);
  const [songsByTeam, setSongsByTeam] = useState<Record<string, SongEntry[]>>(
    () => Object.fromEntries(teams.map((t) => [t.id, emptySongs()]))
  );
  const [reserveSongByTeam, setReserveSongByTeam] = useState<Record<string, SongEntry>>(
    () => Object.fromEntries(teams.map((t) => [t.id, { title: "", artist: "" }]))
  );

  const updateSong = (
    teamId: string,
    index: number,
    field: keyof SongEntry,
    value: string
  ) => {
    setSongsByTeam((prev) => ({
      ...prev,
      [teamId]: prev[teamId].map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const updateReserveSong = (teamId: string, field: keyof SongEntry, value: string) => {
    setReserveSongByTeam((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value },
    }));
  };

  // Artist is required in R1 because the "Cantante" wildcard (artist-only) needs it.
  const songComplete = (s: SongEntry) => s.title.trim() !== "" && s.artist.trim() !== "";
  const teamComplete = (teamId: string) => songsByTeam[teamId].every(songComplete);
  const allComplete = teams.every((t) => teamComplete(t.id));

  const handleStart = () => {
    const setup: Round1Setup = {
      fragmentDuration,
      responseDuration,
      songsByTeam,
      reserveSongByTeam,
      turnOrder: buildTurnOrder(teams),
    };
    onStart(setup);
  };

  const currentTeam = teams[activeTeam];
  const songs = songsByTeam[currentTeam.id];
  const colors = TEAM_COLORS[currentTeam.color];
  const accent = TEAM_ACCENT[currentTeam.color];

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Ronda 1 · Preparación
        </p>
        <h1 className="text-2xl font-black">Introduce las canciones</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {SONGS_PER_TEAM} canciones por equipo + 1 de reserva
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-6 max-w-2xl mx-auto w-full">
        {/* Timer config */}
        <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Tiempos
          </p>
          <DurationControl
            label="Fragmento"
            hint="Duración del fragmento de canción"
            value={fragmentDuration}
            onChange={setFragmentDuration}
            min={5}
            max={60}
          />
          <div className="border-t border-canvas-700" />
          <DurationControl
            label="Respuesta"
            hint="Tiempo para responder en equipo"
            value={responseDuration}
            onChange={setResponseDuration}
            min={5}
            max={60}
          />
        </section>

        {/* Team tabs */}
        <div className="flex gap-2">
          {teams.map((team, i) => {
            const done = teamComplete(team.id);
            return (
              <button
                key={team.id}
                onClick={() => setActiveTeam(i)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTeam === i
                    ? `${TEAM_ACCENT[team.color]} text-white shadow-lg`
                    : done
                    ? "bg-canvas-800 text-zinc-300"
                    : "bg-canvas-900 text-zinc-500 border border-canvas-700"
                }`}
              >
                {done && activeTeam !== i ? "✓ " : ""}
                {team.name.split(" ")[0]}
              </button>
            );
          })}
        </div>

        {/* Song inputs for active team */}
        <section className={`border rounded-2xl p-4 space-y-4 ${colors}`}>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
            {currentTeam.name}
          </p>
          {songs.map((song, i) => {
            const artistMissing = song.title.trim() !== "" && song.artist.trim() === "";
            return (
              <div key={i} className="space-y-1.5">
                <p className="text-xs text-zinc-500 font-medium">Canción {i + 1}</p>
                <input
                  type="text"
                  placeholder="Título"
                  value={song.title}
                  onChange={(e) => updateSong(currentTeam.id, i, "title", e.target.value)}
                  className="w-full bg-canvas-900/80 border border-canvas-700/60 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Artista *"
                  value={song.artist}
                  onChange={(e) => updateSong(currentTeam.id, i, "artist", e.target.value)}
                  className={`w-full bg-canvas-900/80 border rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors ${
                    artistMissing
                      ? "border-red-500/60 focus:border-red-400"
                      : "border-canvas-700/60 focus:border-zinc-500"
                  }`}
                />
                {artistMissing && (
                  <p className="text-xs text-red-400 font-medium">
                    El artista es obligatorio · necesario para el comodín 🎤 Cantante
                  </p>
                )}
              </div>
            );
          })}

          {/* Reserve song separator */}
          <div className="border-t border-canvas-700/40 pt-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">🔄</span>
              <div>
                <p className="text-xs font-bold text-zinc-400">Canción de reserva</p>
                <p className="text-xs text-zinc-600">Solo se usa si se activa el comodín «Otra canción» · Opcional</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Título (opcional)"
              value={reserveSongByTeam[currentTeam.id].title}
              onChange={(e) => updateReserveSong(currentTeam.id, "title", e.target.value)}
              className="w-full bg-canvas-900/80 border border-canvas-700/40 rounded-xl px-3 py-2.5 text-white placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <input
              type="text"
              placeholder="Artista (opcional)"
              value={reserveSongByTeam[currentTeam.id].artist}
              onChange={(e) => updateReserveSong(currentTeam.id, "artist", e.target.value)}
              className="w-full bg-canvas-900/80 border border-canvas-700/40 rounded-xl px-3 py-2.5 text-white placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </section>

        {/* Progress summary */}
        <div className="flex gap-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`flex-1 h-1.5 rounded-full ${
                teamComplete(team.id)
                  ? TEAM_ACCENT[team.color]
                  : "bg-canvas-800"
              }`}
            />
          ))}
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!allComplete}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            allComplete
              ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 shadow-lg shadow-black/20"
              : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {allComplete ? "¡Empezar Ronda 1! 🎵" : "Rellena todas las canciones"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
