"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";
import WildcardModal, { WildcardEffect } from "@/components/WildcardModal";
import { WildcardContext, availableCount, teamWildcardLocked } from "@/lib/wildcardUtils";

const TERRITORY_COUNT = 10;
const DEFAULT_LISTEN_SECONDS = 10;
const DEFAULT_ANSWER_SECONDS = 15;
const DEFAULT_REBOUND_SECONDS = 10;

const DEFAULT_TERRITORIES = [
  "Rock español · 2000-2009",
  "Divas pop · 2010-2019",
  "Reggaetón · antes de 2015",
  "Indie español · 2010-2018",
  "One-hit wonders · años 2000",
  "Bandas sonoras · animación",
  "Pop punk · años 2000",
  "Baladas latinas · 90s y 00s",
  "Britpop · años 90",
  "Canciones españolas · de verano",
];

const TEAM_STYLE: Record<string, { panel: string; text: string; dot: string; used: string }> = {
  violet: { panel: "border-violet-700/40 bg-violet-950/20", text: "text-violet-200", dot: "bg-violet-400", used: "border-violet-600/50 bg-violet-950/35" },
  amber: { panel: "border-amber-700/40 bg-amber-950/20", text: "text-amber-200", dot: "bg-amber-400", used: "border-amber-600/50 bg-amber-950/35" },
  sky: { panel: "border-sky-700/40 bg-sky-950/20", text: "text-sky-200", dot: "bg-sky-400", used: "border-sky-600/50 bg-sky-950/35" },
  rose: { panel: "border-rose-700/40 bg-rose-950/20", text: "text-rose-200", dot: "bg-rose-400", used: "border-rose-600/50 bg-rose-950/35" },
};

type Turn = { teamId: string };
type Result = { teamId: string; category: string; title: string; artist: string; outcome: "correct" | "wrong"; reboundTeamId?: string };
type ClaimedTerritory = { category: string; teamId: string };
type TimerPhase = "idle" | "listening" | "answering" | "rebound" | "expired";

function territoryIcon(name: string) {
  const value = name.toLowerCase();
  if (value.includes("rock")) return "🎸";
  if (value.includes("reggaetón") || value.includes("latina")) return "🌴";
  if (value.includes("banda sonora") || value.includes("animación")) return "🎬";
  if (value.includes("indie")) return "🌙";
  if (value.includes("verano")) return "☀️";
  if (value.includes("balada")) return "❤️";
  if (value.includes("2000")) return "💿";
  if (value.includes("90")) return "📼";
  return "✨";
}

function TimeControl({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <div className="rounded-2xl border border-canvas-600/60 bg-black/10 p-4 flex items-center justify-between gap-4">
      <div><p className="font-black text-cream-50">{label}</p><p className="text-xs game-muted mt-1">Configurable por el presentador</p></div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(5, value - 5))} className="w-9 h-9 rounded-xl border border-canvas-600 bg-black/15 font-black">−</button>
        <span className="w-14 text-center text-xl font-black text-gold-300 tabular-nums">{value}s</span>
        <button onClick={() => onChange(Math.min(60, value + 5))} className="w-9 h-9 rounded-xl border border-canvas-600 bg-black/15 font-black">+</button>
      </div>
    </div>
  );
}

