"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import {
  closeRemoteBuzzer,
  DuelOrderRow,
  getRemoteDuelOrders,
  getRemoteRoomByCode,
  hostSubmitRemoteDuelOrder,
  openDuelBuzzer,
  RemoteRoom,
} from "@/lib/supabaseRest";

const BUZZ_SECONDS = 15;
const ANSWER_SECONDS = 8;
const POINTS_PER_DUEL = 20;
const CHAMPION_BONUS = 40;

type Phase = "waiting" | "duels" | "final" | "results";

const TEAM_STYLE: Record<string, { panel: string; text: string; dot: string }> = {
  violet: { panel: "border-violet-600/45 bg-violet-950/30", text: "text-violet-200", dot: "bg-violet-400" },
  amber: { panel: "border-amber-600/45 bg-amber-950/25", text: "text-amber-200", dot: "bg-amber-400" },
  sky: { panel: "border-sky-600/45 bg-sky-950/25", text: "text-sky-200", dot: "bg-sky-400" },
  rose: { panel: "border-rose-600/45 bg-rose-950/25", text: "text-rose-200", dot: "bg-rose-400" },
};

export default function Round3Content() {
  const router = useRouter();
  const { game, hydrated, setGame } = useGame();
  const [room, setRoom] = useState<RemoteRoom | null>(null);
  const [orders, setOrders] = useState<DuelOrderRow[]>([]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [duelIndex, setDuelIndex] = useState(0);
  const [duelWins, setDuelWins] = useState<Record<number, number>>({});
  const [duelWinners, setDuelWinners] = useState<string[]>([]);
  const [stageWins, setStageWins] = useState<Record<number, number>>({});
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [duelStarted, setDuelStarted] = useState(false);
  const [directPlayerId, setDirectPlayerId] = useState<string | null>(null);
  const [finalEligible, setFinalEligible] = useState<string[]>([]);
  const [roundWinnerTeam, setRoundWinnerTeam] = useState<number | null>(null);
  const [buzzTimeLeft, setBuzzTimeLeft] = useState(BUZZ_SECONDS);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [manualOrders, setManualOrders] = useState<Record<number, string[]>>({});
  const [savingTeam, setSavingTeam] = useState<number | null>(null);

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
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo sincronizar Duelos");
      }
    };
    load();
    const timer = window.setInterval(load, 500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [code, hostToken]);

  useEffect(() => {
    if (!room) return;
    setManualOrders((prev) => {
      const next = { ...prev };
      const teamNumbers = [...new Set(room.players.map((player) => player.team_number).filter((value): value is number => Boolean(value)))];
      teamNumbers.forEach((teamNumber) => {
        if (!next[teamNumber]) next[teamNumber] = room.players.filter((player) => player.team_number === teamNumber).sort((a, b) => a.sort_order - b.sort_order).map((player) => player.id);
      });
      return next;
    });
  }, [room]);

  const teamCount = game?.teams.length ?? 0;
  const allSubmitted = orders.length === teamCount && teamCount >= 2;
  const duelCount = orders.length ? Math.min(...orders.map((order) => order.ordered_player_ids.length)) : 0;
  const unequalTeams = orders.length > 1 && new Set(orders.map((order) => order.ordered_player_ids.length)).size > 1;

  const orderedParticipants = useMemo(() => {
    if (!orders.length) return [] as string[][];
    return Array.from({ length: duelCount }, (_, position) => orders.map((order) => order.ordered_player_ids[position]).filter(Boolean));
  }, [orders, duelCount]);

  const currentParticipants = orderedParticipants[duelIndex] ?? [];
  const currentEligible = currentParticipants.filter((id) => !eliminated.includes(id));
  const currentWinnerId = phase === "duels" && duelStarted && room?.game.buzzer_winner_player_id && currentEligible.includes(room.game.buzzer_winner_player_id) ? room.game.buzzer_winner_player_id : null;
  const finalWinnerId = phase === "final" && duelStarted && room?.game.buzzer_winner_player_id && finalEligible.includes(room.game.buzzer_winner_player_id) ? room.game.buzzer_winner_player_id : null;
  const activeWinnerId = phase === "final" ? finalWinnerId : currentWinnerId;

  useEffect(() => { if (activeWinnerId) setAnswerTimeLeft(ANSWER_SECONDS); }, [activeWinnerId]);

  if (!hydrated || !game) return null;

  const teamName = (number: number | null) => number ? game.teams[number - 1]?.name ?? `Equipo ${number}` : "Equipo";
  const playerName = (id: string) => room?.players.find((player) => player.id === id)?.display_name ?? "Jugador";
  const playerTeam = (id: string) => room?.players.find((player) => player.id === id)?.team_number ?? null;

  const saveManualOrder = async (teamNumber: number) => {
    if (!code || !hostToken || !manualOrders[teamNumber]?.length) return;
    setSavingTeam(teamNumber); setError(null);
    try {
      await hostSubmitRemoteDuelOrder(code, hostToken, teamNumber, manualOrders[teamNumber]);
      setOrders(await getRemoteDuelOrders(code, hostToken));
      setEditingTeam(null);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el orden"); }
    finally { setSavingTeam(null); }
  };

  const moveManualPlayer = (teamNumber: number, index: number, delta: number) => {
    setManualOrders((prev) => {
      const order = [...(prev[teamNumber] ?? [])];
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= order.length) return prev;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...prev, [teamNumber]: order };
    });
  };

  const awardRound = (championTeam: number, wins: Record<number, number>) => {
    if (roundWinnerTeam) return;
    setGame({
      ...game,
      teams: game.teams.map((team, index) => {
        const teamNumber = index + 1;
        const earned = (wins[teamNumber] ?? 0) * POINTS_PER_DUEL + (teamNumber === championTeam ? CHAMPION_BONUS : 0);
        return { ...team, score: team.score + earned };
      }),
    });
    setStageWins(wins);
    setRoundWinnerTeam(championTeam);
    setPhase("results");
  };

  const buildFinalists = (tiedTeams: number[], winnerIds: string[]) => {
    return tiedTeams.map((teamNumber) => {
      const winner = [...winnerIds].reverse().find((id) => playerTeam(id) === teamNumber);
      if (winner) return winner;
      return orders.find((order) => order.team_number === teamNumber)?.ordered_player_ids[0];
    }).filter((id): id is string => Boolean(id));
  };

  const finishDuelStage = (wins: Record<number, number>, winners: string[]) => {
    const entries = game.teams.map((_, index) => [index + 1, wins[index + 1] ?? 0] as const);
    const max = Math.max(...entries.map(([, value]) => value));
    const tied = entries.filter(([, value]) => value === max).map(([team]) => team);
    setStageWins(wins);
    if (tied.length === 1) awardRound(tied[0], wins);
    else {
      setFinalEligible(buildFinalists(tied, winners));
      setPhase("final"); setDuelStarted(false); setEliminated([]); setDirectPlayerId(null);
    }
  };

  const advanceDuel = (winnerId?: string) => {
    const wins = { ...duelWins };
    const winners = [...duelWinners];
    if (winnerId) {
      const teamNumber = playerTeam(winnerId);
      if (teamNumber) wins[teamNumber] = (wins[teamNumber] ?? 0) + 1;
      winners.push(winnerId);
    }
    setDuelWins(wins); setDuelWinners(winners); setEliminated([]); setDirectPlayerId(null); setDuelStarted(false); setBuzzTimeLeft(BUZZ_SECONDS); setAnswerTimeLeft(ANSWER_SECONDS);
    if (duelIndex + 1 >= duelCount) finishDuelStage(wins, winners);
    else setDuelIndex((index) => index + 1);
  };

  const openBuzzer = async (ids: string[]) => {
    if (!code || !hostToken || ids.length < 2) return;
    setBusy(true); setError(null);
    try { await openDuelBuzzer(code, hostToken, ids); setBuzzTimeLeft(BUZZ_SECONDS); setAnswerTimeLeft(ANSWER_SECONDS); setDuelStarted(true); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir el pulsador"); }
    finally { setBusy(false); }
  };

  const handleNoBuzz = async () => {
    if (!code || !hostToken) return;
    await closeRemoteBuzzer(code, hostToken).catch(() => {});
    setDuelStarted(false);
    if (phase === "duels") advanceDuel();
  };

  const markBuzzWrong = async () => {
    const winnerId = activeWinnerId;
    if (!winnerId || !code || !hostToken) return;
    await closeRemoteBuzzer(code, hostToken).catch(() => {});
    setDuelStarted(false);

    if (phase === "final") {
      const remaining = finalEligible.filter((id) => id !== winnerId);
      setFinalEligible(remaining);
      const teamsRemaining = [...new Set(remaining.map(playerTeam).filter((value): value is number => Boolean(value)))];
      if (teamsRemaining.length === 1) awardRound(teamsRemaining[0], stageWins);
      else if (remaining.length >= 2) await openBuzzer(remaining);
      return;
    }

    const remaining = currentEligible.filter((id) => id !== winnerId);
    setEliminated((prev) => [...prev, winnerId]);
    if (remaining.length === 0) advanceDuel();
    else if (remaining.length === 1) { setDirectPlayerId(remaining[0]); setAnswerTimeLeft(ANSWER_SECONDS); }
    else await openBuzzer(remaining);
  };

  const markBuzzCorrect = () => {
    if (!activeWinnerId) return;
    if (phase === "final") {
      const teamNumber = playerTeam(activeWinnerId);
      if (teamNumber) awardRound(teamNumber, stageWins);
    } else advanceDuel(activeWinnerId);
  };

  const directAnswer = (correct: boolean) => { if (directPlayerId) advanceDuel(correct ? directPlayerId : undefined); };

  useEffect(() => {
    if (!duelStarted || activeWinnerId || directPlayerId || (phase !== "duels" && phase !== "final")) return;
    if (buzzTimeLeft <= 0) { handleNoBuzz(); return; }
    const timer = window.setTimeout(() => setBuzzTimeLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelStarted, activeWinnerId, directPlayerId, buzzTimeLeft, phase]);

  useEffect(() => {
    if ((!activeWinnerId && !directPlayerId) || answerTimeLeft <= 0) {
      if (answerTimeLeft <= 0 && activeWinnerId) markBuzzWrong();
      if (answerTimeLeft <= 0 && directPlayerId) directAnswer(false);
      return;
    }
    const timer = window.setTimeout(() => setAnswerTimeLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWinnerId, directPlayerId, answerTimeLeft]);

  const continueToRound4 = () => {
    const roundStatus = (n: number): RoundStatus => n < 4 ? "completed" : n === 4 ? "active" : "pending";
    const updated: GameState = { ...game, currentRound: 4, rounds: game.rounds.map((round) => ({ ...round, status: roundStatus(round.number) })) };
    setGame(updated); router.replace("/game");
  };

  if (!code || !hostToken) return <main className="game-stage min-h-screen flex items-center justify-center px-4 text-center">Duelos necesita la sala compartida y los móviles conectados.</main>;

  if (phase === "waiting") return (
    <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-3xl mx-auto space-y-7">
      <header className="text-center"><p className="game-kicker">Ronda 3</p><h1 className="game-title text-5xl mt-3">Duelos</h1><p className="game-muted mt-3">+20 por duelo ganado · +40 al campeón · sin comodines.</p></header>
      {error && <div className="rounded-xl bg-rose-950/30 border border-rose-700/30 p-3 text-rose-300 text-sm">{error}</div>}
      {unequalTeams && <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-amber-300 text-sm">Los equipos tienen distinto número de jugadores. Se jugarán {duelCount} duelos.</div>}
      <div className="grid gap-3 sm:grid-cols-2">{game.teams.map((team, index) => {
        const teamNumber = index + 1; const order = orders.find((item) => item.team_number === teamNumber); const style = TEAM_STYLE[team.color]; const editor = manualOrders[teamNumber] ?? []; const editing = editingTeam === teamNumber;
        return <section key={team.id} className={`rounded-3xl border p-5 ${style.panel} space-y-3`}><div className="flex justify-between"><p className={`font-black ${style.text}`}>{team.name}</p><span className="text-xs font-black">{order ? "✓ ENVIADO" : "ESPERANDO"}</span></div>{!editing ? <button onClick={() => { if (order) setManualOrders((prev) => ({ ...prev, [teamNumber]: [...order.ordered_player_ids] })); setEditingTeam(teamNumber); }} className="w-full py-2 rounded-xl bg-black/15 border border-canvas-600 text-xs font-black">{order ? "Editar orden" : "Configurar orden"}</button> : <div className="space-y-2">{editor.map((id, position) => <div key={id} className="flex items-center gap-2 rounded-xl bg-black/15 p-2"><span className="w-6 text-center text-xs">{position + 1}</span><span className="flex-1 text-sm font-bold">{playerName(id)}</span><button onClick={() => moveManualPlayer(teamNumber, position, -1)} className="px-2">↑</button><button onClick={() => moveManualPlayer(teamNumber, position, 1)} className="px-2">↓</button></div>)}<button disabled={savingTeam === teamNumber} onClick={() => saveManualOrder(teamNumber)} className="w-full py-2 rounded-xl bg-white text-zinc-900 font-black text-xs">Guardar</button></div>}</section>;
      })}</div>
      <button disabled={!allSubmitted || duelCount === 0} onClick={() => setPhase("duels")} className="game-primary w-full py-4 rounded-2xl font-black text-lg disabled:opacity-30">Revelar Duelos →</button>
    </div></main>
  );

  if (phase === "results") {
    return <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-3xl mx-auto space-y-7 text-center"><header><p className="game-kicker">Duelos completados</p><h1 className="game-title text-5xl mt-3">{teamName(roundWinnerTeam)} gana la ronda</h1></header><div className="grid gap-3 sm:grid-cols-2">{game.teams.map((team, index) => { const number = index + 1; const wins = stageWins[number] ?? 0; const bonus = roundWinnerTeam === number ? CHAMPION_BONUS : 0; const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-3xl border p-5 ${style.panel}`}><p className={`font-black ${style.text}`}>{team.name}</p><p className="text-4xl font-black mt-2">+{wins * POINTS_PER_DUEL + bonus}</p><p className="text-xs game-muted mt-1">{wins} duelos × {POINTS_PER_DUEL}{bonus ? ` + ${CHAMPION_BONUS} campeón` : ""}</p></div>; })}</div><button onClick={continueToRound4} className="game-primary w-full py-4 rounded-2xl font-black">Continuar a Cultura musical →</button></div></main>;
  }

  if (phase === "final") {
    return <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-2xl mx-auto space-y-6 text-center"><header><p className="game-kicker">Desempate</p><h1 className="game-title text-5xl mt-3">Duelo Final</h1><p className="game-muted mt-2">15s para pulsar · 8s para responder · solo decide el bonus de campeón.</p></header><div className="grid gap-2">{finalEligible.map((id) => <div key={id} className="rounded-xl bg-black/15 border border-canvas-700 p-3 font-black">{playerName(id)} · {teamName(playerTeam(id))}</div>)}</div>{activeWinnerId ? <div className="space-y-4"><p className="text-2xl font-black">⚡ {playerName(activeWinnerId)}</p><p className="text-5xl font-black text-gold-300">{answerTimeLeft}s</p><div className="grid grid-cols-2 gap-3"><button onClick={markBuzzWrong} className="py-4 rounded-2xl bg-rose-950/40 text-rose-300 font-black">✗ Fallo</button><button onClick={markBuzzCorrect} className="py-4 rounded-2xl bg-emerald-950/40 text-emerald-300 font-black">✓ Campeón</button></div></div> : duelStarted ? <div><p className="text-6xl font-black text-gold-300">{buzzTimeLeft}</p><p className="game-muted">esperando pulsador</p></div> : <button disabled={busy || finalEligible.length < 2} onClick={() => openBuzzer(finalEligible)} className="game-primary w-full py-4 rounded-2xl font-black">Abrir Duelo Final</button>}</div></main>;
  }

  const directPlayer = directPlayerId ? room?.players.find((player) => player.id === directPlayerId) : null;
  return (
    <main className="game-stage min-h-screen px-4 py-8"><div className="max-w-3xl mx-auto space-y-6 text-center">
      <header><p className="game-kicker">Duelos · {duelIndex + 1}/{duelCount}</p><h1 className="game-title text-5xl mt-3">Pulsadores</h1><p className="game-muted mt-2">15s para pulsar · 8s para responder</p></header>
      <div className="grid gap-2 sm:grid-cols-2">{currentParticipants.map((id) => { const out = eliminated.includes(id); return <div key={id} className={`rounded-2xl border p-4 ${out ? "opacity-35 border-canvas-800" : "border-canvas-600 bg-black/10"}`}><p className="font-black">{playerName(id)}</p><p className="text-xs game-muted">{teamName(playerTeam(id))}{out ? " · eliminado" : ""}</p></div>; })}</div>
      {directPlayer ? <div className="space-y-4"><p className="text-xl font-black">Último en pie: {directPlayer.display_name}</p><p className="text-5xl font-black text-gold-300">{answerTimeLeft}s</p><div className="grid grid-cols-2 gap-3"><button onClick={() => directAnswer(false)} className="py-4 rounded-2xl bg-rose-950/40 text-rose-300 font-black">✗ Fallo</button><button onClick={() => directAnswer(true)} className="py-4 rounded-2xl bg-emerald-950/40 text-emerald-300 font-black">✓ +{POINTS_PER_DUEL}</button></div></div> : activeWinnerId ? <div className="space-y-4"><p className="text-2xl font-black">⚡ {playerName(activeWinnerId)} pulsó primero</p><p className="text-5xl font-black text-gold-300">{answerTimeLeft}s</p><div className="grid grid-cols-2 gap-3"><button onClick={markBuzzWrong} className="py-4 rounded-2xl bg-rose-950/40 text-rose-300 font-black">✗ Fallo</button><button onClick={markBuzzCorrect} className="py-4 rounded-2xl bg-emerald-950/40 text-emerald-300 font-black">✓ +{POINTS_PER_DUEL}</button></div></div> : duelStarted ? <div><p className="text-6xl font-black text-gold-300">{buzzTimeLeft}</p><p className="game-muted">pulsador abierto</p></div> : <button disabled={busy || currentEligible.length < 2} onClick={() => openBuzzer(currentEligible)} className="game-primary w-full py-4 rounded-2xl font-black">Abrir pulsadores</button>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{game.teams.map((team, index) => <div key={team.id} className="rounded-xl bg-black/10 border border-canvas-700 p-3"><p className={`text-xs font-black ${TEAM_STYLE[team.color].text}`}>{team.name}</p><p className="text-xl font-black">{duelWins[index + 1] ?? 0}</p><p className="text-[10px] game-muted">duelos</p></div>)}</div>
    </div></main>
  );
}
