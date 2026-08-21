"use client";

import { useMemo, useState } from "react";
import type { CultureChallenge } from "@/lib/cultureChallenges";

type Mode = "development" | "game";

type Candidate = {
  key: string;
  challenge: CultureChallenge;
  knownAnswerCount: number;
  sampleAnswers: string[];
  requiredKnownAnswers: number;
  ready: boolean;
  readinessReason: string;
  validatorKind: string;
};

type GenerationReport = {
  mode: Mode;
  requestedCount: number;
  generatedCount: number;
  catalogSongCount: number;
  selected: Candidate[];
  readyCandidates: Candidate[];
  blockedCandidates: Candidate[];
  warnings: string[];
};

type JudgeResult = {
  status: "valid" | "invalid" | "unverifiable" | "ambiguous" | "not_found";
  candidate?: { title: string; artists: string[] };
  decisions: Array<{ status: "valid" | "invalid" | "unverifiable"; reason: string; source?: string }>;
  warnings: string[];
};

const STATUS_LABEL: Record<JudgeResult["status"], string> = {
  valid: "VÁLIDA",
  invalid: "INVÁLIDA",
  unverifiable: "NO VERIFICABLE",
  ambiguous: "AMBIGUA",
  not_found: "NO ENCONTRADA",
};

export default function CultureGeneratorLabPage() {
  const [secret, setSecret] = useState("");
  const [mode, setMode] = useState<Mode>("development");
  const [count, setCount] = useState(9);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [error, setError] = useState("");
  const [judgingKey, setJudgingKey] = useState("");
  const [judgeResults, setJudgeResults] = useState<Record<string, JudgeResult>>({});

  const blockedPreview = useMemo(() => report?.blockedCandidates.slice(0, 12) ?? [], [report]);

  async function generate() {
    if (!secret || loading) return;
    setLoading(true);
    setError("");
    setReport(null);
    setJudgeResults({});
    try {
      const response = await fetch("/api/music/generate-culture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({ mode, count, seed: `${Date.now()}` }),
      });
      const payload = (await response.json()) as { result?: GenerationReport; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo generar la ronda");
      setReport(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function testAnchor(candidate: Candidate) {
    const answer = candidate.sampleAnswers[0];
    if (!answer || !secret || judgingKey) return;
    setJudgingKey(candidate.key);
    setError("");
    try {
      const response = await fetch("/api/music/judge-culture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({
          challenge: candidate.challenge,
          answerTitle: answer,
        }),
      });
      const payload = (await response.json()) as { result?: JudgeResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo juzgar la respuesta ancla");
      setJudgeResults((current) => ({ ...current, [candidate.key]: payload.result as JudgeResult }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error probando el reto");
    } finally {
      setJudgingKey("");
    }
  }

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno · Ronda 4</p>
          <h1 className="game-title text-4xl mt-2">Generador de Cultura Musical</h1>
          <p className="game-muted mt-3">
            Construye retos desde cobertura real del catálogo. Un reto sin suficientes respuestas verificables queda bloqueado en lugar de colarse en una partida.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <a href="/admin/music/culture" className="underline game-muted">← Juez de Cultura Musical</a>
            <a href="/admin/music" className="underline game-muted">Catálogo musical</a>
          </div>
        </header>

        <section className="game-panel rounded-[2rem] p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider game-muted">Clave admin</span>
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
            />
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Modo</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
                className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
              >
                <option value="development">Desarrollo · 1 ancla basta</option>
                <option value="game">Partida · cobertura segura</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Retos a preparar</span>
              <input
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(event) => setCount(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-canvas-600/60 p-4 text-sm game-muted">
            {mode === "development"
              ? "Desarrollo sirve para comprobar que el generador y el juez se entienden. No significa que el reto tenga suficientes respuestas para una partida completa."
              : "Partida exige 6 respuestas ancla por defecto y 8 para letras o instrumentos, donde la cobertura externa es más irregular."}
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={!secret || loading}
            className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40"
          >
            {loading ? "Midiendo cobertura…" : "Generar ronda"}
          </button>
        </section>

        {error && <div className="rounded-2xl border border-rose-700/50 p-4 text-rose-200">✕ {error}</div>}

        {report && (
          <>
            <section className="grid sm:grid-cols-3 gap-3">
              <div className="game-panel rounded-2xl p-4">
                <p className="text-xs uppercase font-black game-muted">Catálogo</p>
                <p className="text-3xl font-black mt-1">{report.catalogSongCount}</p>
                <p className="text-xs game-muted">canciones</p>
              </div>
              <div className="game-panel rounded-2xl p-4">
                <p className="text-xs uppercase font-black game-muted">Retos listos</p>
                <p className="text-3xl font-black mt-1">{report.readyCandidates.length}</p>
                <p className="text-xs game-muted">con cobertura suficiente</p>
              </div>
              <div className="game-panel rounded-2xl p-4">
                <p className="text-xs uppercase font-black game-muted">Ronda</p>
                <p className="text-3xl font-black mt-1">{report.generatedCount}/{report.requestedCount}</p>
                <p className="text-xs game-muted">retos generados</p>
              </div>
            </section>

            {report.warnings.map((warning) => (
              <div key={warning} className="rounded-2xl border border-amber-700/40 p-4 text-amber-100">⚠ {warning}</div>
            ))}

            <section className="game-panel rounded-[2rem] p-5 space-y-4">
              <div>
                <p className="game-kicker">Ronda generada</p>
                <h2 className="text-2xl font-black mt-1">Retos seleccionados</h2>
              </div>

              {report.selected.length === 0 ? (
                <p className="game-muted">No hay todavía retos con la cobertura exigida en este modo.</p>
              ) : (
                <div className="space-y-3">
                  {report.selected.map((candidate, index) => {
                    const judged = judgeResults[candidate.key];
                    return (
                      <article key={candidate.key} className="rounded-2xl border border-canvas-600/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wider text-gold-300">Reto {index + 1} · {candidate.challenge.difficulty}</p>
                            <h3 className="text-xl font-black mt-1">{candidate.challenge.prompt}</h3>
                            <p className="text-sm game-muted mt-2">
                              {candidate.knownAnswerCount} respuestas ancla · familia {candidate.challenge.family} · validador {candidate.validatorKind}
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-700/50 px-3 py-1 text-xs font-black text-emerald-200">LISTO</span>
                        </div>

                        {candidate.sampleAnswers.length > 0 && (
                          <p className="text-sm game-muted mt-3">Anclas: {candidate.sampleAnswers.join(" · ")}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => testAnchor(candidate)}
                          disabled={!candidate.sampleAnswers[0] || Boolean(judgingKey)}
                          className="mt-3 rounded-xl border border-canvas-600 px-4 py-2 text-sm font-bold disabled:opacity-40"
                        >
                          {judgingKey === candidate.key ? "Probando…" : "Probar primera ancla con el juez"}
                        </button>

                        {judged && (
                          <div className={`mt-3 rounded-xl border p-3 ${judged.status === "valid" ? "border-emerald-700/50 text-emerald-100" : judged.status === "invalid" ? "border-rose-700/50 text-rose-100" : "border-amber-700/50 text-amber-100"}`}>
                            <strong>{STATUS_LABEL[judged.status]}</strong>
                            {judged.candidate && <span> · {judged.candidate.title} · {judged.candidate.artists.join(", ")}</span>}
                            {judged.decisions.map((decision, decisionIndex) => (
                              <p key={decisionIndex} className="text-sm mt-1">{decision.status === "valid" ? "✓" : decision.status === "invalid" ? "✕" : "⚠"} {decision.reason}</p>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="game-panel rounded-[2rem] p-5 space-y-4">
              <div>
                <p className="game-kicker">Cobertura insuficiente</p>
                <h2 className="text-2xl font-black mt-1">Retos bloqueados</h2>
                <p className="game-muted text-sm mt-2">Los primeros 12 candidatos más cercanos al umbral. No entran en la ronda.</p>
              </div>
              {blockedPreview.length === 0 ? (
                <p className="text-emerald-200">✓ No hay candidatos bloqueados en este modo.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {blockedPreview.map((candidate) => (
                    <div key={candidate.key} className="rounded-xl border border-canvas-600/60 p-3">
                      <p className="font-bold">{candidate.challenge.prompt}</p>
                      <p className="text-sm text-amber-200 mt-1">{candidate.readinessReason}</p>
                      {candidate.sampleAnswers.length > 0 && <p className="text-xs game-muted mt-2">Ej.: {candidate.sampleAnswers.join(" · ")}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