export default function Round2Content() {
  const router = useRouter();
  const { game, hydrated, setGame, adjustScore } = useGame();
  const [phase, setPhase] = useState<"setup" | "playing" | "results">("setup");
  const [territoryText, setTerritoryText] = useState(DEFAULT_TERRITORIES.join("\n"));
  const [listenSeconds, setListenSeconds] = useState(DEFAULT_LISTEN_SECONDS);
  const [answerSeconds, setAnswerSeconds] = useState(DEFAULT_ANSWER_SECONDS);
  const [reboundSeconds, setReboundSeconds] = useState(DEFAULT_REBOUND_SECONDS);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [claimedTerritories, setClaimedTerritories] = useState<ClaimedTerritory[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [awaitingRebound, setAwaitingRebound] = useState(false);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>("idle");
  const [timeLeft, setTimeLeft] = useState(DEFAULT_LISTEN_SECONDS);
  const [timerPaused, setTimerPaused] = useState(false);
  const [wildcardTeamId, setWildcardTeamId] = useState<string | null>(null);
  const [cantanteMode, setCantanteMode] = useState(false);
  const [blockedPlayers, setBlockedPlayers] = useState<string[]>([]);
  const [roboTeamId, setRoboTeamId] = useState<string | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 2) router.replace("/game");
  }, [hydrated, game, router]);

  useEffect(() => {
    if (timerPaused || !["listening", "answering", "rebound"].includes(timerPhase)) return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current > 1) return current - 1;
        if (timerPhase === "listening") {
          setTimerPhase("answering");
          return answerSeconds;
        }
        setTimerPhase("expired");
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerPhase, timerPaused, answerSeconds]);

  const allTerritories = useMemo(() => territoryText.split("\n").map((item) => item.trim()).filter(Boolean), [territoryText]);
  if (!hydrated || !game) return null;

  const territories = allTerritories.slice(0, TERRITORY_COUNT);
  const enoughTerritories = territories.length === TERRITORY_COUNT;
  const currentTurn = turns[turnIndex];
  const currentTeam = currentTurn ? game.teams.find((team) => team.id === currentTurn.teamId) : null;
  const currentStyle = currentTeam ? TEAM_STYLE[currentTeam.color] : null;
  const allRivals = currentTeam ? game.teams.filter((team) => team.id !== currentTeam.id) : [];
  const reboundRivals = roboTeamId ? allRivals.filter((team) => team.id === roboTeamId) : allRivals;
  const teamTurn = currentTeam ? turns.slice(0, turnIndex + 1).filter((turn) => turn.teamId === currentTeam.id).length : 0;
  const teamQuota = currentTeam ? turns.filter((turn) => turn.teamId === currentTeam.id).length : 0;
  const songReady = artist.trim().length > 0 && (cantanteMode || title.trim().length > 0);

  const buildTurns = (): Turn[] => {
    const ranked = game.teams
      .map((team, originalIndex) => ({ team, originalIndex }))
      .sort((a, b) => a.team.score - b.team.score || a.originalIndex - b.originalIndex)
      .map(({ team }) => team);
    const base = Math.floor(TERRITORY_COUNT / ranked.length);
    const extras = TERRITORY_COUNT % ranked.length;
    const quota = Object.fromEntries(ranked.map((team, index) => [team.id, base + (index < extras ? 1 : 0)]));
    const maxQuota = Math.max(...Object.values(quota));
    const generated: Turn[] = [];
    for (let slot = 0; slot < maxQuota; slot += 1) {
      const block = slot % 2 === 0 ? ranked : [...ranked].reverse();
      block.forEach((team) => { if (slot < quota[team.id]) generated.push({ teamId: team.id }); });
    }
    return generated;
  };

  const resetTimer = () => { setTimerPhase("idle"); setTimeLeft(listenSeconds); };
  const startTimer = () => { setTimerPhase("listening"); setTimeLeft(listenSeconds); };

  const resetTurn = () => {
    setSelectedCategory(null); setTitle(""); setArtist(""); setAwaitingRebound(false);
    setCantanteMode(false); setBlockedPlayers([]); setRoboTeamId(null); setActiveEffect(null); resetTimer();
  };

  const startRound = () => {
    if (!enoughTerritories) return;
    setTurns(buildTurns());
    setClaimedTerritories([]);
    setTimeLeft(listenSeconds);
    setPhase("playing");
  };

  const claimTerritory = (category: string) => {
    if (!currentTeam || claimedTerritories.some((item) => item.category === category)) return;
    setSelectedCategory(category);
    setClaimedTerritories((prev) => [...prev, { category, teamId: currentTeam.id }]);
    resetTimer();
  };

  const nextTurn = () => {
    if (turnIndex + 1 >= turns.length) { setPhase("results"); return; }
    setTurnIndex((index) => index + 1);
    resetTurn();
  };

  const markCorrect = () => {
    if (!currentTeam || !selectedCategory || !songReady) return;
    adjustScore(currentTeam.id, 20);
    setResults((prev) => [...prev, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "correct" }]);
    nextTurn();
  };

  const markWrong = () => {
    if (!currentTeam || !selectedCategory || !songReady) return;
    adjustScore(currentTeam.id, -10);
    setAwaitingRebound(true);
    setTimerPhase("rebound");
    setTimeLeft(reboundSeconds);
  };

  const finishWrong = (reboundTeamId?: string) => {
    if (!currentTeam || !selectedCategory) return;
    if (reboundTeamId) adjustScore(reboundTeamId, 10);
    setResults((prev) => [...prev, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "wrong", reboundTeamId }]);
    nextTurn();
  };

  const openWildcard = (teamId: string) => { setWildcardTeamId(teamId); setTimerPaused(true); };
  const closeWildcard = () => { setWildcardTeamId(null); setTimerPaused(false); };

  const handleWildcardUsed = (teamId: string, effect: WildcardEffect) => {
    if (effect.wildcardId === "tiempo") {
      const seconds = effect.tiempo?.extraSeconds ?? 10;
      setTimeLeft((value) => value + seconds);
      setActiveEffect(`⏱ +${seconds}s al reloj`);
    }
    if (effect.wildcardId === "cantante") { setCantanteMode(true); setActiveEffect("🎤 Solo artista necesario"); }
    if (effect.wildcardId === "silencio" && effect.silencio) { setBlockedPlayers((prev) => [...prev, effect.silencio!.playerName]); setActiveEffect(`🔇 ${effect.silencio.playerName} no puede ayudar en este reto`); }
    if (effect.wildcardId === "robo") { setRoboTeamId(teamId); setActiveEffect(`🎭 Si hay fallo, ${game.teams.find((team) => team.id === teamId)?.name} tiene el rebote en exclusiva`); }
    if (effect.wildcardId === "otra") { setTitle(""); setArtist(""); resetTimer(); setActiveEffect("🔄 El presentador elige otra canción del mismo territorio"); }
    setWildcardTeamId(null); setTimerPaused(false);
  };

  const continueToRound3 = () => {
    const roundStatus = (n: number): RoundStatus => n < 3 ? "completed" : n === 3 ? "active" : "pending";
    const updated: GameState = { ...game, currentRound: 3, rounds: game.rounds.map((round) => ({ ...round, status: roundStatus(round.number) })) };
    setGame(updated); router.replace("/game");
  };

  if (phase === "setup") return (
    <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-4xl mx-auto space-y-7">
      <header className="text-center max-w-2xl mx-auto"><p className="game-kicker">Ronda 2</p><h1 className="game-title text-5xl mt-3">Territorio</h1><p className="game-muted mt-3">10 territorios exactos. Los equipos peor clasificados reciben primero cualquier elección extra.</p></header>
      <section className="game-panel rounded-[2rem] p-6 space-y-4"><div className="flex justify-between gap-4"><div><p className="font-black text-lg">Mapa de territorios</p><p className="text-sm game-muted">Una categoría por línea. Solo entran las primeras 10.</p></div><span className={`font-black ${enoughTerritories ? "text-emerald-300" : "text-rose-300"}`}>{territories.length}/10</span></div><textarea value={territoryText} onChange={(event) => setTerritoryText(event.target.value)} rows={10} className="w-full rounded-2xl bg-black/15 border border-canvas-600/60 px-4 py-3 text-sm resize-y" /><div className="grid gap-2 sm:grid-cols-2">{territories.map((territory) => <div key={territory} className="rounded-xl border border-gold-300/15 bg-gold-300/[0.04] px-4 py-3 font-bold">{territoryIcon(territory)} {territory}</div>)}</div></section>
      <section className="game-panel rounded-[2rem] p-6 space-y-3"><p className="font-black text-lg">Tiempos</p><TimeControl label="Escucha" value={listenSeconds} onChange={setListenSeconds} /><TimeControl label="Respuesta" value={answerSeconds} onChange={setAnswerSeconds} /><TimeControl label="Rebote" value={reboundSeconds} onChange={setReboundSeconds} /></section>
      <section className="grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-emerald-950/25 border border-emerald-700/30 py-4"><p className="text-3xl font-black text-emerald-300">+20</p><p className="text-xs game-muted">Acierto</p></div><div className="rounded-2xl bg-rose-950/20 border border-rose-700/30 py-4"><p className="text-3xl font-black text-rose-300">−10</p><p className="text-xs game-muted">Fallo</p></div><div className="rounded-2xl bg-gold-300/[0.06] border border-gold-300/20 py-4"><p className="text-3xl font-black text-gold-300">+10</p><p className="text-xs game-muted">Rebote</p></div></section>
      <button onClick={startRound} disabled={!enoughTerritories} className="game-primary w-full py-4 rounded-2xl font-black text-lg disabled:opacity-35">Abrir el mapa</button>
    </div></main>
  );

  if (phase === "results") {
    const summary = game.teams.map((team) => ({ team, correct: results.filter((result) => result.teamId === team.id && result.outcome === "correct").length, rebounds: results.filter((result) => result.reboundTeamId === team.id).length, territories: claimedTerritories.filter((item) => item.teamId === team.id).length }));
    return <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-4xl mx-auto space-y-7 text-center"><header><p className="game-kicker">Territorio completado</p><h1 className="game-title text-5xl mt-3">El mapa ya tiene dueño</h1></header><div className="grid gap-3 sm:grid-cols-2 text-left">{summary.map(({ team, correct, rebounds, territories: conquered }) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-3xl border p-5 ${style.panel}`}><p className={`font-black ${style.text}`}>{team.name}</p><p className="text-4xl font-black mt-3">{team.score}</p><p className="text-sm game-muted mt-1">{conquered} territorios · {correct} aciertos · {rebounds} rebotes</p></div>; })}</div><button onClick={continueToRound3} className="game-primary w-full py-4 rounded-2xl font-black text-lg">Continuar a Duelos →</button></div></main>;
  }

  const timerLabel = timerPhase === "listening" ? "ESCUCHA" : timerPhase === "answering" ? "RESPUESTA" : timerPhase === "rebound" ? "REBOTE" : timerPhase === "expired" ? "TIEMPO" : "PREPARADO";
  const timerActive = ["listening", "answering", "rebound"].includes(timerPhase);

  return (
    <main className="game-stage min-h-screen px-4 py-7"><div className="max-w-5xl mx-auto space-y-6">
      <header className="text-center"><p className="game-kicker">Territorio · elección {turnIndex + 1}/{turns.length}</p><h1 className="game-title text-4xl mt-2">{currentTeam?.name}</h1><p className="game-muted text-sm mt-2">Elección {teamTurn}/{teamQuota} · {TERRITORY_COUNT - claimedTerritories.length} territorios libres</p></header>

      {!selectedCategory ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{territories.map((territory) => { const claimed = claimedTerritories.find((item) => item.category === territory); const owner = claimed ? game.teams.find((team) => team.id === claimed.teamId) : null; const ownerStyle = owner ? TEAM_STYLE[owner.color] : null; return <button key={territory} disabled={Boolean(claimed)} onClick={() => claimTerritory(territory)} className={`min-h-32 rounded-3xl border p-5 text-left ${claimed && ownerStyle ? `${ownerStyle.used} opacity-60` : "game-choice"}`}><span className="text-3xl">{territoryIcon(territory)}</span><p className="text-lg font-black mt-3">{territory}</p><p className="text-xs game-muted mt-1">{claimed && owner ? `Conquistado por ${owner.name}` : "Disponible"}</p></button>; })}</div> : (
        <section className="game-panel rounded-[2rem] p-6 space-y-5 max-w-4xl mx-auto">
          <div className="text-center"><span className="text-5xl">{territoryIcon(selectedCategory)}</span><p className="game-kicker mt-2">Territorio conquistado</p><p className="game-title text-3xl mt-1">{selectedCategory}</p><p className={`font-black mt-1 ${currentStyle?.text}`}>{currentTeam?.name}</p></div>
          {activeEffect && <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-black text-center p-2">{activeEffect}</div>}
          {blockedPlayers.length > 0 && <p className="text-center text-xs game-muted">Silenciados este reto: {blockedPlayers.join(", ")}</p>}
          <div className="game-panel-soft rounded-2xl p-4 space-y-3"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={cantanteMode ? "Título opcional con Cantante" : "Título de la canción"} className="w-full rounded-xl bg-black/15 border border-canvas-600/60 px-4 py-3" /><input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artista" className="w-full rounded-xl bg-black/15 border border-canvas-600/60 px-4 py-3" />{cantanteMode && <p className="text-xs text-amber-300 font-black">🎤 Solo se exige acertar el artista</p>}</div>
          <div className="rounded-2xl border border-canvas-600/60 bg-black/10 p-4 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest game-muted">{timerLabel}</p><p className="text-4xl font-black tabular-nums mt-1">{timeLeft}s</p></div>{timerActive ? <button onClick={resetTimer} className="px-4 py-3 rounded-xl border border-canvas-600 font-black">Reiniciar</button> : !awaitingRebound ? <button onClick={startTimer} disabled={!songReady} className="game-primary px-4 py-3 rounded-xl font-black disabled:opacity-30">Iniciar</button> : null}</div>
          {!awaitingRebound ? <div className="grid grid-cols-2 gap-3"><button onClick={markWrong} disabled={!songReady} className="py-4 rounded-2xl bg-rose-950/40 border border-rose-700/35 text-rose-200 font-black disabled:opacity-25">Falló · −10</button><button onClick={markCorrect} disabled={!songReady} className="py-4 rounded-2xl bg-emerald-950/35 border border-emerald-700/35 text-emerald-200 font-black disabled:opacity-25">Acierto · +20</button></div> : <div className="space-y-3"><p className="text-center font-black text-gold-300">{roboTeamId ? `🎭 Rebote exclusivo · ${reboundRivals[0]?.name}` : "Rebote abierto"}</p><div className="grid gap-2 sm:grid-cols-2">{reboundRivals.map((team) => <button key={team.id} onClick={() => finishWrong(team.id)} className="py-3 rounded-2xl border border-gold-300/20 bg-gold-300/[0.06] text-gold-300 font-black">{team.name} · +10</button>)}<button onClick={() => finishWrong()} className="py-3 rounded-2xl bg-black/15 border border-canvas-700 text-zinc-400 font-bold">Nadie acierta</button></div></div>}

          {!awaitingRebound && <div className="grid grid-cols-2 gap-2">{game.teams.map((team) => { const context: WildcardContext = team.id === currentTeam?.id ? "my_turn" : "rival_turn"; const disabled = ["supercomodin", ...(!["listening", "answering"].includes(timerPhase) ? ["tiempo"] : []), ...(timerPhase !== "idle" ? ["otra"] : []), ...(roboTeamId ? ["robo"] : [])]; const locked = teamWildcardLocked(team, game.currentRound); const count = availableCount(team.wildcards, context, disabled, locked); return <button key={team.id} disabled={!count} onClick={() => openWildcard(team.id)} className={`py-2.5 rounded-xl border text-xs font-black ${count ? "bg-black/15 border-canvas-600 text-cream-100" : "bg-black/5 border-canvas-800 text-zinc-700"}`}>🃏 {team.name} · {count}</button>; })}</div>}
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{game.teams.map((team) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-2xl border px-3 py-3 text-center ${style.panel}`}><p className={`text-xs font-black ${style.text}`}>{team.name}</p><p className="text-2xl font-black mt-1">{team.score}</p></div>; })}</div>
    </div>

    {wildcardTeamId && currentTeam && (() => { const wildcardTeam = game.teams.find((team) => team.id === wildcardTeamId)!; const context: WildcardContext = wildcardTeam.id === currentTeam.id ? "my_turn" : "rival_turn"; const disabled = ["supercomodin", ...(!["listening", "answering"].includes(timerPhase) ? ["tiempo"] : []), ...(timerPhase !== "idle" ? ["otra"] : []), ...(roboTeamId ? ["robo"] : [])]; return <WildcardModal team={wildcardTeam} allTeams={game.teams} context={context} disabledIds={disabled} silencioTargetTeamId={currentTeam.id} onClose={closeWildcard} onUsed={(effect) => handleWildcardUsed(wildcardTeam.id, effect)} />; })()}
    </main>
  );
}
