"use client";

import { useEffect, useMemo, useState } from "react";
import { getRemoteRoomByCode, RemoteRoom, startRemoteGame } from "@/lib/supabaseRest";

interface HostLobbyProps {
  onStarted: () => void;
}

const TEAM_STYLES = [
  "border-violet-700/40 bg-violet-950/20",
  "border-amber-700/40 bg-amber-950/20",
  "border-sky-700/40 bg-sky-950/20",
  "border-rose-700/40 bg-rose-950/20",
];

const TEAM_DOTS = ["bg-violet-400", "bg-amber-400", "bg-sky-400", "bg-rose-400"];

export default function HostLobby({ onStarted }: HostLobbyProps) {
  const [code, setCode] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(localStorage.getItem("adivina_join_code"));
    setHostToken(localStorage.getItem("adivina_host_token"));
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const load = async () => {
      try {
        const nextRoom = await getRemoteRoomByCode(code);
        if (!cancelled && nextRoom) setRoom(nextRoom);
      } catch {
        // El lobby local sigue siendo usable aunque falle una lectura puntual.
      }
    };

    load();
    const interval = window.setInterval(load, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [code]);

  const teams = useMemo(() => {
    if (!room) return [];
    const count = room.game.settings?.teamCount ?? Math.max(0, ...room.players.map((p) => p.team_number ?? 0));
    const names = room.game.settings?.teamNames ?? [];
    return Array.from({ length: count }, (_, index) => ({
      number: index + 1,
      name: names[index] || `Equipo ${index + 1}`,
      players: room.players.filter((p) => p.team_number === index + 1),
    }));
  }, [room]);

  const connected = room?.players.filter((p) => p.device_active).length ?? 0;
  const total = room?.players.length ?? 0;

  const handleCopyJoin = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleStart = async () => {
    if (!code || !hostToken || starting) return;
    setStarting(true);
    setError(null);
    try {
      await startRemoteGame(code, hostToken);
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo empezar la partida");
      setStarting(false);
    }
  };

  return (
    <div className="game-stage max-w-3xl mx-auto px-4 py-10 space-y-7">
      <section className="game-panel rounded-[2rem] p-7 sm:p-9 text-center overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/50 to-transparent" />
        <p className="game-kicker">Lobby</p>
        <h1 className="game-title text-4xl sm:text-5xl mt-3">La partida está lista</h1>
        <p className="game-muted text-sm sm:text-base mt-3 max-w-md mx-auto">
          Los jugadores entran desde su móvil, eligen su nombre y esperan aquí al resto.
        </p>

        <div className="mt-8 mx-auto max-w-md rounded-3xl border border-gold-300/20 bg-black/15 px-5 py-6">
          <p className="text-[10px] uppercase tracking-[0.28em] font-black text-gold-300/70">Código de sala</p>
          <p className="text-5xl sm:text-6xl font-black tracking-[0.18em] text-cream-50 mt-2 drop-shadow-lg">{code ?? "------"}</p>
          <p className="text-xs game-muted mt-4">Entra en <span className="text-cream-100 font-black">/join</span> y escribe este código.</p>
          <button
            onClick={handleCopyJoin}
            className="mt-3 px-4 py-2 rounded-xl border border-canvas-600 bg-black/15 text-xs font-black text-cream-100 active:scale-95 transition-all"
          >
            {copied ? "Enlace copiado ✓" : "Copiar enlace para jugadores"}
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs game-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.45)]" />
            {connected} de {total || "…"} jugadores conectados
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team, index) => (
          <section key={team.number} className={`rounded-3xl border p-5 ${TEAM_STYLES[index] ?? "border-canvas-700 bg-canvas-900"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${TEAM_DOTS[index] ?? "bg-cream-200"}`} />
                <h2 className="font-black text-lg text-cream-50">{team.name}</h2>
              </div>
              <span className="text-xs game-muted">{team.players.filter((p) => p.device_active).length}/{team.players.length}</span>
            </div>
            <div className="space-y-2">
              {team.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl bg-black/15 border border-white/[0.035] px-3.5 py-3">
                  <span className="text-sm font-bold text-cream-100">
                    {player.display_name}{player.is_captain ? "  👑" : ""}
                  </span>
                  <span className={`text-[11px] font-bold ${player.device_active ? "text-emerald-300" : "text-zinc-600"}`}>
                    {player.device_active ? "● conectado" : "○ esperando"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {error && <p className="text-sm text-rose-300 text-center">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!code || !hostToken || starting}
        className="game-primary w-full rounded-2xl py-4.5 text-lg font-black transition-all"
      >
        {starting ? "Empezando…" : "Empezar partida"}
      </button>

      <p className="text-xs game-muted text-center">No hace falta que todos tengan móvil conectado para empezar.</p>
    </div>
  );
}
