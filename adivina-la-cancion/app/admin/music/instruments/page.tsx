"use client";

import { useEffect, useState } from "react";
import { INSTRUMENT_VALIDATION_CASES } from "@/lib/instrumentValidationCases";

type Health = {
  spotifyConfigured?: boolean;
  supabaseWriteConfigured?: boolean;
  adminSecretConfigured?: boolean;
  discogsConfigured?: boolean;
};

type TestResult = {
  passed: boolean;
  actual: string;
  detectedInstruments: string[];
  title: string;
  artists: string[];
  sources: string[];
  warnings: string[];
  fallback?: {
    status: "verified" | "unverifiable";
    provider?: "musicbrainz" | "discogs";
    reason: string;
    sourceUrl?: string;
  };
};

type RowState = {
  status: "idle" | "running" | "done" | "error";
  result?: TestResult;
  error?: string;
};

export default function InstrumentLabPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    fetch("/api/music/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data as Health))
      .catch(() => setHealth(null));
  }, []);

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
            MusicBrainz verifica primero créditos explícitos de grabación. Si falta el instrumento y Discogs está configurado, buscamos un crédito específico de pista como segunda fuente. Ausencia de crédito sigue significando desconocido, nunca ausencia del instrumento.
          </p>
          <a href="/admin/music" className="inline-block mt-3 text-sm underline game-muted">← Volver al catálogo</a>
        </header>

        <section className="game-panel rounded-[2rem] p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <Status label="MusicBrainz" ok />
            <Status label="Discogs fallback" ok={Boolean(health?.discogsConfigured)} />
          </div>
          {health && !health.discogsConfigured && (
            <p className="text-sm text-amber-200">Falta DISCOGS_TOKEN en Vercel. La batería funciona, pero solo medirá MusicBrainz hasta que lo configures.</p>
          )}
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
                    {result.fallback?.provider === "discogs" && result.fallback.sourceUrl && (
                      <p>
                        <a href={result.fallback.sourceUrl} target="_blank" rel="noreferrer" className="underline">Data provided by Discogs</a>
                      </p>
                    )}
                    {result.fallback?.status === "unverifiable" && <p className="text-amber-200">⚠ {result.fallback.reason}</p>}
                    {result.warnings.map((warning) => <p key={warning} className="text-amber-200">⚠ {warning}</p>)}
                  </div>
                )}

                {state.status === "error" && <p className="mt-4 text-sm text-rose-200">✕ {state.error}</p>}
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-canvas-600/60 p-4 text-sm game-muted space-y-2">
          <p><strong>Criterio:</strong> MusicBrainz es la primera capa. Discogs solo entra cuando falta el instrumento esperado. Si ambas fuentes carecen de crédito específico, el resultado queda no verificable.</p>
          <p className="text-xs">This application uses Discogs’ API but is not affiliated with, sponsored or endorsed by Discogs. “Discogs” is a trademark of Zink Media, LLC.</p>
        </section>
      </div>
    </main>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border px-3 py-2 ${ok ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-rose-700/40 bg-rose-950/20 text-rose-200"}`}>{ok ? "✓" : "✕"} {label}</div>;
}
