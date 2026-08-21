"use client";

import { useState } from "react";
import { SONG_VALIDATION_CASES } from "@/lib/songValidationCases";

type TestStatus = "idle" | "running" | "passed" | "failed" | "error";

type TestReport = {
  passed: boolean;
  actual: string;
  title: string;
  artists: string[];
  enrichmentStatus: string;
  result?: {
    languageCodes: string[];
    isCollaboration: boolean;
    isCover: boolean;
    eurovision: boolean;
    soundtrackKinds: string[];
    sources: string[];
    warnings: string[];
  };
};

type TestState = {
  status: TestStatus;
  report?: TestReport;
  error?: string;
};

export default function ValidationSuite({ secret }: { secret: string }) {
  const [states, setStates] = useState<Record<string, TestState>>({});
  const [running, setRunning] = useState(false);

  async function runCase(testId: string) {
    setStates((current) => ({ ...current, [testId]: { status: "running" } }));
    try {
      const response = await fetch("/api/music/validation-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({ testId }),
      });
      const payload = (await response.json()) as { report?: TestReport; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "La prueba no devolvió informe");
      setStates((current) => ({
        ...current,
        [testId]: {
          status: payload.report?.passed ? "passed" : "failed",
          report: payload.report,
        },
      }));
    } catch (error) {
      setStates((current) => ({
        ...current,
        [testId]: {
          status: "error",
          error: error instanceof Error ? error.message : "Error ejecutando la prueba",
        },
      }));
    }
  }

  async function runAll() {
    if (!secret || running) return;
    setRunning(true);
    setStates({});
    try {
      for (const test of SONG_VALIDATION_CASES) {
        await runCase(test.id);
      }
    } finally {
      setRunning(false);
    }
  }

  const finished = SONG_VALIDATION_CASES.filter((test) => {
    const status = states[test.id]?.status;
    return status === "passed" || status === "failed" || status === "error";
  }).length;
  const passed = SONG_VALIDATION_CASES.filter((test) => states[test.id]?.status === "passed").length;

  return (
    <section className="game-panel rounded-[2rem] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="game-kicker">Batería de regresión</p>
          <h2 className="font-black text-xl mt-1">Pruebas de validadores</h2>
          <p className="game-muted text-sm mt-1">Cuatro canciones conocidas comprueban colaboración, cover, Eurovisión y banda sonora de extremo a extremo.</p>
        </div>
        <button
          type="button"
          onClick={runAll}
          disabled={!secret || running}
          className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40"
        >
          {running ? `Ejecutando ${finished + 1}/4…` : "Ejecutar batería"}
        </button>
      </div>

      {finished > 0 && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${finished === 4 && passed === 4 ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-canvas-600/60"}`}>
          Resultado actual: <strong>{passed}/{finished}</strong> pruebas superadas{finished < 4 ? " · ejecución en curso" : ""}
        </div>
      )}

      <div className="space-y-2">
        {SONG_VALIDATION_CASES.map((test) => {
          const state = states[test.id] ?? { status: "idle" as const };
          return (
            <div key={test.id} className="rounded-2xl border border-canvas-600/60 p-4">
              <div className="flex gap-3 justify-between items-start">
                <div>
                  <p className="font-black">{test.label} · {test.title}</p>
                  <p className="text-sm text-gold-300 font-bold">{test.artist}</p>
                  <p className="game-muted text-xs mt-1">Esperado: {test.expected}</p>
                </div>
                <TestBadge status={state.status} />
              </div>

              {state.status === "running" && <p className="text-sm game-muted mt-3">Buscando, importando y verificando…</p>}
              {(state.status === "passed" || state.status === "failed") && state.report && (
                <div className="text-sm mt-3 space-y-1">
                  <p className={state.status === "passed" ? "text-emerald-200" : "text-rose-200"}>
                    {state.status === "passed" ? "✓" : "✕"} {state.report.actual}
                  </p>
                  <p className="game-muted">Spotify: {state.report.title} · {state.report.artists.join(", ")}</p>
                  {state.report.result && (
                    <p className="game-muted text-xs">Fuentes: {state.report.result.sources.join(" + ") || "ninguna"}</p>
                  )}
                </div>
              )}
              {state.status === "error" && <p className="text-sm text-rose-200 mt-3">✕ {state.error}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TestBadge({ status }: { status: TestStatus }) {
  const copy = {
    idle: "Pendiente",
    running: "Probando…",
    passed: "OK",
    failed: "Falla",
    error: "Error",
  }[status];
  const classes = status === "passed"
    ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200"
    : status === "failed" || status === "error"
      ? "border-rose-700/40 bg-rose-950/20 text-rose-200"
      : "border-canvas-600/60 game-muted";
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>{copy}</span>;
}
