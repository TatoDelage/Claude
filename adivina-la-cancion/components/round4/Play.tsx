"use client";

import { useEffect, useRef, useState } from "react";
import { Team } from "@/lib/types";
import {
  Round4Setup,
  Round4Result,
  Round4MatchSummary,
  POINTS_WIN,
} from "@/lib/round4";
import { useTimer } from "@/lib/useTimer";
import { useGame } from "@/context/GameContext";

const TEAM_COLOR: Record<string, { badge: string; text: string; ring: string; soft: string }> = {
  violet: { badge: "bg-violet-500", text: "text-violet-300", ring: "stroke-violet-500", soft: "bg-violet-500/10 border-violet-500/20" },
  amber: { badge: "bg-amber-500", text: "text-amber-300", ring: "stroke-amber-500", soft: "bg-amber-500/10 border-amber-500/20" },
  sky: { badge: "bg-sky-500", text: "text-sky-300", ring: "stroke-sky-500", soft: "bg-sky-500/10 border-sky-500/20" },
  rose: { badge: "bg-rose-500", text: "text-rose-300", ring: "stroke-rose-500", soft: "bg-rose-500/10 border-rose-500/20" },
};

function TimerRing({ remaining, progress, color }: { remaining: number; progress: number; color: string }) {
  const r = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const isLow = remaining <= 5 && remaining > 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="150" height="150" className="-rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-canvas-800" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className={`${isLow ? "stroke-red-500" : color} transition-all duration-1000`}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-black tabular-nums leading-none ${isLow ? "text-red-400 animate-pulse" : "text-white"}`}>
          {String(remaining).padStart(2, "0")}
        </span>
        <span className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">segundos</span>
      </div>
    </div>
  );
}

function initialVictories(teams: Team[]): Record<string, number> {
  return Object.fromEntries(teams.map((team) => [team.id, 0]));
}

export default function Play({
  setup,
  teams,
  onComplete,
}: {
  setup: Round4Setup;
  teams: Team[];
  onComplete: (result: Round4Result) => void;
}) {
  const { game: gameCtx, setGame } = useGame();
  const timer = useTimer();

  const [phase, setPhase] = useState<"turn" | "between" | "finished">("turn");
  const [matchNumber, setMatchNumber] = useState(1);
  const [currentTopic, setCurrentTopic] = useState(setup.topic);
  const [nextTopic, setNextTopic] = useState("");
  const [activeTeamIds, setActiveTeamIds] = useState<string[]>(() => teams.map((team) => team.id));
  const [eliminatedTeamIds, setEliminatedTeamIds] = useState<string[]>([]);
  const [currentTeamIdx, setCurrentTeamIdx] = useState(() => Math.floor(Math.random() * teams.length));
  const [usedAnswers, setUsedAnswers] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [victoriesByTeam, setVictoriesByTeam] = useState<Record<string, number>>(() => initialVictories(teams));
  const [matches, setMatches] = useState<Round4MatchSummary[]>([]);
  const [lastMatchWinnerId, setLastMatchWinnerId] = useState<string | null>(null);
  const [lastElimination, setLastElimination] = useState<{ teamId: string; reason: "timeout" | "invalid" } | null>(null);

  const activeTeamIdsRef = useRef(activeTeamIds);
  const eliminatedTeamIdsRef = useRef(eliminatedTeamIds);
  const currentTeamIdxRef = useRef(currentTeamIdx);
  const usedAnswersRef = useRef(usedAnswers);
  const victoriesRef = useRef(victoriesByTeam);
  const matchesRef = useRef(matches);
  const matchNumberRef = useRef(matchNumber);
  const currentTopicRef = useRef(currentTopic);

  activeTeamIdsRef.current = activeTeamIds;
  eliminatedTeamIdsRef.current = eliminatedTeamIds;
  currentTeamIdxRef.current = currentTeamIdx;
  usedAnswersRef.current = usedAnswers;
  victoriesRef.current = victoriesByTeam;
  matchesRef.current = matches;
  matchNumberRef.current = matchNumber;
  currentTopicRef.current = currentTopic;

  const currentTeamId = activeTeamIds[currentTeamIdx] ?? activeTeamIds[0];
  const currentTeam = teams.find((team) => team.id === currentTeamId) ?? teams[0];
  const tc = currentTeam ? TEAM_COLOR[currentTeam.color] : TEAM_COLOR.violet;

  const completeRound = (
    winnerTeamId: string,
    nextVictories: Record<string, number>,
    nextMatches: Round4MatchSummary[]
  ) => {
    timer.stop();
    setPhase("finished");

    if (gameCtx) {
      setGame({
        ...gameCtx,
        teams: gameCtx.teams.map((team) =>
          team.id === winnerTeamId ? { ...team, score: team.score + POINTS_WIN } : team
        ),
      });
    }

    onComplete({
      winnerTeamId,
      victoriesByTeam: nextVictories,
      winsToWin: setup.winsToWin,
      matches: nextMatches,
    });
  };

  const finishMatch = (winnerTeamId: string, finalEliminated: string[], finalAnswers: string[]) => {
    timer.stop();

    const nextVictories = {
      ...victoriesRef.current,
      [winnerTeamId]: (victoriesRef.current[winnerTeamId] ?? 0) + 1,
    };
    const summary: Round4MatchSummary = {
      matchNumber: matchNumberRef.current,
      topic: currentTopicRef.current,
      winnerTeamId,
      eliminatedTeamIds: finalEliminated,
      usedAnswers: finalAnswers,
    };
    const nextMatches = [...matchesRef.current, summary];

    victoriesRef.current = nextVictories;
    matchesRef.current = nextMatches;
    setVictoriesByTeam(nextVictories);
    setMatches(nextMatches);
    setLastMatchWinnerId(winnerTeamId);

    if ((nextVictories[winnerTeamId] ?? 0) >= setup.winsToWin) {
      completeRound(winnerTeamId, nextVictories, nextMatches);
      return;
    }

    setNextTopic("");
    setPhase("between");
  };

  const eliminateCurrentTeam = (reason: "timeout" | "invalid") => {
    const currentIds = activeTeamIdsRef.current;
    const idx = currentTeamIdxRef.current;
    const lostId = currentIds[idx];
    if (!lostId || currentIds.length <= 1) return;

    timer.stop();
    const nextEliminated = [...eliminatedTeamIdsRef.current, lostId];
    const nextActive = currentIds.filter((teamId) => teamId !== lostId);

    eliminatedTeamIdsRef.current = nextEliminated;
    setEliminatedTeamIds(nextEliminated);
    setLastElimination({ teamId: lostId, reason });
    setCurrentInput("");

    if (nextActive.length === 1) {
      activeTeamIdsRef.current = nextActive;
      setActiveTeamIds(nextActive);
      finishMatch(nextActive[0], nextEliminated, usedAnswersRef.current);
      return;
    }

    const nextIdx = idx % nextActive.length;
    activeTeamIdsRef.current = nextActive;
    currentTeamIdxRef.current = nextIdx;
    setActiveTeamIds(nextActive);
    setCurrentTeamIdx(nextIdx);
  };

  const handleTimeout = () => eliminateCurrentTeam("timeout");

  useEffect(() => {
    if (phase === "turn" && activeTeamIds.length > 1) {
      timer.start(setup.turnDuration, handleTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeamIdx, activeTeamIds, phase, currentTopic]);

  const handleValid = () => {
    const answer = currentInput.trim();
    if (!answer || activeTeamIds.length <= 1) return;

    timer.stop();
    const nextAnswers = [...usedAnswers, answer];
    usedAnswersRef.current = nextAnswers;
    setUsedAnswers(nextAnswers);
    setCurrentInput("");
    setLastElimination(null);

    const nextIdx = (currentTeamIdx + 1) % activeTeamIds.length;
    currentTeamIdxRef.current = nextIdx;
    setCurrentTeamIdx(nextIdx);
  };

  const startNextMatch = () => {
    const topic = nextTopic.trim();
    if (!topic) return;

    const allIds = teams.map((team) => team.id);
    const randomIdx = Math.floor(Math.random() * allIds.length);
    const nextNumber = matchNumber + 1;

    setCurrentTopic(topic);
    currentTopicRef.current = topic;
    setMatchNumber(nextNumber);
    matchNumberRef.current = nextNumber;
    setActiveTeamIds(allIds);
    activeTeamIdsRef.current = allIds;
    setEliminatedTeamIds([]);
    eliminatedTeamIdsRef.current = [];
    setCurrentTeamIdx(randomIdx);
    currentTeamIdxRef.current = randomIdx;
    setUsedAnswers([]);
    usedAnswersRef.current = [];
    setCurrentInput("");
    setLastElimination(null);
    setLastMatchWinnerId(null);
    setPhase("turn");
  };

  if (phase === "finished") return null;

  if (phase === "between") {
    const winner = teams.find((team) => team.id === lastMatchWinnerId);
    const winnerColor = winner ? TEAM_COLOR[winner.color] : TEAM_COLOR.violet;

    return (
      <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
        <header className="px-4 pt-6 pb-4 border-b border-canvas-700/60 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Ronda 4 · Mini-partida {matchNumber}
          </p>
          <h1 className="text-3xl font-black">Victoria de {winner?.name ?? "equipo"}</h1>
          <p className="text-zinc-500 text-sm mt-1">Todos vuelven a entrar en la siguiente.</p>
        </header>

        <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-5">
          <section className={`rounded-2xl border p-5 text-center ${winnerColor.soft}`}>
            <p className="text-4xl mb-2">🏆</p>
            <p className={`text-2xl font-black ${winnerColor.text}`}>{winner?.name}</p>
            <p className="text-zinc-400 text-sm mt-1">
              {(victoriesByTeam[winner?.id ?? ""] ?? 0)}/{setup.winsToWin} victorias
            </p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            {teams.map((team) => {
              const color = TEAM_COLOR[team.color];
              const wins = victoriesByTeam[team.id] ?? 0;
              return (
                <div key={team.id} className="rounded-2xl bg-canvas-900 border border-canvas-700 p-4 text-center">
                  <p className={`text-sm font-black ${color.text}`}>{team.name}</p>
                  <div className="mt-2 flex gap-1 justify-center min-h-6">
                    {Array.from({ length: setup.winsToWin }).map((_, index) => (
                      <span key={index} className={index < wins ? "text-amber-300" : "text-zinc-700"}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">{wins}/{setup.winsToWin}</p>
                </div>
              );
            })}
          </section>

          <section className="bg-canvas-900 border border-canvas-700 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Siguiente reto</p>
              <p className="text-xs text-zinc-600 mt-1">Nuevo reto, mismas vidas: una por equipo.</p>
            </div>
            <input
              type="text"
              value={nextTopic}
              onChange={(event) => setNextTopic(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && nextTopic.trim() && startNextMatch()}
              placeholder="Ej: Canciones con nombres de ciudades…"
              autoFocus
              className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500"
            />
          </section>

          <button
            onClick={startNextMatch}
            disabled={!nextTopic.trim()}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
              nextTopic.trim()
                ? "bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900"
                : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Empezar mini-partida {matchNumber + 1} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas-950 text-white flex flex-col">
      <header className="px-4 pt-5 pb-3 border-b border-canvas-700/60">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Ronda 4 · Cultura musical · Partida {matchNumber}
            </p>
            <p className="text-sm font-bold text-white mt-0.5 truncate">{currentTopic}</p>
          </div>
          <span className="text-xs font-black text-zinc-500 flex-shrink-0">
            {activeTeamIds.length}/{teams.length} vivos
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-canvas-700/60 sm:grid-cols-4">
        {teams.map((team) => {
          const color = TEAM_COLOR[team.color];
          const isAlive = activeTeamIds.includes(team.id);
          const isCurrent = team.id === currentTeamId;
          const wins = victoriesByTeam[team.id] ?? 0;
          return (
            <div
              key={team.id}
              className={`rounded-xl border px-3 py-2 text-center transition-all ${
                isCurrent
                  ? `${color.badge} border-transparent text-white shadow-lg`
                  : isAlive
                  ? "bg-canvas-800 border-canvas-700"
                  : "bg-canvas-900/40 border-canvas-800 opacity-45"
              }`}
            >
              <p className={`text-xs font-black truncate ${isCurrent ? "text-white" : color.text}`}>{team.name}</p>
              <p className={`text-[11px] mt-1 ${isCurrent ? "text-white/70" : isAlive ? "text-green-400" : "text-red-400"}`}>
                {isAlive ? "♥ 1 vida" : "✗ eliminado"}
              </p>
              <p className={`text-[10px] mt-0.5 ${isCurrent ? "text-white/60" : "text-zinc-600"}`}>
                {wins}/{setup.winsToWin} victorias
              </p>
            </div>
          );
        })}
      </div>

      {lastElimination && (
        <div className="mx-4 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-center text-xs font-bold text-red-300">
          {teams.find((team) => team.id === lastElimination.teamId)?.name} eliminado
          {lastElimination.reason === "timeout" ? " por tiempo" : " por respuesta no válida"}. Sigue la partida.
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-between px-4 py-5 max-w-sm mx-auto w-full">
        <div className="flex-1 flex flex-col w-full gap-5 justify-center">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Turno</p>
            <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${tc.badge} text-white`}>
              {currentTeam?.name}
            </span>
          </div>

          <div className="flex justify-center">
            <TimerRing remaining={timer.remaining} progress={timer.progress} color={tc.ring} />
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Escribe la respuesta del equipo…"
              value={currentInput}
              onChange={(event) => setCurrentInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && currentInput.trim() && handleValid()}
              autoFocus
              className="w-full bg-canvas-800 border border-canvas-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-base focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => eliminateCurrentTeam("invalid")}
                className="flex-1 py-4 rounded-2xl font-black text-base bg-red-900/60 hover:bg-red-900 text-red-300 border border-red-800/50 active:scale-95 transition-all"
              >
                ✗ Falla
              </button>
              <button
                onClick={handleValid}
                disabled={!currentInput.trim()}
                className={`flex-1 py-4 rounded-2xl font-black text-base active:scale-95 transition-all ${
                  currentInput.trim()
                    ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                    : "bg-canvas-800 text-zinc-600 cursor-not-allowed"
                }`}
              >
                ✓ Válida
              </button>
            </div>
            <p className="text-center text-[11px] text-zinc-600">
              Fallo o tiempo agotado = eliminado de esta mini-partida, no de la ronda.
            </p>
          </div>

          {usedAnswers.length > 0 && (
            <div className="bg-canvas-900 border border-canvas-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-2 border-b border-canvas-700/60">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  Respuestas usadas ({usedAnswers.length})
                </p>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-canvas-700/40">
                {[...usedAnswers].reverse().map((answer, index) => (
                  <div key={`${answer}-${index}`} className="px-4 py-2 flex items-center gap-2">
                    <span className="text-zinc-600 text-xs font-mono">{usedAnswers.length - index}.</span>
                    <span className="text-sm text-zinc-300">{answer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
