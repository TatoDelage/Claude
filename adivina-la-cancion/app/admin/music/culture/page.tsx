"use client";

import { useMemo, useState } from "react";
import { CULTURE_JUDGE_PRESETS } from "@/lib/cultureJudgePresets";

type Candidate = {
  spotifyId: string;
  title: string;
  artists: string[];
  albumName: string;
  releaseDate?: string;
};

type Decision = {
  conditionType: string;
  status: "valid" | "invalid" | "unverifiable";
  reason: string;
  source?: string;
};

type JudgeResult = {
  status: "valid" | "invalid" | "unverifiable" | "ambiguous" | "not_found";
  prompt: string;
  candidate?: Candidate;
  candidates?: Candidate[];
  decisions: Decision[];
  warnings: string[];
};

const STATUS_COPY: Record<JudgeResult["status"], { label: string; className: string }> = {
  valid: { label: "VÁLIDA", className: "border-emerald-700/50 text-emerald-200" },
  invalid: { label: "INVÁLIDA", className: "border-rose-700/50 text-rose-200" },
  unverifiable: { label: "NO VERIFICABLE", className: "border-amber-700/50 text-amber-200" },
  ambiguous: { label: "ELEGIR VERSIÓN", className: "border-amber-700/50 text-amber-200" },
  not_found: { label: "NO ENCONTRADA", className: "border-rose-700/50 text-rose-200" },
};

export default function CultureJudgeLabPage() {
  const [secret, setSecret] = useState("");
  const [presetId, setPresetId] = useState(CULTURE_JUDGE_PRESETS[0]?.id ?? "");
  const [answerTitle, setAnswerTitle] = useState("");
  const [answerArtist, setAnswerArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState("");

  const preset = useMemo(
    () => CULTURE_JUDGE_PRESETS.find((item) => item.id === presetId) ?? CULTURE_JUDGE_PRESETS[0],
    [presetId],
  );

  function loadSuggestedAnswer() {
    if (!preset) return;
    setAnswerTitle(preset.suggestedAnswer);
    setAnswerArtist(preset.suggestedArtist ?? "");
    setResult(null);
    setError("");
  }

  async function judge(spotifyId?: string) {
    if (!secret || loading || !preset) return;
    setLoading(true);
    setError("");
    if (!spotifyId) setResult(null);

    try {
      const response = await fetch("/api/music/judge-culture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({
          presetId: preset.id,
          answerTitle,
          answerArtist,
          spotifyId,
        }),
      });
      const payload = (await response.json()) as { result?: JudgeResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo juzgar la respuesta");
      setResult(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  const statusCopy = result ? STATUS_COPY[result.status] : null;

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno · Ronda 4</p>
          <h1 className="game-title text-4xl mt-2">Juez de Cultura Musical</h1>
          <p className="game-muted mt-3">
            Simula una respuesta real: Spotify identifica la grabación y el motor comprueba únicamente condiciones verificables con catálogo y fuentes externas.
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

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider game-muted">Reto</span>
            <select
              value={presetId}
              onChange={(event) => {
                setPresetId(event.target.value);
                setResult(null);
                setError("");
              }}
              className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
            >
              {CULTURE_JUDGE_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>{item.challenge.prompt}</option>
              ))}
            </select>
          </label>

          {preset && (
            <div className="rounded-2xl border border-gold-500/30 bg-black/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-gold-300">Reto activo</p>
              <p className="text-xl font-black mt-2">{preset.challenge.prompt}</p>
              <button type="button" onClick={loadSuggestedAnswer} className="mt-3 text-sm underline game-muted">
                Cargar respuesta de prueba
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Canción</span>
              <input
                value={answerTitle}
                onChange={(event) => setAnswerTitle(event.target.value)}
                placeholder="Ej. Euphoria"
                className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Artista · opcional</span>
              <input
                value={answerArtist}
                onChange={(event) => setAnswerArtist(event.target.value)}
                placeholder="Ej. Loreen"
                className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => judge()}
            disabled={!secret || answerTitle.trim().length < 2 || loading}
            className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40"
          >
            {loading ? "Juzgando…" : "Juzgar respuesta"}
          </button>
        </section>

        {error && <div className="rounded-2xl border border-rose-700/50 p-4 text-rose-200">✕ {error}</div>}

        {result && (
          <section className="game-panel rounded-[2rem] p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="game-kicker">Resultado</p>
                <h2 className="text-2xl font-black mt-1">{result.candidate ? `${result.candidate.title} · ${result.candidate.artists.join(", ")}` : result.prompt}</h2>
              </div>
              {statusCopy && <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusCopy.className}`}>{statusCopy.label}</span>}
            </div>

            {result.status === "ambiguous" && result.candidates?.length ? (
              <div className="space-y-2">
                <p className="game-muted text-sm">Spotify encontró varias grabaciones posibles. Elige la correcta:</p>
                {result.candidates.map((candidate) => (
                  <button
                    key={candidate.spotifyId}
                    type="button"
                    onClick={() => judge(candidate.spotifyId)}
                    disabled={loading}
                    className="w-full text-left rounded-xl border border-canvas-600 p-3 hover:bg-white/5 disabled:opacity-40"
                  >
                    <strong>{candidate.title}</strong> · {candidate.artists.join(", ")}
                    <span className="block text-xs game-muted mt-1">{candidate.albumName}{candidate.releaseDate ? ` · ${candidate.releaseDate}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {result.decisions.length > 0 && (
              <div className="space-y-2">
                {result.decisions.map((decision, index) => (
                  <div key={`${decision.conditionType}-${index}`} className="rounded-xl border border-canvas-600/60 p-3">
                    <p className={decision.status === "valid" ? "text-emerald-200" : decision.status === "invalid" ? "text-rose-200" : "text-amber-200"}>
                      {decision.status === "valid" ? "✓" : decision.status === "invalid" ? "✕" : "⚠"} {decision.reason}
                    </p>
                    {decision.source && <p className="text-xs game-muted mt-1">Fuente: {decision.source}</p>}
                  </div>
                ))}
              </div>
            )}

            {result.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-200">⚠ {warning}</p>
            ))}
          </section>
        )}

        <section className="rounded-2xl border border-canvas-600/60 p-4 text-sm game-muted">
          <p><strong>Regla del juez:</strong> solo devuelve INVÁLIDA cuando puede demostrar que la condición no se cumple. Si falta cobertura, devuelve NO VERIFICABLE. La ausencia de un dato positivo nunca se convierte automáticamente en un “no”.</p>
        </section>
      </div>
    </main>
  );
}
