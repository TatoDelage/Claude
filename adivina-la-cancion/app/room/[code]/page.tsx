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

const TEAM_STYLES = [
  { panel: "border-violet-700/40 bg-violet-950/20", text: "text-violet-200", dot: "bg-violet-400" },
  { panel: "border-amber-700/40 bg-amber-950/20", text: "text-amber-200", dot: "bg-amber-400" },
  { panel: "border-sky-700/40 bg-sky-950/20", text: "text-sky-200", dot: "bg-sky-400" },
  { panel: "border-rose-700/40 bg-rose-950/20", text: "text-rose-200", dot: "bg-rose-400" },
];

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
  const myStyle = claimedPlayer?.team_number ? TEAM_STYLES[claimedPlayer.team_number - 1] ?? TEAM_STYLES[0] : TEAM_STYLES[0];

  useEffect(() => {
    if (isDuelRound && claimedPlayer?.is_captain && duelOrder.length === 0 && myTeamPlayers.length) {
      setDuelOrder(myTeamPlayers.map((p) => p.id));
    }
  }, [isDuelRound, claimedPlayer?.is_captain, myTeamPlayers.length, duelOrder.length]);

  const handleClaim = async (playerId: string) => {
    setClaimingId(playerId);
    setClaimError(null);
    try {
      await claimRemotePlayer(code, playerId, getDeviceToken());
      localStorage.setItem(`${PLAYER_KEY_PREFIX}${code}`, playerId);
      setClaimedPlayerId(playerId);
      const nextRoom = await getRemoteRoomByCode(code);
      if (nextRoom) setRoom(nextRoom);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "No se pudo elegir jugador");
    } finally {
      setClaimingId(null);
    }
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
    setDuelSending(true);
    setClaimError(null);
    try {
      await submitRemoteDuelOrder(code, claimedPlayerId, getDeviceToken(), duelOrder);
      localStorage.setItem(`${DUEL_SENT_PREFIX}${code}`, "1");
      setDuelSent(true);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "No se pudo enviar el orden");
    } finally {
      setDuelSending(false);
    }
  };

  const handlePress = async () => {
    if (!claimedPlayerId || pressing || !canBuzz) return;
    setPressing(true);
    setPressMessage(null);
    try {
      const result = await pressRemoteBuzzer(code, claimedPlayerId, getDeviceToken());
      setPressMessage(result.won ? "¡Has pulsado primero!" : result.winner_name ? `${result.winner_name} ha pulsado antes` : "El pulsador ya estaba cerrado");
      const nextRoom = await getRemoteRoomByCode(code);
      if (nextRoom) setRoom(nextRoom);
    } catch (err) {
      setPressMessage(err instanceof Error ? err.message : "No se pudo registrar el pulsador");
    } finally {
      setPressing(false);
    }
  };

  if (loading) return <main className="game-stage min-h-screen flex items-center justify-center text-cream-100">Cargando partida…</main>;
  if (error || !room) return (
    <main className="game-stage min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <p className="text-rose-300 font-bold">{error ?? "No se pudo cargar la partida"}</p>
        <button onClick={() => router.push("/join")} className="game-primary w-full py-3 rounded-2xl font-black">Probar otro código</button>
      </div>
    </main>
  );

  return (
    <main className="game-stage min-h-screen px-4 py-8 text-cream-50">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <p className="game-kicker">Sala</p>
          <h1 className="game-title text-4xl tracking-[0.16em] mt-2">{room.game.join_code}</h1>
          <p className="game-muted text-sm mt-2">{gameStarted ? `Ronda ${room.game.current_round ?? 1} en curso` : "Esperando al presentador"}</p>
        </header>

        {claimedPlayer ? (
          <section className={`rounded-3xl border p-5 text-center ${myStyle.panel}`}>
            <p className={`text-[10px] uppercase tracking-[0.2em] font-black ${myStyle.text}`}>Estás conectado como</p>
            <h2 className="game-title text-3xl mt-2">{claimedPlayer.display_name}</h2>
            <p className="game-muted text-sm mt-1">Equipo {claimedPlayer.team_number}{claimedPlayer.is_captain ? " · 👑 Capitán" : " · Jugador"}</p>
          </section>
        ) : (
          <section className="game-panel rounded-3xl p-5 text-center">
            <p className="font-black text-lg">¿Quién eres?</p>
            <p className="game-muted text-xs mt-1">Elige tu jugador para vincular este móvil a la partida.</p>
          </section>
        )}

        {claimedPlayer && !gameStarted && (
          <section className="game-panel rounded-3xl px-5 py-7 text-center">
            <div className="mx-auto w-2.5 h-2.5 rounded-full bg-gold-300 shadow-[0_0_18px_rgba(233,198,108,.4)]" />
            <p className="text-xl font-black text-cream-100 mt-4">Estás dentro</p>
            <p className="game-muted text-sm mt-1">Espera a que empiece la partida.</p>
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && claimedPlayer.is_captain && !duelSent && (
          <section className="game-panel rounded-[2rem] p-5 space-y-5 border-gold-300/25">
            <div className="text-center">
              <p className="game-kicker">Duelos · orden secreto</p>
              <p className="game-title text-3xl mt-2">Ordena a tu equipo</p>
              <p className="game-muted text-xs mt-2">Los rivales no verán nada hasta que todos hayan enviado el suyo.</p>
            </div>
            <div className="space-y-2">
              {duelOrder.map((id, index) => {
                const player = myTeamPlayers.find((p) => p.id === id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-2xl bg-black/15 border border-white/[0.035] px-3 py-3">
                    <span className="w-8 h-8 rounded-xl bg-gold-300/10 border border-gold-300/15 flex items-center justify-center font-black text-gold-300">{index + 1}</span>
                    <span className="flex-1 font-black text-cream-100">{player?.display_name}</span>
                    <button onClick={() => moveDuelPlayer(index, -1)} disabled={index === 0} className="w-9 h-9 rounded-xl bg-canvas-700/80 disabled:opacity-20 font-black">↑</button>
                    <button onClick={() => moveDuelPlayer(index, 1)} disabled={index === duelOrder.length - 1} className="w-9 h-9 rounded-xl bg-canvas-700/80 disabled:opacity-20 font-black">↓</button>
                  </div>
                );
              })}
            </div>
            <button onClick={sendDuelOrder} disabled={duelSending} className="game-primary w-full py-3.5 rounded-2xl font-black">{duelSending ? "Enviando…" : "Confirmar orden"}</button>
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && claimedPlayer.is_captain && duelSent && !canBuzz && (
          <section className="rounded-3xl border border-emerald-700/30 bg-emerald-950/20 p-6 text-center">
            <p className="text-lg font-black text-emerald-200">Orden enviado ✓</p>
            <p className="game-muted text-sm mt-1">Espera a que el presentador revele los duelos.</p>
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && canBuzz && (
          <section className="rounded-[2rem] border border-rose-600/45 bg-rose-950/20 p-4 shadow-2xl shadow-rose-950/25">
            <p className="text-center text-[10px] uppercase tracking-[0.24em] font-black text-rose-200 mb-3">Tu duelo está activo</p>
            <button onClick={handlePress} disabled={pressing} className="game-danger w-full min-h-52 rounded-[1.6rem] text-5xl font-black tracking-tight transition-all disabled:opacity-70">{pressing ? "..." : "PULSAR"}</button>
            {pressMessage && <p className="text-sm text-center mt-3 text-cream-100 font-bold">{pressMessage}</p>}
          </section>
        )}

        {claimedPlayer && gameStarted && isDuelRound && !canBuzz && buzzerWinner && allowed.includes(claimedPlayer.id) && (
          <section className="game-panel rounded-3xl px-4 py-7 text-center border-gold-300/20">
            <p className="game-kicker">Primero en pulsar</p>
            <p className="game-title text-3xl mt-2">{buzzerWinner.display_name}</p>
          </section>
        )}

        {claimedPlayer && gameStarted && !isDuelRound && (
          <section className="game-panel rounded-3xl px-5 py-7 text-center">
            <p className="text-lg font-black text-cream-100">Esperando al presentador</p>
            <p className="game-muted text-xs mt-1">Aquí aparecerán tus acciones cuando la ronda las necesite.</p>
          </section>
        )}

        {claimError && <div className="rounded-2xl border border-rose-700/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-200 text-center">{claimError}</div>}

        <div className="grid gap-4">
          {teams.map((team) => {
            const style = TEAM_STYLES[team.number - 1] ?? TEAM_STYLES[0];
            return (
              <section key={team.number} className={`rounded-3xl border p-4 ${style.panel}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} /><h2 className={`font-black text-lg ${style.text}`}>{team.name}</h2></div>
                  <span className="text-xs game-muted">{team.players.length} jugadores</span>
                </div>
                <div className="space-y-2">
                  {team.players.map((player) => {
                    const isMe = player.id === claimedPlayerId;
                    return (
                      <div key={player.id} className={`rounded-2xl px-3 py-3 border ${isMe ? "bg-white/[0.045] border-white/10" : "bg-black/10 border-white/[0.025]"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div><span className="font-bold text-cream-100">{player.display_name}</span>{player.is_captain && <span className="ml-2">👑</span>}</div>
                          {player.device_active ? (
                            <span className={`text-[11px] font-bold ${isMe ? "text-emerald-200" : "text-emerald-400"}`}>● {isMe ? "tú" : "conectado"}</span>
                          ) : !claimedPlayer ? (
                            <button onClick={() => handleClaim(player.id)} disabled={claimingId !== null} className="game-primary rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50">{claimingId === player.id ? "Entrando…" : "Soy yo"}</button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <p className="text-center text-xs game-muted">La sala se actualiza automáticamente.</p>
      </div>
    </main>
  );
}
