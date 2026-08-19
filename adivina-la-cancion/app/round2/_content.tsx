"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import { GameState, RoundStatus } from "@/lib/types";

const TURNS_PER_TEAM = 5;
const DEFAULT_LISTEN_SECONDS = 10;
const DEFAULT_ANSWER_SECONDS = 15;
const DEFAULT_CATEGORIES = ["Rock", "Pop", "Español", "2000s", "2010s", "80s/90s", "Indie", "Latino", "Bandas sonoras"];

const CATEGORY_ICON: Record<string, string> = {
  Rock: "🎸",
  Pop: "✨",
  Español: "🇪🇸",
  "2000s": "💿",
  "2010s": "📱",
  "80s/90s": "📼",
  Indie: "🌙",
  Latino: "🌴",
  "Bandas sonoras": "🎬",
};

const TEAM_STYLE: Record<string, { panel: string; text: string; dot: string }> = {
  violet: { panel: "border-violet-700/40 bg-violet-950/20", text: "text-violet-200", dot: "bg-violet-400" },
  amber: { panel: "border-amber-700/40 bg-amber-950/20", text: "text-amber-200", dot: "bg-amber-400" },
  sky: { panel: "border-sky-700/40 bg-sky-950/20", text: "text-sky-200", dot: "bg-sky-400" },
  rose: { panel: "border-rose-700/40 bg-rose-950/20", text: "text-rose-200", dot: "bg-rose-400" },
};

type Turn = { teamId: string };
type Result = { teamId: string; category: string; title: string; artist: string; outcome: "correct" | "wrong"; reboundTeamId?: string };
type TimerPhase = "idle" | "listening" | "answering" | "expired";

function TimeControl({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <div className="rounded-2xl border border-canvas-600/60 bg-black/10 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-black text-cream-50">{label}</p>
        <p className="text-xs game-muted mt-1">Configurable por el presentador</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(5, value - 5))} className="w-9 h-9 rounded-xl border border-canvas-600 bg-black/15 text-cream-100 font-black">−</button>
        <span className="w-14 text-center text-xl font-black text-gold-300 tabular-nums">{value}s</span>
        <button onClick={() => onChange(Math.min(60, value + 5))} className="w-9 h-9 rounded-xl border border-canvas-600 bg-black/15 text-cream-100 font-black">+</button>
      </div>
    </div>
  );
}

