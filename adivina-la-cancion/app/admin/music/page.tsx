"use client";

import { FormEvent, useEffect, useState } from "react";

type Health = {
  spotifyConfigured: boolean;
  supabaseWriteConfigured: boolean;
  adminSecretConfigured: boolean;
};

type Candidate = {
  spotifyId: string;
  title: string;
  artists: Array<{ spotifyId: string; name: string; spotifyUrl?: string }>;
  albumName: string;
  releaseDate?: string;
  releasePrecision?: "year" | "month" | "day";
  isrc?: string;
  explicit?: boolean;
  durationMs?: number;
  spotifyUrl?: string;
};

type ImportResult = {
  status: "created" | "existing" | "linked";
  songId: string;
  artistIds: string[];
  track: Candidate;
};

type EnrichmentResult = {
  artistId: string;
  artistName: string;
  artistType: "solo" | "group" | "duo" | "unknown";
  originCountryCode?: string;
  originRegions: string[];
  genreCodes: string[];
  factsWritten: number;
  externalIdsWritten: number;
  sources: string[];
  warnings: string[];
};

const STATUS_COPY = {
  created: "Creada en el catálogo",
  existing: "Ya existía en el catálogo",
  linked: "Vinculada a una canción existente por ISRC",
} as const;

export default function MusicAdminPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [secret, setSecret] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [enrichingArtistId, setEnrichingArtistId] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [enrichments, setEnrichments] = useState<Record<string, EnrichmentResult>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/music/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data as Health))
      .catch(() => setHealth(null));
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/music/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({ title, artist: artist || undefined }),
      });
      const payload = (await response.json()) as { results?: Candidate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo buscar");
      setResults(payload.results ?? []);
      if (!payload.results?.length) setMessage("Spotify no devolvió coincidencias.");
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar");
    } finally {
      setLoading(false);
    }
  }

  async function importTrack(candidate: Candidate) {
    setError(null);
    setMessage(null);
    setImportingId(candidate.spotifyId);
    try {
      const response = await fetch("/api/music/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({ spotifyId: candidate.spotifyId }),
      });
      const payload = (await response.json()) as { result?: ImportResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo importar");
      setLastImport(payload.result);
      setMessage(`${STATUS_COPY[payload.result.status]} · ${payload.result.track.title} · ID ${payload.result.songId}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo importar");
    } finally {
      setImportingId(null);
    }
  }

  async function enrichImportedArtist(artistId: string) {
    setError(null);
    setMessage(null);
    setEnrichingArtistId(artistId);
    try {
      const response = await fetch("/api/music/enrich-artist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-music-admin-secret": secret,
        },
        body: JSON.stringify({ artistId }),
      });
      const payload = (await response.json()) as { result?: EnrichmentResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo enriquecer el artista");
      setEnrichments((current) => ({ ...current, [artistId]: payload.result as EnrichmentResult }));
      setMessage(`Enriquecido · ${payload.result.artistName} · ${payload.result.factsWritten} hechos verificados`);
    } catch (enrichmentError) {
      setError(enrichmentError instanceof Error ? enrichmentError.message : "No se pudo enriquecer el artista");
    } finally {
      setEnrichingArtistId(null);
    }
  }

  const ready = health?.spotifyConfigured && health?.supabaseWriteConfigured && health?.adminSecretConfigured;

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno</p>
          <h1 className="game-title text-4xl mt-2">Catálogo musical</h1>
          <p className="game-muted mt-3">Busca una canción en Spotify, guarda su identidad y enriquece sus artistas con fuentes verificables.</p>
        </header>

        <section className="game-panel rounded-[2rem] p-5">
          <p className="font-black mb-3">Estado del pipeline</p>
          {!health ? (
            <p className="game-muted text-sm">Comprobando configuración…</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-2 text-sm">
              <Status label="Spotify" ok={health.spotifyConfigured} />
              <Status label="Supabase escritura" ok={health.supabaseWriteConfigured} />
              <Status label="Clave admin" ok={health.adminSecretConfigured} />
            </div>
          )}
          {health && !ready && (
            <p className="mt-3 text-sm text-amber-200">Faltan variables de entorno. La pantalla está lista, pero la ingesta seguirá bloqueada hasta configurarlas.</p>
          )}
        </section>

        <form onSubmit={search} className="game-panel rounded-[2rem] p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider game-muted">Clave admin</span>
            <input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="MUSIC_ADMIN_SECRET" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Canción</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="Ej. La Flaca" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Artista · opcional</span>
              <input value={artist} onChange={(event) => setArtist(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="Ej. Jarabe de Palo" />
            </label>
          </div>
          <button disabled={loading || title.trim().length < 2 || !secret} className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40">
            {loading ? "Buscando…" : "Buscar en Spotify"}
          </button>
        </form>

        {error && <div className="rounded-2xl border border-rose-700/40 bg-rose-950/25 p-4 text-rose-200 text-sm">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/25 p-4 text-emerald-200 text-sm">{message}</div>}

        {lastImport && lastImport.artistIds.length > 0 && (
          <section className="game-panel rounded-[2rem] p-5 space-y-3">
            <div>
              <p className="game-kicker">Paso 2</p>
              <h2 className="font-black text-xl mt-1">Enriquecer artistas</h2>
              <p className="game-muted text-sm mt-1">MusicBrainz resuelve identidad, tipo, origen y géneros. Wikidata confirma tipo y país cuando hay enlace estructurado.</p>
            </div>
            {lastImport.artistIds.map((artistId, index) => {
              const enrichment = enrichments[artistId];
              const artistName = lastImport.track.artists[index]?.name ?? artistId;
              return (
                <div key={artistId} className="rounded-2xl border border-canvas-600/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div>
                    <p className="font-black">{artistName}</p>
                    {enrichment ? (
                      <div className="text-sm game-muted mt-1 space-y-1">
                        <p>{enrichment.artistType} · {enrichment.originCountryCode ?? "sin país"}{enrichment.originRegions.length ? ` · ${enrichment.originRegions.join(", ")}` : ""}</p>
                        <p>{enrichment.genreCodes.length ? enrichment.genreCodes.join(" · ") : "sin géneros canónicos"} · fuentes: {enrichment.sources.join(" + ")}</p>
                        {enrichment.warnings.map((warning) => <p key={warning} className="text-amber-200">⚠ {warning}</p>)}
                      </div>
                    ) : (
                      <p className="text-xs game-muted mt-1">Pendiente de enriquecimiento</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => enrichImportedArtist(artistId)}
                    disabled={Boolean(enrichingArtistId) || !secret}
                    className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40"
                  >
                    {enrichingArtistId === artistId ? "Enriqueciendo…" : enrichment ? "Reenriquecer" : "Enriquecer artista"}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <section className="space-y-3">
          {results.map((candidate) => (
            <article key={candidate.spotifyId} className="game-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="min-w-0">
                <h2 className="font-black text-lg truncate">{candidate.title}</h2>
                <p className="text-sm text-gold-300 font-bold">{candidate.artists.map((item) => item.name).join(", ")}</p>
                <p className="text-xs game-muted mt-1">{candidate.albumName}{candidate.releaseDate ? ` · ${candidate.releaseDate}` : ""}{candidate.isrc ? ` · ISRC ${candidate.isrc}` : ""}</p>
                {candidate.spotifyUrl && <a href={candidate.spotifyUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs underline game-muted">Abrir en Spotify</a>}
              </div>
              <button onClick={() => importTrack(candidate)} disabled={Boolean(importingId)} className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40">
                {importingId === candidate.spotifyId ? "Importando…" : "Importar"}
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border px-3 py-2 ${ok ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-rose-700/40 bg-rose-950/20 text-rose-200"}`}>{ok ? "✓" : "✕"} {label}</div>;
}
