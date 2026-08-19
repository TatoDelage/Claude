"use client";

import { useEffect, useMemo, useState } from "react";
import {
  closeRemoteBuzzer,
  getRemoteRoomByCode,
  openRemoteBuzzer,
  RemoteRoom,
} from "@/lib/supabaseRest";

export default function RemoteBuzzerHost() {
  const [code, setCode] = useState<string | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [busy, setBusy] = useState(false);
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
        // The local game should remain usable even if remote polling fails.
      }
    };

    load();
    const interval = window.setInterval(load, 500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [code]);

  const winner = useMemo(() => {
    const id = room?.game.buzzer_winner_player_id;
    return id ? room?.players.find((player) => player.id === id) ?? null : null;
  }, [room]);

  if (!code || !hostToken) return null;

  const handleOpen = async () => {
    setBusy(true);
    setError(null);
    try {
      await openRemoteBuzzer(code, hostToken);
      const nextRoom = await getRemoteRoomByCode(code);
      if (nextRoom) setRoom(nextRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el pulsador");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    setError(null);
    try {
      await closeRemoteBuzzer(code, hostToken);
      const nextRoom = await getRemoteRoomByCode(code);
      if (nextRoom) setRoom(nextRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el pulsador");
    } finally {
      setBusy(false);
    }
  };

  const isOpen = room?.game.buzzer_open ?? false;

  return (
    <section className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Pulsador remoto</p>
          <p className="font-black text-white mt-0.5">
            {isOpen ? "🟢 ABIERTO" : winner ? "🔴 RESPUESTA BLOQUEADA" : "⚪ CERRADO"}
          </p>
        </div>
        <span className="text-xs text-zinc-500 tracking-widest">{code}</span>
      </div>

      {winner ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-5 text-center">
          <p className="text-xs uppercase tracking-widest text-amber-400">Ha pulsado primero</p>
          <p className="text-3xl font-black mt-1">{winner.display_name}</p>
          <p className="text-sm text-zinc-400 mt-1">Equipo {winner.team_number}</p>
        </div>
      ) : isOpen ? (
        <div className="rounded-xl bg-emerald-950/30 border border-emerald-800/50 px-4 py-3 text-sm text-emerald-300 text-center">
          Esperando al primer jugador…
        </div>
      ) : (
        <div className="rounded-xl bg-canvas-800 px-4 py-3 text-sm text-zinc-400 text-center">
          Abre el pulsador cuando empiece la canción.
        </div>
      )}

      {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleOpen}
          disabled={busy || isOpen}
          className="rounded-xl bg-white text-zinc-900 py-3 font-black disabled:opacity-40 active:scale-95 transition-all"
        >
          {winner ? "Nueva pregunta" : "Abrir"}
        </button>
        <button
          onClick={handleClose}
          disabled={busy || !isOpen}
          className="rounded-xl bg-canvas-800 text-zinc-300 py-3 font-bold disabled:opacity-40 active:scale-95 transition-all"
        >
          Cerrar
        </button>
      </div>
    </section>
  );
}
