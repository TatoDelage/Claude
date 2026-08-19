"use client";

import { useEffect, useMemo, useState } from "react";
import { getRemoteRoomByCode, RemoteRoom, startRemoteGame } from "@/lib/supabaseRest";

interface HostLobbyProps {
  onStarted: () => void;
}

export default function HostLobby({ onStarted }: HostLobbyProps) {
  const [code, setCode] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-3xl border border-canvas-700 bg-canvas-900 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Lobby</p>
        <h1 className="text-3xl font-black mt-2">Todo preparado</h1>
        <p className="text-sm text-zinc-500 mt-2">Los jugadores pueden entrar con el código de sala antes de empezar.</p>

        <div className="mt-6 rounded-2xl bg-canvas-800 p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Código de sala</p>
          <p className="text-4xl font-black tracking-[0.2em] text-emerald-400 mt-1">{code ?? "------"}</p>
          <p className="text-xs text-zinc-500 mt-3">{connected} de {total || "…"} jugadores conectados</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <section key={team.number} className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black">{team.name}</h2>
              <span className="text-xs text-zinc-500">{team.players.filter((p) => p.device_active).length}/{team.players.length}</span>
            </div>
            <div className="space-y-2">
              {team.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-xl bg-canvas-800 px-3 py-2.5">
                  <span className="text-sm font-medium">
                    {player.display_name}{player.is_captain ? " 👑" : ""}
                  </span>
                  <span className={`text-xs ${player.device_active ? "text-emerald-400" : "text-zinc-600"}`}>
                    {player.device_active ? "● conectado" : "○ esperando"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!code || !hostToken || starting}
        className="w-full rounded-2xl bg-white py-4 text-lg font-black text-zinc-900 active:scale-[0.99] transition-all disabled:opacity-40"
      >
        {starting ? "Empezando…" : "Empezar partida"}
      </button>

      <p className="text-xs text-zinc-600 text-center">No hace falta que todos tengan móvil conectado para empezar.</p>
    </div>
  );
}
