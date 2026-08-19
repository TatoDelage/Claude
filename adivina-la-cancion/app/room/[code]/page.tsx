"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  claimRemotePlayer,
  getRemoteRoomByCode,
  pressRemoteBuzzer,
  submitRemoteDuelOrder,
  RemoteRoom,
} from "@/lib/supabaseRest";

const DEVICE_TOKEN_KEY = "adivina_device_token";
const PLAYER_KEY_PREFIX = "adivina_claimed_player_";
const DUEL_SENT_PREFIX = "adivina_duel_order_sent_";

function getDeviceToken() {
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = String(params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedPlayerId, setClaimedPlayerId] = useState<string | null>(null);
  const [pressing, setPressing] = useState(false);
  const [pressMessage, setPressMessage] = useState<string | null>(null);
  const [duelOrder, setDuelOrder] = useState<string[]>([]);
  const [duelSending, setDuelSending] = useState(false);
  const [duelSent, setDuelSent] = useState(false);

  useEffect(() => {
    setClaimedPlayerId(localStorage.getItem(`${PLAYER_KEY_PREFIX}${code}`));
    setDuelSent(localStorage.getItem(`${DUEL_SENT_PREFIX}${code}`) === "1");
  }, [code]);

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
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar la partida");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = window.setInterval(load, 500);
    return () => { cancelled = true; window.clearInterval(interval); };
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

  const claimedPlayer = room?.players.find((player) => player.id === claimedPlayerId) ?? null;
  const myTeamPlayers = claimedPlayer ? room?.players.filter((p) => p.team_number === claimedPlayer.team_number) ?? [] : [];
  const buzzerWinner = room?.game.buzzer_winner_player_id ? room.players.find((p) => p.id === room.game.buzzer_winner_player_id) ?? null : null;
  const gameStarted = room?.game.status === "playing";
  const isDuelRound = room?.game.current_round === 3;
  const allowed = room?.game.buzzer_allowed_player_ids ?? [];
  const canBuzz = Boolean(isDuelRound && claimedPlayerId && allowed.includes(claimedPlayerId) && room?.game.buzzer_open);

  useEffect(() => {
    if (isDuelRound && claimedPlayer?.is_captain && duelOrder.length === 0 && myTeamPlayers.length) {
      setDuelOrder(myTeamPlayers.map((p) => p.id));
    }
  }, [isDuelRound, claimedPlayer?.is_captain, myTeamPlayers.length, duelOrder.length]);

  const handleClaim = async (playerId: string) => {
    setClaimingId(playerId); setClaimError(null);
    try {
      await claimRemotePlayer(code, playerId, getDeviceToken());
      localStorage.setItem(`${PLAYER_KEY_PREFIX}${code}`, playerId);
      setClaimedPlayerId(playerId);
      const nextRoom = await getRemoteRoomByCode(code); if (nextRoom) setRoom(nextRoom);
    } catch (err) { setClaimError(err instanceof Error ? err.message : "No se pudo elegir jugador"); }
    finally { setClaimingId(null); }
  };

  const moveDuelPlayer = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= duelOrder.length) return;
    setDuelOrder((prev) => {
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  };

  const sendDuelOrder = async () => {
    if (!claimedPlayerId) return;
    setDuelSending(true); setClaimError(null);
    try {
      await submitRemoteDuelOrder(code, claimedPlayerId, getDeviceToken(), duelOrder);
      localStorage.setItem(`${DUEL_SENT_PREFIX}${code}`, "1");
      setDuelSent(true);
    } catch (err) { setClaimError(err instanceof Error ? err.message : "No se pudo enviar el orden"); }
    finally { setDuelSending(false); }
  };

  const handlePress = async () => {
    if (!claimedPlayerId || pressing || !canBuzz) return;
    setPressing(true); setPressMessage(null);
    try {
      const result = await pressRemoteBuzzer(code, claimedPlayerId, getDeviceToken());
      setPressMessage(result.won ? "¡Has pulsado primero!" : result.winner_name ? `${result.winner_name} ha pulsado antes` : "El pulsador ya estaba cerrado");
      const nextRoom = await getRemoteRoomByCode(code); if (nextRoom) setRoom(nextRoom);
    } catch (err) { setPressMessage(err instanceof Error ? err.message : "No se pudo registrar el pulsador"); }
    finally { setPressing(false); }
  };

  if (loading) return <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center">Cargando partida…</main>;
  if (error || !room) return (
    <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <p className="text-rose-400 font-bold">{error ?? "No se pudo cargar la partida"}</p>
        <button onClick={() => router.push("/join")} className="w-full py-3 rounded-xl bg-white text-zinc-900 font-bold">Probar otro código</button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sala</p>
          <h1 className="text-4xl font-black tracking-[0.18em] mt-1">{room.game.join_code}</h1>
          <p className="text-sm text-zinc-500 mt-2">{gameStarted ? `Ronda ${room.game.current_round ?? 1} en curso` : "Esperando a que el presentador empiece"}</p>
        </div>

        {claimedPlayer ? (
          <section className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-emerald-500">Estás conectado como</p>
            <h2 className="text-2xl font-black mt-1">{claimedPlayer.display_name}</h2>
            <p className="text-sm text-zinc-400 mt-1">Equipo {claimedPlayer.team_number}{claimedPlayer.is_captain ? " · 👑 Capitán" : " · Jugador"}</p>
          </section>
        ) : (
          <section className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4 text-center">
            <p className="font-black">¿Quién eres?</p>
            <p className="text-xs text-zinc-500 mt-1">Elige tu jugador para vincular este móvil a la partida.</p>
          </section>
        )}

        {claimedPlayer && !gameStarted && (
          <section className="rounded-2xl border border-canvas-700 bg-canvas-900 px-5 py-6 text-center">
            <p className="text-lg font-black text-zinc-300">Estás dentro</p><p className="text-sm text-zinc-500 mt-1">Espera a que el presentador empiece la partida.</p>
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && claimedPlayer.is_captain && !duelSent && (
          <section className="rounded-2xl border border-amber-700/50 bg-amber-950/15 p-4 space-y-4">
            <div><p className="text-xs uppercase tracking-widest text-amber-500">Duelos · orden secreto</p><p className="font-black mt-1">Ordena a tu equipo</p><p className="text-xs text-zinc-500 mt-1">Los rivales no verán este orden hasta que todos hayan enviado el suyo.</p></div>
            <div className="space-y-2">
              {duelOrder.map((id, index) => {
                const player = myTeamPlayers.find((p) => p.id === id);
                return <div key={id} className="flex items-center gap-3 rounded-xl bg-canvas-800 px-3 py-2.5">
                  <span className="w-6 text-center font-black text-amber-400">{index + 1}</span>
                  <span className="flex-1 font-semibold">{player?.display_name}</span>
                  <button onClick={() => moveDuelPlayer(index, -1)} disabled={index === 0} className="px-2 py-1 rounded bg-canvas-700 disabled:opacity-30">↑</button>
                  <button onClick={() => moveDuelPlayer(index, 1)} disabled={index === duelOrder.length - 1} className="px-2 py-1 rounded bg-canvas-700 disabled:opacity-30">↓</button>
                </div>;
              })}
            </div>
            <button onClick={sendDuelOrder} disabled={duelSending} className="w-full py-3 rounded-xl bg-white text-zinc-900 font-black disabled:opacity-50">{duelSending ? "Enviando…" : "Confirmar orden"}</button>
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && claimedPlayer.is_captain && duelSent && !canBuzz && (
          <section className="rounded-2xl border border-emerald-800/50 bg-emerald-950/15 p-5 text-center"><p className="font-black text-emerald-300">Orden enviado ✓</p><p className="text-sm text-zinc-500 mt-1">Espera a que el presentador revele los duelos.</p></section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && canBuzz && (
          <section className="rounded-3xl border border-rose-700/60 bg-rose-950/20 p-4">
            <p className="text-center text-xs uppercase tracking-widest text-rose-300 mb-3">Tu duelo está activo</p>
            <button onClick={handlePress} disabled={pressing} className="w-full min-h-44 rounded-3xl bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-white text-4xl font-black shadow-xl disabled:opacity-70">{pressing ? "..." : "PULSAR"}</button>
            {pressMessage && <p className="text-sm text-center mt-3 text-zinc-300">{pressMessage}</p>}
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && !canBuzz && buzzerWinner && allowed.includes(claimedPlayer.id) && (
          <section className="rounded-2xl bg-canvas-900 border border-canvas-700 px-4 py-6 text-center"><p className="text-xs uppercase tracking-widest text-zinc-500">Primero en pulsar</p><p className="text-2xl font-black mt-1">{buzzerWinner.display_name}</p></section>
        )}

        {claimedPlayer && gameStarted && !isDuelRound && (
          <section className="rounded-2xl border border-canvas-700 bg-canvas-900 px-5 py-6 text-center"><p className="text-lg font-black text-zinc-400">Esperando al presentador</p><p className="text-xs text-zinc-600 mt-1">Aquí aparecerán tus acciones cuando la ronda las necesite.</p></section>
        )}

        {claimError && <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300 text-center">{claimError}</div>}

        <div className="grid gap-4">
          {teams.map((team) => (
            <section key={team.number} className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4">
              <div className="flex items-center justify-between mb-3"><h2 className="font-black text-lg">{team.name}</h2><span className="text-xs text-zinc-500">{team.players.length} jugadores</span></div>
              <div className="space-y-2">
                {team.players.map((player) => {
                  const isMe = player.id === claimedPlayerId;
                  return <div key={player.id} className={`rounded-xl px-3 py-2.5 ${isMe ? "bg-emerald-950/40 border border-emerald-700/50" : "bg-canvas-800"}`}>
                    <div className="flex items-center justify-between gap-3"><div><span className="font-medium">{player.display_name}</span>{player.is_captain && <span className="ml-2">👑</span>}</div>
                    {player.device_active ? <span className={`text-xs ${isMe ? "text-emerald-300" : "text-emerald-500"}`}>● {isMe ? "tú" : "conectado"}</span> : !claimedPlayer ? <button onClick={() => handleClaim(player.id)} disabled={claimingId !== null} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 disabled:opacity-50">{claimingId === player.id ? "Entrando…" : "Soy yo"}</button> : null}</div>
                  </div>;
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="text-center text-xs text-zinc-600">La sala se actualiza automáticamente.</p>
      </div>
    </main>
  );
}
