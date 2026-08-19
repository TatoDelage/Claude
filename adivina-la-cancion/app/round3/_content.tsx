"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import {
  closeRemoteBuzzer,
  getRemoteDuelOrders,
  getRemoteRoomByCode,
  hostSubmitRemoteDuelOrder,
  openDuelBuzzer,
  RemoteRoom,
  DuelOrderRow,
} from "@/lib/supabaseRest";

type Phase = "waiting" | "duels" | "final" | "results";

const TEAM_STYLE: Record<string, { panel: string; text: string; dot: string; glow: string }> = {
  violet: { panel: "border-violet-600/45 bg-violet-950/30", text: "text-violet-200", dot: "bg-violet-400", glow: "shadow-violet-950/25" },
  amber: { panel: "border-amber-600/45 bg-amber-950/25", text: "text-amber-200", dot: "bg-amber-400", glow: "shadow-amber-950/25" },
  sky: { panel: "border-sky-600/45 bg-sky-950/25", text: "text-sky-200", dot: "bg-sky-400", glow: "shadow-sky-950/25" },
  rose: { panel: "border-rose-600/45 bg-rose-950/25", text: "text-rose-200", dot: "bg-rose-400", glow: "shadow-rose-950/25" },
};

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
        if (!cancelled) {
          if (nextRoom) setRoom(nextRoom);
          setOrders(nextOrders);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo sincronizar Duelos");
      }
    };
    load();
    const timer = window.setInterval(load, 500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [code, hostToken]);

  useEffect(() => {
    if (!room) return;
    setManualOrders((prev) => {
      const next = { ...prev };
      const teamNumbers = [...new Set(room.players.map((p) => p.team_number).filter((n): n is number => Boolean(n)))];
      for (const teamNumber of teamNumbers) {
        if (!next[teamNumber]) {
          next[teamNumber] = room.players
            .filter((p) => p.team_number === teamNumber)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => p.id);
        }
      }
      return next;
    });
  }, [room]);

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
  const currentWinnerId = duelStarted && room?.game.buzzer_winner_player_id && currentParticipants.includes(room.game.buzzer_winner_player_id) ? room.game.buzzer_winner_player_id : null;
  const currentWinner = currentWinnerId ? room?.players.find((p) => p.id === currentWinnerId) ?? null : null;
  const directPlayer = directPlayerId ? room?.players.find((p) => p.id === directPlayerId) ?? null : null;

  if (!hydrated || !game) return null;

  const teamName = (teamNumber: number | null) => teamNumber ? game.teams[teamNumber - 1]?.name ?? `Equipo ${teamNumber}` : "Equipo";
  const playerName = (id: string) => room?.players.find((p) => p.id === id)?.display_name ?? "Jugador";
  const styleForTeam = (teamNumber: number | null) => {
    const color = teamNumber ? game.teams[teamNumber - 1]?.color : undefined;
    return color ? TEAM_STYLE[color] : TEAM_STYLE.violet;
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

  const saveManualOrder = async (teamNumber: number) => {
    if (!code || !hostToken || !(manualOrders[teamNumber]?.length)) return;
    setSavingTeam(teamNumber);
    setError(null);
    try {
      await hostSubmitRemoteDuelOrder(code, hostToken, teamNumber, manualOrders[teamNumber]);
      const nextOrders = await getRemoteDuelOrders(code, hostToken);
      setOrders(nextOrders);
      setEditingTeam(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el orden");
    } finally {
      setSavingTeam(null);
    }
  };

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
    if (duelIndex + 1 >= duelCount) window.setTimeout(() => finishDuelStage(winnerId), 0);
    else setDuelIndex((i) => i + 1);
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
      setFinalEligible(survivors); setPhase("final"); setDuelStarted(false);
    }
  };

  const markBuzzCorrect = () => { if (currentWinnerId) advanceDuel(currentWinnerId); };

  const markBuzzWrong = async () => {
    if (!currentWinnerId || !code || !hostToken) return;
    await closeRemoteBuzzer(code, hostToken).catch(() => {});
    const remaining = currentEligible.filter((id) => id !== currentWinnerId);
    setEliminated((prev) => [...prev, currentWinnerId]); setDuelStarted(false);
    if (remaining.length === 0) advanceDuel();
    else if (remaining.length === 1) setDirectPlayerId(remaining[0]);
  };

  const directAnswer = (correct: boolean) => { if (directPlayerId) advanceDuel(correct ? directPlayerId : undefined); };

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

  const finalWinnerId = phase === "final" && duelStarted && room?.game.buzzer_winner_player_id && finalEligible.includes(room.game.buzzer_winner_player_id) ? room.game.buzzer_winner_player_id : null;
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

  if (!code || !hostToken) return <main className="game-stage min-h-screen flex items-center justify-center px-4 text-center text-cream-100">Esta partida no tiene conexión remota disponible. Duelos necesita la sala compartida.</main>;

  if (phase === "waiting") return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-7">
        <header className="text-center max-w-xl mx-auto"><p className="game-kicker">Ronda 3</p><h1 className="game-title text-5xl mt-3">Duelos</h1><p className="game-muted mt-3">Los capitanes pueden enviar su orden desde el móvil. Si falta alguno, el presentador puede configurarlo aquí.</p></header>

        <div className="grid gap-3 sm:grid-cols-2">
          {game.teams.map((team, index) => {
            const teamNumber = index + 1;
            const order = orders.find((o) => o.team_number === teamNumber);
            const style = TEAM_STYLE[team.color];
            const teamPlayers = room?.players.filter((p) => p.team_number === teamNumber) ?? [];
            const editorOrder = manualOrders[teamNumber] ?? teamPlayers.map((p) => p.id);
            const isEditing = editingTeam === teamNumber;
            return (
              <div key={team.id} className={`rounded-3xl border p-5 ${style.panel} shadow-xl ${style.glow} space-y-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} /><p className={`font-black text-lg ${style.text}`}>{team.name}</p></div><p className="text-xs game-muted mt-2">Orden secreto de enfrentamientos</p></div>
                  <div className={`h-11 px-3 rounded-2xl flex items-center text-xs font-black ${order ? "bg-emerald-400/10 text-emerald-300 border border-emerald-500/20" : "bg-gold-300/[0.06] text-gold-300 border border-gold-300/15"}`}>{order ? "✓ ENVIADO" : "ESPERANDO"}</div>
                </div>

                {!isEditing ? (
                  <button onClick={() => { if (order) setManualOrders((prev) => ({ ...prev, [teamNumber]: [...order.ordered_player_ids] })); setEditingTeam(teamNumber); }} className="w-full py-2.5 rounded-xl border border-canvas-600/60 bg-black/10 text-xs font-black text-cream-100">
                    {order ? "Editar desde el presentador" : "Configurar desde el presentador"}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-canvas-600/60 bg-black/10 p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest game-muted text-center">Orden manual</p>
                    {editorOrder.map((id, position) => {
                      const player = teamPlayers.find((p) => p.id === id);
                      return (
                        <div key={id} className="flex items-center gap-2 rounded-xl bg-black/15 border border-canvas-700 px-3 py-2">
                          <span className={`w-6 text-center font-black ${style.text}`}>{position + 1}</span>
                          <span className="flex-1 text-sm font-bold text-cream-100 truncate">{player?.display_name ?? "Jugador"}</span>
                          <button onClick={() => moveManualPlayer(teamNumber, position, -1)} disabled={position === 0} className="w-8 h-8 rounded-lg border border-canvas-600 disabled:opacity-25">↑</button>
                          <button onClick={() => moveManualPlayer(teamNumber, position, 1)} disabled={position === editorOrder.length - 1} className="w-8 h-8 rounded-lg border border-canvas-600 disabled:opacity-25">↓</button>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={() => setEditingTeam(null)} className="py-2.5 rounded-xl border border-canvas-600 text-zinc-400 font-bold text-sm">Cancelar</button><button onClick={() => saveManualOrder(teamNumber)} disabled={savingTeam === teamNumber || editorOrder.length === 0} className="game-primary py-2.5 rounded-xl font-black text-sm disabled:opacity-35">{savingTeam === teamNumber ? "Guardando…" : "Guardar orden"}</button></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {unequalTeams && <div className="rounded-2xl border border-gold-300/20 bg-gold-300/[0.06] px-4 py-3 text-sm text-gold-300 text-center">Los equipos tienen distinto tamaño. Se jugarán {duelCount} posiciones, hasta el equipo más pequeño.</div>}
        {error && <p className="text-rose-300 text-sm text-center">{error}</p>}
        <button onClick={revealDuels} disabled={!allSubmitted} className="game-primary w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-35">{allSubmitted ? "Revelar enfrentamientos" : `Faltan órdenes · ${orders.length}/${teamCount}`}</button>
      </div>
    </main>
  );

  if (phase === "results") {
    const winnerStyle = roundWinnerTeam ? styleForTeam(roundWinnerTeam) : TEAM_STYLE.violet;
    return <main className="game-stage min-h-screen px-4 py-12 flex items-center"><div className="max-w-3xl mx-auto w-full space-y-8 text-center"><header><p className="game-kicker">Duelos completados</p><div className={`mx-auto mt-5 w-20 h-20 rounded-full border flex items-center justify-center text-4xl ${winnerStyle.panel}`}>🏆</div><h1 className={`game-title text-5xl sm:text-6xl mt-5 ${winnerStyle.text}`}>{roundWinnerTeam ? teamName(roundWinnerTeam) : "Ganador"}</h1><p className="text-gold-300 font-black mt-2">+100 puntos</p></header><div className="grid gap-3 sm:grid-cols-2 text-left">{game.teams.map((team, index) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-3xl border p-5 ${style.panel}`}><div className="flex items-center justify-between gap-3"><div><p className={`font-black ${style.text}`}>{team.name}</p><p className="text-xs game-muted mt-1">{duelWins[index + 1] ?? 0} duelos ganados</p></div><p className="text-3xl font-black text-cream-50">{team.score}</p></div></div>; })}</div><button onClick={continueToRound4} className="game-primary w-full py-4 rounded-2xl font-black text-lg transition-all">Continuar a Cultura musical →</button></div></main>;
  }

  if (phase === "final") return (
    <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-3xl mx-auto space-y-7"><header className="text-center"><p className="game-kicker">Empate</p><h1 className="game-title text-5xl sm:text-6xl mt-3">DUELO FINAL</h1><p className="game-muted mt-3">Solo sobreviven quienes ganaron su duelo. Fallar elimina al jugador.</p></header><div className="flex flex-wrap justify-center gap-2">{finalEligible.map((id) => { const player = room?.players.find((p) => p.id === id); const style = styleForTeam(player?.team_number ?? null); return <span key={id} className={`px-4 py-2 rounded-full border font-black ${style.panel} ${style.text}`}>{playerName(id)}</span>; })}</div>{!duelStarted ? <button onClick={openFinal} disabled={busy || finalEligible.length < 2} className="game-danger w-full py-5 rounded-2xl font-black text-xl transition-all disabled:opacity-35">ABRIR DUELO FINAL</button> : finalWinner ? <section className="game-panel rounded-[2rem] p-7 text-center space-y-5 border-gold-300/30"><p className="game-kicker">Ha pulsado primero</p><p className="game-title text-5xl">{finalWinner.display_name}</p><p className={`font-black ${styleForTeam(finalWinner.team_number).text}`}>{teamName(finalWinner.team_number)}</p><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={() => finalAnswer(false)} className="py-4 rounded-2xl bg-rose-950/45 border border-rose-700/35 text-rose-200 font-black">Falla · eliminado</button><button onClick={() => finalAnswer(true)} className="py-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/35 text-emerald-200 font-black">Acierta · gana</button></div></section> : <div className="game-panel rounded-[2rem] p-10 text-center"><p className="text-3xl font-black text-cream-50 animate-pulse">ESPERANDO PULSACIÓN</p><p className="game-muted text-sm mt-2">Cualquiera de los supervivientes puede decidir la ronda.</p></div>}{error && <p className="text-rose-300 text-sm text-center">{error}</p>}</div></main>
  );

  return (
    <main className="game-stage min-h-screen px-4 py-7 sm:py-10"><div className="max-w-4xl mx-auto space-y-7">
      <header className="text-center"><p className="game-kicker">Duelo {duelIndex + 1} de {duelCount}</p><h1 className="game-title text-4xl mt-2">Cara a cara</h1></header>
      <section className={`grid gap-3 ${currentParticipants.length === 2 ? "sm:grid-cols-[1fr_auto_1fr] items-stretch" : "sm:grid-cols-2"}`}>{currentParticipants.map((id, index) => { const p = room?.players.find((x) => x.id === id); const isOut = eliminated.includes(id); const style = styleForTeam(p?.team_number ?? null); return <div key={id} className="contents">{index === 1 && currentParticipants.length === 2 && <div className="hidden sm:flex items-center justify-center px-1"><span className="text-gold-300 text-xl font-black italic">VS</span></div>}<div className={`relative overflow-hidden min-h-48 rounded-[2rem] border p-6 flex flex-col justify-between text-center shadow-2xl ${style.glow} ${style.panel} ${isOut ? "opacity-30 grayscale" : ""}`}><div className={`absolute inset-x-0 top-0 h-1 ${style.dot}`} /><div><p className={`text-[10px] uppercase tracking-[0.2em] font-black ${style.text}`}>{teamName(p?.team_number ?? null)}</p><p className="game-title text-4xl sm:text-5xl mt-5 break-words">{p?.display_name}</p></div><p className={`text-xs font-black uppercase tracking-widest mt-5 ${isOut ? "text-rose-300" : "game-muted"}`}>{isOut ? "Eliminado" : "Listo"}</p></div></div>; })}</section>
      {!duelStarted && !directPlayerId && currentEligible.length >= 2 && <button onClick={() => openCurrentDuel()} disabled={busy} className="game-danger w-full py-5 rounded-2xl text-xl font-black tracking-wide transition-all disabled:opacity-40">ABRIR PULSADORES</button>}
      {duelStarted && !currentWinner && <div className="game-panel rounded-[2rem] p-9 text-center border-rose-500/15"><div className="mx-auto w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_24px_rgba(251,113,133,.65)] animate-pulse" /><p className="text-3xl font-black text-cream-50 mt-5 tracking-tight">ESPERANDO PULSACIÓN</p><p className="game-muted text-sm mt-2">Solo los jugadores de este duelo tienen el botón activo.</p></div>}
      {duelStarted && currentWinner && <section className="game-panel rounded-[2rem] border-gold-300/30 p-7 text-center space-y-5"><p className="game-kicker">Ha pulsado primero</p><p className="game-title text-5xl sm:text-6xl">{currentWinner.display_name}</p><p className={`font-black ${styleForTeam(currentWinner.team_number).text}`}>{teamName(currentWinner.team_number)}</p><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={markBuzzWrong} className="py-4 rounded-2xl bg-rose-950/45 border border-rose-700/35 text-rose-200 font-black">Falla</button><button onClick={markBuzzCorrect} className="py-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/35 text-emerald-200 font-black">Acierta · gana duelo</button></div></section>}
      {!duelStarted && !directPlayerId && currentEligible.length === 1 && <section className="game-panel rounded-[2rem] p-6 text-center space-y-4 border-gold-300/25"><p className="game-kicker">Último en pie</p><p className="game-title text-4xl">{playerName(currentEligible[0])}</p><div className="grid grid-cols-2 gap-3"><button onClick={() => advanceDuel()} className="py-3.5 rounded-2xl bg-rose-950/45 text-rose-200 font-black border border-rose-700/30">Falla</button><button onClick={() => advanceDuel(currentEligible[0])} className="py-3.5 rounded-2xl bg-emerald-950/40 text-emerald-200 font-black border border-emerald-700/30">Acierta</button></div></section>}
      {directPlayer && <section className={`rounded-[2rem] border p-6 text-center space-y-4 ${styleForTeam(directPlayer.team_number).panel}`}><p className="game-kicker">Oportunidad directa</p><p className="game-title text-4xl">{directPlayer.display_name}</p><p className="game-muted text-sm">El rival falló. Responde sin pulsador.</p><div className="grid grid-cols-2 gap-3"><button onClick={() => directAnswer(false)} className="py-3.5 rounded-2xl bg-rose-950/45 text-rose-200 font-black border border-rose-700/30">Falla</button><button onClick={() => directAnswer(true)} className="py-3.5 rounded-2xl bg-emerald-950/40 text-emerald-200 font-black border border-emerald-700/30">Acierta</button></div></section>}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">{game.teams.map((team, index) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-2xl border px-3 py-3 text-center ${style.panel}`}><p className={`text-[10px] uppercase tracking-wider font-black truncate ${style.text}`}>{team.name}</p><p className="text-2xl font-black text-cream-50 mt-1">{duelWins[index + 1] ?? 0}</p><p className="text-[10px] game-muted">victorias</p></div>; })}</section>
      {error && <p className="text-rose-300 text-sm text-center">{error}</p>}
    </div></main>
  );
}
