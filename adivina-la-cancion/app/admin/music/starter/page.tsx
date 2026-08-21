"use client";

import { useMemo, useState } from "react";
import { STARTER_CATALOG_PACKS } from "@/lib/starterCatalog";

type ImportCandidate = {
  spotifyId: string;
  title: string;
  artists: string[];
  albumName: string;
  releaseDate?: string;
};

type ItemState = {
  phase: "importing" | "imported" | "review" | "error" | "enriching" | "enriched" | "warning";
  message?: string;
  candidates?: ImportCandidate[];
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function StarterCatalogPage() {
  const [secret, setSecret] = useState("");
  const [imported, setImported] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [busyPack, setBusyPack] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");

  const totalSeeds = useMemo(
    () => STARTER_CATALOG_PACKS.reduce((total, pack) => total + pack.seeds.length, 0),
    [],
  );

  async function api(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-music-admin-secret": secret,
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { result?: any; error?: string };
    if (!response.ok || !payload.result) throw new Error(payload.error || "La operación falló");
    return payload.result;
  }

  async function refreshStatus() {
    if (!secret || statusLoading) return;
    setStatusLoading(true);
    setError("");
    try {
      const result = await api("/api/music/starter/status", {});
      const next: Record<string, string> = {};
      for (const row of result.imported as Array<{ seedId: string; songId: string }>) next[row.seedId] = row.songId;
      setImported(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el progreso");
    } finally {
      setStatusLoading(false);
    }
  }

  async function importOne(seedId: string, spotifyId?: string) {
    setStates((current) => ({ ...current, [seedId]: { phase: "importing" } }));
    try {
      const result = await api("/api/music/starter/import", { seedId, spotifyId });
      if (result.status === "needs_review") {
        setStates((current) => ({
          ...current,
          [seedId]: {
            phase: "review",
            message: result.reason,
            candidates: result.candidates ?? [],
          },
        }));
        return false;
      }
      if (result.songId) {
        setImported((current) => ({ ...current, [seedId]: result.songId }));
      }
      setStates((current) => ({
        ...current,
        [seedId]: {
          phase: "imported",
          message: result.status === "existing" ? "Ya estaba en el catálogo" : "Importada desde Spotify",
        },
      }));
      return true;
    } catch (cause) {
      setStates((current) => ({
        ...current,
        [seedId]: { phase: "error", message: cause instanceof Error ? cause.message : "Error de importación" },
      }));
      return false;
    }
  }

  async function importPack(packId: string) {
    if (!secret || busyPack) return;
    const pack = STARTER_CATALOG_PACKS.find((item) => item.id === packId);
    if (!pack) return;
    setBusyPack(packId);
    setError("");
    try {
      for (const seed of pack.seeds) {
        if (imported[seed.id]) continue;
        await importOne(seed.id);
        await wait(350);
      }
    } finally {
      setBusyPack("");
    }
  }

  async function enrichPack(packId: string) {
    if (!secret || busyPack) return;
    const pack = STARTER_CATALOG_PACKS.find((item) => item.id === packId);
    if (!pack) return;
    setBusyPack(packId);
    setError("");
    try {
      for (const seed of pack.seeds) {
        const songId = imported[seed.id];
        if (!songId || states[seed.id]?.phase === "enriched") continue;
        setStates((current) => ({ ...current, [seed.id]: { phase: "enriching" } }));
        try {
          const result = await api("/api/music/starter/enrich", { songId });
          setStates((current) => ({
            ...current,
            [seed.id]: {
              phase: result.ok ? "enriched" : "warning",
              message: result.ok
                ? "Artista y canción enriquecidos"
                : (result.warnings?.join(" · ") || `Estado canción: ${result.songStatus}`),
            },
          }));
        } catch (cause) {
          setStates((current) => ({
            ...current,
            [seed.id]: { phase: "warning", message: cause instanceof Error ? cause.message : "Fallo de enriquecimiento" },
          }));
        }
        // MusicBrainz is deliberately treated gently. Each item already rate-limits internally;
        // this extra gap avoids hammering it across separate serverless invocations.
        await wait(1800);
      }
    } finally {
      setBusyPack("");
    }
  }

  const importedCount = Object.keys(imported).length;
  const issues = STARTER_CATALOG_PACKS.flatMap((pack) => pack.seeds)
    .filter((seed) => ["review", "error", "warning"].includes(states[seed.id]?.phase ?? ""));

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno · Music Engine</p>
          <h1 className="game-title text-4xl mt-2">Catálogo inicial · 240 canciones</h1>
          <p className="game-muted mt-3">
            Doce packs curados de 20 canciones. Primero resolvemos identidad con Spotify; después enriquecemos en cola lenta con MusicBrainz y Wikidata.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <a href="/admin/music" className="underline game-muted">← Catálogo musical</a>
            <a href="/admin/music/culture/generator" className="underline game-muted">Generador R4</a>
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refreshStatus}
              disabled={!secret || statusLoading || Boolean(busyPack)}
              className="game-primary rounded-xl px-5 py-3 font-black disabled:opacity-40"
            >
              {statusLoading ? "Leyendo…" : "Actualizar progreso"}
            </button>
            <strong>{importedCount}/{totalSeeds} importadas</strong>
          </div>
          <p className="text-sm game-muted">
            La importación es reanudable. Si una coincidencia es dudosa se detiene solo esa canción, no el pack entero.
          </p>
        </section>

        {error && <div className="rounded-2xl border border-rose-700/50 p-4 text-rose-200">✕ {error}</div>}

        <section className="grid md:grid-cols-2 gap-4">
          {STARTER_CATALOG_PACKS.map((pack) => {
            const packImported = pack.seeds.filter((seed) => imported[seed.id]).length;
            const packEnriched = pack.seeds.filter((seed) => states[seed.id]?.phase === "enriched").length;
            const running = busyPack === pack.id;
            return (
              <article key={pack.id} className="game-panel rounded-[1.6rem] p-5 space-y-3">
                <div>
                  <h2 className="text-xl font-black">{pack.name}</h2>
                  <p className="text-sm game-muted mt-1">{pack.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-canvas-600 px-3 py-1">Spotify {packImported}/20</span>
                  <span className="rounded-full border border-canvas-600 px-3 py-1">Enriquecidas esta sesión {packEnriched}/20</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => importPack(pack.id)}
                    disabled={!secret || Boolean(busyPack) || packImported === pack.seeds.length}
                    className="game-primary rounded-xl px-3 py-2 font-black disabled:opacity-40"
                  >
                    {running ? "Procesando…" : packImported === 20 ? "Spotify completo" : `Importar ${20 - packImported}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => enrichPack(pack.id)}
                    disabled={!secret || Boolean(busyPack) || packImported === 0}
                    className="rounded-xl border border-canvas-600 px-3 py-2 font-black disabled:opacity-40"
                  >
                    {running ? "Procesando…" : "Enriquecer importadas"}
                  </button>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer game-muted">Ver canciones</summary>
                  <div className="mt-3 space-y-2">
                    {pack.seeds.map((seed) => {
                      const state = states[seed.id];
                      return (
                        <div key={seed.id} className="rounded-xl border border-canvas-600/50 p-3">
                          <div className="flex justify-between gap-3">
                            <span><strong>{seed.title}</strong> · {seed.artist}</span>
                            <span className="text-xs game-muted">
                              {state?.phase === "importing" ? "Spotify…" :
                                state?.phase === "enriching" ? "Enriqueciendo…" :
                                state?.phase === "enriched" ? "✓ enriquecida" :
                                state?.phase === "review" ? "⚠ revisar" :
                                state?.phase === "error" ? "✕ error" :
                                state?.phase === "warning" ? "⚠ parcial" :
                                imported[seed.id] ? "✓ importada" : "pendiente"}
                            </span>
                          </div>
                          {state?.message && <p className="text-xs game-muted mt-1">{state.message}</p>}
                          {state?.phase === "review" && state.candidates?.length ? (
                            <div className="mt-2 space-y-1">
                              {state.candidates.map((candidate) => (
                                <button
                                  key={candidate.spotifyId}
                                  type="button"
                                  onClick={() => importOne(seed.id, candidate.spotifyId)}
                                  disabled={Boolean(busyPack)}
                                  className="block w-full text-left rounded-lg border border-canvas-600/60 p-2 text-xs hover:bg-white/5"
                                >
                                  {candidate.title} · {candidate.artists.join(", ")} · {candidate.albumName}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </article>
            );
          })}
        </section>

        {issues.length > 0 && (
          <section className="rounded-[1.6rem] border border-amber-700/40 p-5">
            <h2 className="text-xl font-black">Incidencias de esta sesión · {issues.length}</h2>
            <p className="text-sm game-muted mt-1">No bloquean el resto del catálogo. Puedes resolverlas dentro de cada pack.</p>
          </section>
        )}

        <section className="rounded-2xl border border-canvas-600/60 p-4 text-sm game-muted">
          <strong>Orden recomendado:</strong> importar un pack completo, revisar sus coincidencias dudosas y después enriquecerlo. No abras varios packs a la vez: las fuentes públicas tienen límites y no queremos convertir una fiesta musical en un ataque DDoS accidental.
        </section>
      </div>
    </main>
  );
}
