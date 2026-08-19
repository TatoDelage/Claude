"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import {
  closeRemoteBuzzer,
  getRemoteDuelOrders,
  getRemoteRoomByCode,
  openDuelBuzzer,
  RemoteRoom,
  DuelOrderRow,
} from "@/lib/supabaseRest";

type Phase = "waiting" | "duels" | "final" | "results";

export default function Round3Content() {
  const router = useRouter();
  const { game, hydrated, setGame, adjustScore } = useGame();
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [orders, setOrders] = useState<DuelOrderRow[]>([]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [duelIndex, setDuelIndex] = useState(0);
  const [duelWins, setDuelWins] = useState<Record<number, number>>({});
  const [duelWinners, setDuelWinners] = useState<string[]>([]);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [duelStarted, setDuelStarted] = useState(false);
  const [directPlayerId, setDirectPlayerId] = useState<string | null>(null);
  const [finalEligible, setFinalEligible] = useState<string[]>([]);
  const [roundWinnerTeam, setRoundWinnerTeam] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = typeof window !== "undefined" ? localStorage.getItem("adivina_join_code") : null;
  const hostToken = typeof window !== "undefined" ? localStorage.getItem("adivina_host_token") : null;

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 3) router.replace("/game");
  }, [hydrated, game, router]);

  useEffect(() => {
    if (!code || !hostToken) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [nextRoom, nextOrders] = await Promise.all([getRemoteRoomByCode(code), getRemoteDuelOrders(code, hostToken)]);
        if (!cancelled) { if (nextRoom) setRoom(nextRoom); setOrders(nextOrders); }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo sincronizar Duelos"); }
    };
    load();
    const timer = window.setInterval(load, 500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [code, hostToken]);

  const teamCount = game?.teams.length ?? 0;
  const allSubmitted = orders.length === teamCount && teamCount >= 2;
  const duelCount = orders.length ? Math.min(...orders.map((o) => o.ordered_player_ids.length)) : 0;
  const unequalTeams = orders.length > 1 && new Set(orders.map((o) => o.ordered_player_ids.length)).size > 1;

  const orderedParticipants = useMemo(() => {
    if (!room || orders.length === 0) return [] as string[][];
    return Array.from({ length: duelCount }, (_, position) => orders.map((order) => order.ordered_player_ids[position]).filter(Boolean));
  }, [room, orders, duelCount]);

  const currentParticipants = orderedParticipants[duelIndex] ?? [];
  const currentEligible = currentParticipants.filter((id) => !eliminated.includes(id));
  const currentWinnerId = duelStarted && room?.game.buzzer_winner_player_id && currentParticipants.includes(room.game.buzzer_winner_player_id)
    ? room.game.buzzer_winner_player_id : null;
  const currentWinner = currentWinnerId ? room?.players.find((p) => p.id === currentWinnerId) ?? null : null;
  const directPlayer = directPlayerId ? room?.players.find((p) => p.id === directPlayerId) ?? null : null;

  if (!hydrated || !game) return null;

  const teamName = (teamNumber: number | null) => teamNumber ? game.teams[teamNumber - 1]?.name ?? `Equipo ${teamNumber}` : "Equipo";
  const playerName = (id: string) => room?.players.find((p) => p.id === id)?.display_name ?? "Jugador";

  const revealDuels = () => { if (allSubmitted) setPhase("duels"); };

  const openCurrentDuel = async (ids = currentEligible) => {
    if (!code || !hostToken || ids.length < 2) return;
    setBusy(true); setError(null);
    try { await openDuelBuzzer(code, hostToken, ids); setDuelStarted(true); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir el duelo"); }
    finally { setBusy(false); }
  };

  const addDuelWin = (playerId: string) => {
    const player = room?.players.find((p) => p.id === playerId);
    if (!player?.team_number) return;
    setDuelWins((prev) => ({ ...prev, [player.team_number!]: (prev[player.team_number!] ?? 0) + 1 }));
    setDuelWinners((prev) => [...prev, playerId]);
  };

  const advanceDuel = (winnerId?: string) => {
    if (winnerId) addDuelWin(winnerId);
    setEliminated([]); setDirectPlayerId(null); setDuelStarted(false);
    if (duelIndex + 1 >= duelCount) {
      window.setTimeout(() => finishDuelStage(winnerId), 0);
    } else setDuelIndex((i) => i + 1);
  };

  const finishDuelStage = (lastWinnerId?: string) => {
    const wins = { ...duelWins };
    const winners = [...duelWinners];
    if (lastWinnerId) {
      const player = room?.players.find((p) => p.id === lastWinnerId);
      if (player?.team_number) wins[player.team_number] = (wins[player.team_number] ?? 0) + 1;
      winners.push(lastWinnerId);
    }
    const entries = game.teams.map((_, i) => [i + 1, wins[i + 1] ?? 0] as const);
    const max = Math.max(...entries.map(([, value]) => value));
    const tied = entries.filter(([, value]) => value === max).map(([team]) => team);
    if (tied.length === 1) awardRound(tied[0]);
    else {
      const survivors = winners.filter((id) => tied.includes(room?.players.find((p) => p.id === id)?.team_number ?? -1));
      setFinalEligible(survivors);
      setPhase("final");
      setDuelStarted(false);
    }
  };

  const markBuzzCorrect = () => { if (currentWinnerId) advanceDuel(currentWinnerId); };

  const markBuzzWrong = async () => {
    if (!currentWinnerId || !code || !hostToken) return;
    await closeRemoteBuzzer(code, hostToken).catch(() => {});
    const remaining = currentEligible.filter((id) => id !== currentWinnerId);
    setEliminated((prev) => [...prev, currentWinnerId]);
    setDuelStarted(false);
    if (remaining.length === 0) advanceDuel();
    else if (remaining.length === 1) setDirectPlayerId(remaining[0]);
  };

  const directAnswer = (correct: boolean) => {
    if (!directPlayerId) return;
    advanceDuel(correct ? directPlayerId : undefined);
  };

  const awardRound = (teamNumber: number) => {
    if (roundWinnerTeam) return;
    const team = game.teams[teamNumber - 1];
    if (team) adjustScore(team.id, 100);
    setRoundWinnerTeam(teamNumber); setPhase("results");
  };

  const openFinal = async () => {
    if (!code || !hostToken || finalEligible.length < 2) return;
    setBusy(true); setError(null);
    try { await openDuelBuzzer(code, hostToken, finalEligible); setDuelStarted(true); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir el Duelo Final"); }
    finally { setBusy(false); }
  };

  const finalWinnerId = phase === "final" && duelStarted && room?.game.buzzer_winner_player_id && finalEligible.includes(room.game.buzzer_winner_player_id)
    ? room.game.buzzer_winner_player_id : null;
  const finalWinner = finalWinnerId ? room?.players.find((p) => p.id === finalWinnerId) ?? null : null;

  const finalAnswer = async (correct: boolean) => {
    if (!finalWinnerId || !code || !hostToken) return;
    const player = room?.players.find((p) => p.id === finalWinnerId);
    if (correct && player?.team_number) { awardRound(player.team_number); return; }
    await closeRemoteBuzzer(code, hostToken).catch(() => {});
    const remaining = finalEligible.filter((id) => id !== finalWinnerId);
    setFinalEligible(remaining); setDuelStarted(false);
    const teamsRemaining = [...new Set(remaining.map((id) => room?.players.find((p) => p.id === id)?.team_number).filter(Boolean))] as number[];
    if (teamsRemaining.length === 1) awardRound(teamsRemaining[0]);
  };

  const continueToRound4 = () => {
    const roundStatus = (n: number): RoundStatus => n < 4 ? "completed" : n === 4 ? "active" : "pending";
    const updated: GameState = { ...game, currentRound: 4, rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })) };
    setGame(updated); router.replace("/game");
  };

  if (!code || !hostToken) return <main className="min-h-screen bg-canvas-950 text-white flex items-center justify-center px-4 text-center">Esta partida no tiene conexión remota disponible. Duelos necesita la sala compartida.</main>;

  if (phase === "waiting") return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-2xl mx-auto space-y-6">
      <header><p className="text-xs uppercase tracking-widest text-zinc-500">Ronda 3</p><h1 className="text-3xl font-black mt-1">Duelos</h1><p className="text-zinc-400 mt-2">Cada capitán ordena a su equipo en secreto desde su móvil. Cuando estén todos, se revelan los enfrentamientos.</p></header>
      <div className="space-y-3">{game.teams.map((team, index) => { const order = orders.find((o) => o.team_number === index + 1); return <div key={team.id} className="rounded-2xl border border-canvas-700 bg-canvas-900 p-4 flex items-center justify-between"><div><p className="font-black">{team.name}</p><p className="text-xs text-zinc-500 mt-1">El capitán decide el orden</p></div><span className={`text-sm font-black ${order ? "text-emerald-400" : "text-amber-400"}`}>{order ? "✓ Enviado" : "Esperando…"}</span></div>; })}</div>
      {unequalTeams && <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">Los equipos tienen distinto número de jugadores. En esta versión se jugarán {duelCount} posiciones, hasta el tamaño del equipo más pequeño.</div>}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
      <button onClick={revealDuels} disabled={!allSubmitted} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black disabled:opacity-30">{allSubmitted ? "Revelar duelos" : `Esperando órdenes (${orders.length}/${teamCount})`}</button>
    </div></main>
  );

  if (phase === "results") return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-2xl mx-auto space-y-6 text-center"><p className="text-xs uppercase tracking-widest text-zinc-500">Duelos completados</p><h1 className="text-4xl font-black">🏆 {roundWinnerTeam ? teamName(roundWinnerTeam) : "Ganador"}</h1><p className="text-zinc-400">+100 puntos por ganar la ronda</p><div className="grid gap-3 text-left">{game.teams.map((team, index) => <div key={team.id} className="rounded-xl border border-canvas-700 bg-canvas-900 px-4 py-3 flex justify-between"><span>{team.name}</span><span className="font-black">{duelWins[index + 1] ?? 0} duelos · {team.score} pts</span></div>)}</div><button onClick={continueToRound4} className="w-full py-4 rounded-2xl bg-white text-zinc-900 font-black">Continuar a Cultura musical →</button></div></main>
  );

  if (phase === "final") return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-2xl mx-auto space-y-6">
      <header className="text-center"><p className="text-xs uppercase tracking-[0.3em] text-amber-500">Empate</p><h1 className="text-4xl font-black mt-2">⚔️ Duelo Final</h1><p className="text-zinc-400 mt-2">Solo sobreviven quienes ganaron su duelo. Fallar elimina al jugador.</p></header>
      <div className="flex flex-wrap justify-center gap-2">{finalEligible.map((id) => <span key={id} className="px-3 py-2 rounded-full bg-canvas-900 border border-canvas-700 font-bold">{playerName(id)}</span>)}</div>
      {!duelStarted ? <button onClick={openFinal} disabled={busy || finalEligible.length < 2} className="w-full py-5 rounded-2xl bg-rose-600 font-black text-xl disabled:opacity-40">Abrir Duelo Final</button> : finalWinner ? <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-6 text-center space-y-4"><p className="text-xs uppercase tracking-widest text-amber-400">Ha pulsado primero</p><p className="text-3xl font-black">{finalWinner.display_name}</p><div className="grid grid-cols-2 gap-3"><button onClick={() => finalAnswer(false)} className="py-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 font-black">Falla · eliminado</button><button onClick={() => finalAnswer(true)} className="py-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 font-black">Acierta · gana</button></div></section> : <div className="rounded-2xl bg-canvas-900 border border-canvas-700 p-6 text-center text-zinc-400">Esperando pulsación…</div>}
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div></main>
  );

  return (
    <main className="min-h-screen bg-canvas-950 text-white px-4 py-8"><div className="max-w-2xl mx-auto space-y-6">
      <header><p className="text-xs uppercase tracking-widest text-zinc-500">Duelos · {duelIndex + 1}/{duelCount}</p><h1 className="text-3xl font-black mt-1">Posición {duelIndex + 1}</h1></header>
      <section className="rounded-2xl border border-canvas-700 bg-canvas-900 p-5"><div className="grid gap-3">{currentParticipants.map((id) => { const p = room?.players.find((x) => x.id === id); const isOut = eliminated.includes(id); return <div key={id} className={`rounded-xl px-4 py-3 flex items-center justify-between ${isOut ? "bg-rose-950/20 opacity-50" : "bg-canvas-800"}`}><div><p className="font-black">{p?.display_name}</p><p className="text-xs text-zinc-500">{teamName(p?.team_number ?? null)}</p></div><span>{isOut ? "Eliminado" : "Listo"}</span></div>; })}</div></section>

      {!duelStarted && !directPlayerId && currentEligible.length >= 2 && <button onClick={() => openCurrentDuel()} disabled={busy} className="w-full py-5 rounded-2xl bg-rose-600 text-xl font-black disabled:opacity-50">Abrir pulsadores</button>}
      {duelStarted && !currentWinner && <div className="rounded-2xl bg-canvas-900 border border-canvas-700 p-6 text-center"><p className="text-xl font-black">Esperando pulsación…</p><p className="text-sm text-zinc-500 mt-1">Solo estos jugadores tienen el botón activo.</p></div>}
      {duelStarted && currentWinner && <section className="rounded-2xl border border-amber-700/50 bg-amber-950/15 p-6 text-center space-y-4"><p className="text-xs uppercase tracking-widest text-amber-400">Ha pulsado primero</p><p className="text-3xl font-black">{currentWinner.display_name}</p><p className="text-sm text-zinc-500">{teamName(currentWinner.team_number)}</p><div className="grid grid-cols-2 gap-3"><button onClick={markBuzzWrong} className="py-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 font-black">Falla</button><button onClick={markBuzzCorrect} className="py-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 font-black">Acierta · gana duelo</button></div></section>}
      {!duelStarted && !directPlayerId && currentEligible.length === 1 && <section className="rounded-2xl border border-amber-700/40 bg-amber-950/15 p-5 text-center space-y-3"><p className="text-sm text-zinc-500">Solo queda un jugador</p><p className="text-2xl font-black">{playerName(currentEligible[0])}</p><div className="grid grid-cols-2 gap-3"><button onClick={() => advanceDuel()} className="py-3 rounded-xl bg-rose-950/50 text-rose-300 font-black">Falla</button><button onClick={() => advanceDuel(currentEligible[0])} className="py-3 rounded-xl bg-emerald-950/50 text-emerald-300 font-black">Acierta</button></div></section>}
      {directPlayer && <section className="rounded-2xl border border-sky-700/40 bg-sky-950/15 p-5 text-center space-y-3"><p className="text-xs uppercase tracking-widest text-sky-400">Oportunidad directa</p><p className="text-2xl font-black">{directPlayer.display_name}</p><p className="text-sm text-zinc-500">El rival falló. Responde sin pulsador.</p><div className="grid grid-cols-2 gap-3"><button onClick={() => directAnswer(false)} className="py-3 rounded-xl bg-rose-950/50 text-rose-300 font-black">Falla</button><button onClick={() => directAnswer(true)} className="py-3 rounded-xl bg-emerald-950/50 text-emerald-300 font-black">Acierta</button></div></section>}

      <section className="grid gap-2">{game.teams.map((team, index) => <div key={team.id} className="rounded-xl bg-canvas-900 border border-canvas-700 px-4 py-3 flex justify-between"><span>{team.name}</span><span className="font-black">{duelWins[index + 1] ?? 0} victorias</span></div>)}</section>
      {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
    </div></main>
  );
}
