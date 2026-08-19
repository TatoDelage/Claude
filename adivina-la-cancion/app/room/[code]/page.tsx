"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRemoteRoomByCode, RemoteRoom } from "@/lib/supabaseRest";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = String(params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextRoom = await getRemoteRoomByCode(code);
        if (cancelled) return;
        if (!nextRoom) {
          setError("La partida no existe o ya no está disponible");
          setRoom(null);
        } else {
          setRoom(nextRoom);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la partida");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 2000);

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
      players: room.players.filter((player) => player.team_number === index + 1),
    }));
  }, [room]);

  if (loading) {
    return <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center">Cargando partida…</main>;
  }

  if (error || !room) {
    return (
      <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-rose-400 font-bold">{error ?? "No se pudo cargar la partida"}</p>
          <button onClick={() => router.push("/join")} className="w-full py-3 rounded-xl bg-white text-zinc-900 font-bold">
            Probar otro código
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sala</p>
          <h1 className="text-4xl font-black tracking-[0.18em] mt-1">{room.game.join_code}</h1>
          <p className="text-sm text-zinc-500 mt-2">
            Estado: <span className="text-zinc-300">{room.game.status ?? "lobby"}</span>
          </p>
        </div>

        <div className="grid gap-4">
          {teams.map((team) => (
            <section key={team.number} className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-lg">{team.name}</h2>
                <span className="text-xs text-zinc-500">{team.players.length} jugadores</span>
              </div>
              <div className="space-y-2">
                {team.players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between rounded-xl bg-canvas-800 px-3 py-2.5">
                    <span className="font-medium">{player.display_name}</span>
                    <div className="flex items-center gap-2 text-xs">
                      {player.is_captain && <span title="Capitán">👑</span>}
                      {player.device_active && <span className="text-emerald-400">● conectado</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-center text-xs text-zinc-600">La sala se actualiza automáticamente.</p>
      </div>
    </main>
  );
}
