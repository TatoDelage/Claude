"use client";

import { useState } from "react";
import { INSTRUMENT_VALIDATION_CASES } from "@/lib/instrumentValidationCases";

type TestResult = {
  passed: boolean;
  actual: string;
  detectedInstruments: string[];
  title: string;
  artists: string[];
  sources: string[];
  warnings: string[];
};

type RowState = {
  status: "idle" | "running" | "done" | "error";
  result?: TestResult;
  error?: string;
};

export default function InstrumentLabPage() {
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  async function runBattery() {
    if (!secret || running) return;
    setRunning(true);
    setRows({});

    for (const test of INSTRUMENT_VALIDATION_CASES) {
      setRows((current) => ({ ...current, [test.id]: { status: "running" } }));
      try {
        const response = await fetch("/api/music/instrumentation-test", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
          body: JSON.stringify({ testId: test.id }),
        });
        const payload = (await response.json()) as { result?: TestResult; error?: string };
        if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo ejecutar la prueba");
        setRows((current) => ({ ...current, [test.id]: { status: "done", result: payload.result } }));
      } catch (error) {
        setRows((current) => ({
          ...current,
          [test.id]: {
            status: "error",
            error: error instanceof Error ? error.message : "Error desconocido",
          },
        }));
      }
    }

    setRunning(false);
  }

  const finished = INSTRUMENT_VALIDATION_CASES.filter((test) => rows[test.id]?.status === "done").length;
  const passed = INSTRUMENT_VALIDATION_CASES.filter((test) => rows[test.id]?.result?.passed).length;

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno · Instrumentación</p>
          <h1 className="game-title text-4xl mt-2">Cobertura de instrumentos</h1>
          <p className="game-muted mt-3">
            Mide qué instrumentos puede verificar MusicBrainz usando créditos explícitos de la grabación. Ausencia de crédito significa desconocido, nunca ausencia del instrumento.
          </p>
          <a href="/admin/music" className="inline-block mt-3 text-sm underline game-muted">← Volver al catálogo</a>
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
          <button
            type="button"
            onClick={runBattery}
            disabled={!secret || running}
            className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40"
          >
            {running ? "Ejecutando batería…" : "Ejecutar batería de instrumentos"}
          </button>
          <p className="text-sm game-muted">
            Resultado actual: <strong>{passed}/{INSTRUMENT_VALIDATION_CASES.length}</strong> detectados
            {finished > 0 && finished < INSTRUMENT_VALIDATION_CASES.length ? ` · ${finished} terminados` : ""}
          </p>
        </section>

        <section className="space-y-3">
          {INSTRUMENT_VALIDATION_CASES.map((test) => {
            const state = rows[test.id] ?? { status: "idle" as const };
            const result = state.result;
            return (
              <article key={test.id} className="game-panel rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-black text-lg">{test.label} · {test.title}</h2>
                    <p className="text-sm text-gold-300 font-bold">{test.artist}</p>
                    <p className="text-xs game-muted mt-1">Esperado: {test.expectedLabel}</p>
                  </div>
                  {state.status === "running" && <span className="rounded-full border border-amber-700/40 px-3 py-1 text-xs text-amber-200">Probando…</span>}
                  {state.status === "done" && <span className={`rounded-full border px-3 py-1 text-xs ${result?.passed ? "border-emerald-700/40 text-emerald-200" : "border-rose-700/40 text-rose-200"}`}>{result?.passed ? "OK" : "Sin cobertura"}</span>}
                  {state.status === "error" && <span className="rounded-full border border-rose-700/40 px-3 py-1 text-xs text-rose-200">Error</span>}
                </div>

                {result && (
                  <div className="mt-4 text-sm game-muted space-y-1">
                    <p className={result.passed ? "text-emerald-200" : "text-amber-200"}>{result.passed ? "✓" : "⚠"} {result.actual}</p>
                    <p>Detectados: {result.detectedInstruments.length ? result.detectedInstruments.join(" · ") : "ninguno"}</p>
                    <p>Fuentes: {result.sources.join(" + ") || "sin fuente"}</p>
                    {result.warnings.map((warning) => <p key={warning} className="text-amber-200">⚠ {warning}</p>)}
                  </div>
                )}

                {state.status === "error" && <p className="mt-4 text-sm text-rose-200">✕ {state.error}</p>}
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-canvas-600/60 p-4 text-sm game-muted">
          <p><strong>Criterio:</strong> un 5/5 sería excelente. Un 3/5 ya justificaría usar MusicBrainz como primera capa y Discogs como respaldo. Un 0–2/5 significaría que conviene tratar la instrumentación como índice curado desde el principio.</p>
        </section>
      </div>
    </main>
  );
}