export default function Round2Content() {
  const router = useRouter();
  const { game, hydrated, setGame, adjustScore } = useGame();
  const [phase, setPhase] = useState<"setup" | "playing" | "results">("setup");
  const [categoryText, setCategoryText] = useState(DEFAULT_CATEGORIES.join(", "));
  const [listenSeconds, setListenSeconds] = useState(DEFAULT_LISTEN_SECONDS);
  const [answerSeconds, setAnswerSeconds] = useState(DEFAULT_ANSWER_SECONDS);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [awaitingRebound, setAwaitingRebound] = useState(false);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>("idle");
  const [timeLeft, setTimeLeft] = useState(DEFAULT_LISTEN_SECONDS);

  useEffect(() => {
    if (!hydrated) return;
    if (!game) { router.replace("/"); return; }
    if (game.currentRound !== 2) router.replace("/game");
  }, [hydrated, game, router]);

  useEffect(() => {
    if (timerPhase !== "listening" && timerPhase !== "answering") return;
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
  }, [timerPhase, answerSeconds]);

  const categories = useMemo(() => categoryText.split(",").map((x) => x.trim()).filter(Boolean), [categoryText]);
  if (!hydrated || !game) return null;

  const currentTurn = turns[turnIndex];
  const currentTeam = currentTurn ? game.teams.find((t) => t.id === currentTurn.teamId) : null;
  const currentStyle = currentTeam ? TEAM_STYLE[currentTeam.color] : null;
  const rivals = currentTeam ? game.teams.filter((t) => t.id !== currentTeam.id) : [];
  const teamTurn = Math.floor(turnIndex / game.teams.length) + 1;

  const startRound = () => {
    if (categories.length === 0) return;
    const generated: Turn[] = [];
    for (let round = 0; round < TURNS_PER_TEAM; round += 1) {
      game.teams.forEach((team) => generated.push({ teamId: team.id }));
    }
    setTurns(generated);
    setTimeLeft(listenSeconds);
    setPhase("playing");
  };

  const resetTimer = () => {
    setTimerPhase("idle");
    setTimeLeft(listenSeconds);
  };

  const startTimer = () => {
    setTimerPhase("listening");
    setTimeLeft(listenSeconds);
  };

  const resetTurn = () => {
    setSelectedCategory(null);
    setTitle("");
    setArtist("");
    setAwaitingRebound(false);
    resetTimer();
  };

  const nextTurn = () => {
    if (turnIndex + 1 >= turns.length) { setPhase("results"); return; }
    setTurnIndex((i) => i + 1);
    resetTurn();
  };

  const markCorrect = () => {
    if (!currentTeam || !selectedCategory || !title.trim() || !artist.trim()) return;
    adjustScore(currentTeam.id, 20);
    setResults((r) => [...r, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "correct" }]);
    nextTurn();
  };

  const markWrong = () => {
    if (!currentTeam || !selectedCategory || !title.trim() || !artist.trim()) return;
    adjustScore(currentTeam.id, -10);
    setAwaitingRebound(true);
    setTimerPhase("answering");
    setTimeLeft(answerSeconds);
  };

  const finishWrong = (reboundTeamId?: string) => {
    if (!currentTeam || !selectedCategory) return;
    if (reboundTeamId) adjustScore(reboundTeamId, 10);
    setResults((r) => [...r, { teamId: currentTeam.id, category: selectedCategory, title: title.trim(), artist: artist.trim(), outcome: "wrong", reboundTeamId }]);
    nextTurn();
  };

  const continueToRound3 = () => {
    const roundStatus = (n: number): RoundStatus => n < 3 ? "completed" : n === 3 ? "active" : "pending";
    const updated: GameState = { ...game, currentRound: 3, rounds: game.rounds.map((r) => ({ ...r, status: roundStatus(r.number) })) };
    setGame(updated);
    router.replace("/game");
  };

  const timerLabel = timerPhase === "listening" ? "ESCUCHA" : timerPhase === "answering" ? (awaitingRebound ? "REBOTE" : "RESPUESTA") : timerPhase === "expired" ? "TIEMPO" : "PREPARADO";
  const timerTone = timerPhase === "expired" ? "text-rose-300 border-rose-700/40 bg-rose-950/25" : timerPhase === "answering" ? "text-gold-300 border-gold-300/25 bg-gold-300/[0.06]" : "text-cream-50 border-canvas-600/60 bg-black/10";

  if (phase === "setup") return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-7">
        <header className="text-center max-w-xl mx-auto">
          <p className="game-kicker">Ronda 2</p>
          <h1 className="game-title text-5xl mt-3">Territorio</h1>
          <p className="game-muted mt-3">Elegir bien importa. Luego toca demostrar que la arrogancia tenía fundamento.</p>
        </header>

        <section className="game-panel rounded-[2rem] p-6 sm:p-7 space-y-5">
          <div>
            <p className="font-black text-cream-50 text-lg">Categorías disponibles</p>
            <p className="text-sm game-muted mt-1">Todas aparecerán como opción en cada turno. Más adelante las propondrá el Motor Musical.</p>
          </div>
          <textarea value={categoryText} onChange={(e) => setCategoryText(e.target.value)} rows={4} className="w-full rounded-2xl bg-black/15 border border-canvas-600/60 px-4 py-3.5 text-sm text-cream-100 focus:outline-none focus:border-gold-300/40 resize-none" />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => <span key={c} className="px-3 py-1.5 rounded-full border border-gold-300/15 bg-gold-300/[0.06] text-xs text-cream-100 font-bold">{CATEGORY_ICON[c] ?? "♪"} {c}</span>)}
          </div>
        </section>

        <section className="game-panel rounded-[2rem] p-6 sm:p-7 space-y-3">
          <div className="mb-4"><p className="font-black text-cream-50 text-lg">Tiempos</p><p className="text-sm game-muted mt-1">El contador pasa automáticamente de escucha a respuesta.</p></div>
          <TimeControl label="Tiempo de escucha" value={listenSeconds} onChange={setListenSeconds} />
          <TimeControl label="Tiempo de respuesta" value={answerSeconds} onChange={setAnswerSeconds} />
        </section>

        <section className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-emerald-950/25 border border-emerald-700/30 py-4"><p className="text-3xl font-black text-emerald-300">+20</p><p className="text-[10px] uppercase tracking-widest game-muted mt-1">Acierto</p></div>
          <div className="rounded-2xl bg-rose-950/20 border border-rose-700/30 py-4"><p className="text-3xl font-black text-rose-300">−10</p><p className="text-[10px] uppercase tracking-widest game-muted mt-1">Fallo</p></div>
          <div className="rounded-2xl bg-gold-300/[0.06] border border-gold-300/20 py-4"><p className="text-3xl font-black text-gold-300">+10</p><p className="text-[10px] uppercase tracking-widest game-muted mt-1">Rebote</p></div>
        </section>

        <button onClick={startRound} disabled={categories.length === 0} className="game-primary w-full py-4 rounded-2xl font-black text-lg transition-all disabled:opacity-35">Entrar en Territorio</button>
      </div>
    </main>
  );

  if (phase === "results") {
    const summary = game.teams.map((team) => ({ team, correct: results.filter((r) => r.teamId === team.id && r.outcome === "correct").length, rebounds: results.filter((r) => r.reboundTeamId === team.id).length }));
    return (
      <main className="game-stage min-h-screen px-4 py-10"><div className="max-w-3xl mx-auto space-y-7 text-center">
        <header><p className="game-kicker">Territorio completado</p><h1 className="game-title text-5xl mt-3">Así queda el mapa</h1></header>
        <div className="grid gap-3 sm:grid-cols-2 text-left">{summary.map(({ team, correct, rebounds }) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-3xl border p-5 ${style.panel}`}><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} /><p className={`font-black ${style.text}`}>{team.name}</p></div><p className="text-4xl font-black text-cream-50 mt-3">{team.score}</p><p className="text-sm game-muted mt-1">{correct} aciertos · {rebounds} rebotes</p></div>; })}</div>
        <button onClick={continueToRound3} className="game-primary w-full py-4 rounded-2xl font-black text-lg transition-all">Continuar a Duelos →</button>
      </div></main>
    );
  }

  return (
    <main className="game-stage min-h-screen px-4 py-7 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center">
          <p className="game-kicker">Territorio · turno {teamTurn}/{TURNS_PER_TEAM}</p>
          <div className="mt-3 flex items-center justify-center gap-2">{currentStyle && <span className={`w-3 h-3 rounded-full ${currentStyle.dot}`} />}<h1 className="game-title text-4xl sm:text-5xl">{currentTeam?.name}</h1></div>
          <p className="game-muted text-sm mt-2">{turnIndex + 1} de {turns.length} turnos totales</p>
        </header>

        {!selectedCategory ? (
          <section className="space-y-4">
            <div className="text-center"><p className="text-[11px] uppercase tracking-[0.28em] text-gold-300 font-black">Elige tu territorio</p><p className="text-cream-100 text-lg font-bold mt-1">Todo el mapa está disponible. Ahora toca elegir dónde meterse.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {categories.map((choice) => (
                <button key={choice} onClick={() => { setSelectedCategory(choice); resetTimer(); }} className="game-choice min-h-36 rounded-3xl p-5 text-left transition-all group">
                  <span className="text-4xl block">{CATEGORY_ICON[choice] ?? "🎵"}</span><span className="block text-2xl font-black text-cream-50 mt-4 relative z-10">{choice}</span><span className="block text-xs game-muted mt-1 relative z-10">Seleccionar</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="game-panel rounded-[2rem] p-6 sm:p-7 space-y-5 overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-300/55 to-transparent" />
            <div className="text-center"><span className="text-5xl">{CATEGORY_ICON[selectedCategory] ?? "🎵"}</span><p className="game-kicker mt-3">Territorio elegido</p><p className="game-title text-4xl mt-1">{selectedCategory}</p></div>

            <div className="game-panel-soft rounded-2xl p-4 space-y-3">
              <p className="text-xs game-muted text-center">Presentador · canción seleccionada</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la canción" className="w-full rounded-xl bg-black/15 border border-canvas-600/60 px-4 py-3 text-cream-100 placeholder:text-zinc-600 focus:outline-none focus:border-gold-300/35" />
              <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artista" className="w-full rounded-xl bg-black/15 border border-canvas-600/60 px-4 py-3 text-cream-100 placeholder:text-zinc-600 focus:outline-none focus:border-gold-300/35" />
            </div>

            <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${timerTone}`}>
              <div><p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-70">{timerLabel}</p><p className="text-4xl font-black tabular-nums mt-1">{timeLeft}s</p></div>
              <div className="flex gap-2">
                {timerPhase === "idle" || timerPhase === "expired" ? <button onClick={startTimer} disabled={!title.trim() || !artist.trim() || awaitingRebound} className="px-4 py-3 rounded-xl game-primary font-black disabled:opacity-30">{timerPhase === "expired" ? "Repetir" : "Iniciar"}</button> : <button onClick={resetTimer} className="px-4 py-3 rounded-xl border border-canvas-600 bg-black/15 text-cream-100 font-black">Reiniciar</button>}
              </div>
            </div>

            {!awaitingRebound ? (
              <div className="grid grid-cols-2 gap-3"><button onClick={markWrong} disabled={!title.trim() || !artist.trim()} className="py-4 rounded-2xl bg-rose-950/40 border border-rose-700/35 text-rose-200 font-black disabled:opacity-25 active:scale-[.98] transition-all">Falló · −10</button><button onClick={markCorrect} disabled={!title.trim() || !artist.trim()} className="py-4 rounded-2xl bg-emerald-950/35 border border-emerald-700/35 text-emerald-200 font-black disabled:opacity-25 active:scale-[.98] transition-all">Acierto · +20</button></div>
            ) : (
              <div className="space-y-3">
                <div className="text-center"><p className="game-kicker">Rebote</p><p className="font-black text-cream-50 mt-1">La canción queda en el aire · {timeLeft}s</p></div>
                <div className="grid gap-2 sm:grid-cols-2">{rivals.map((team) => <button key={team.id} onClick={() => finishWrong(team.id)} className="py-3.5 rounded-2xl border border-gold-300/20 bg-gold-300/[0.06] text-gold-300 font-black active:scale-[.98] transition-all">{team.name} · +10</button>)}<button onClick={() => finishWrong()} className="py-3.5 rounded-2xl bg-black/15 border border-canvas-700 text-zinc-400 font-bold active:scale-[.98] transition-all">Nadie acierta</button></div>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{game.teams.map((team) => { const style = TEAM_STYLE[team.color]; return <div key={team.id} className={`rounded-2xl border px-3 py-3 text-center ${style.panel}`}><p className={`text-[10px] uppercase tracking-wider font-black truncate ${style.text}`}>{team.name}</p><p className="text-2xl font-black text-cream-50 mt-1">{team.score}</p></div>; })}</div>
      </div>
    </main>
  );
}
