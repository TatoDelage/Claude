"use client";

import { FormEvent, useEffect, useState } from "react";

type PipelineStatus = "pending" | "processing" | "enriched" | "failed";

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

type ArtistEnrichmentResult = {
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

type ArtistEnrichmentState = {
  artistId: string;
  artistName: string;
  status: PipelineStatus;
  attemptedAt?: string;
  error?: string;
  result?: ArtistEnrichmentResult;
};

type SongEnrichmentResult = {
  songId: string;
  songTitle: string;
  languageCodes: string[];
  isCollaboration: boolean;
  isCover: boolean;
  isInstrumental: boolean;
  eurovision: boolean;
  soundtrackKinds: string[];
  factsWritten: number;
  externalIdsWritten: number;
  sources: string[];
  warnings: string[];
};

type SongEnrichmentState = {
  songId: string;
  songTitle: string;
  status: PipelineStatus;
  attemptedAt?: string;
  error?: string;
  result?: SongEnrichmentResult;
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
  const [enrichingSong, setEnrichingSong] = useState(false);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [artistStates, setArtistStates] = useState<Record<string, ArtistEnrichmentState>>({});
  const [songState, setSongState] = useState<SongEnrichmentState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/music/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data as Health))
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!lastImport || !secret || lastImport.artistIds.length === 0) return;
    const currentImport = lastImport;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pollArtists() {
      try {
        const entries = await Promise.all(
          currentImport.artistIds.map(async (artistId) => {
            const response = await fetch(`/api/music/enrich-artist?artistId=${encodeURIComponent(artistId)}`, {
              headers: { "x-music-admin-secret": secret },
              cache: "no-store",
            });
            if (!response.ok) return [artistId, null] as const;
            const payload = (await response.json()) as { state?: ArtistEnrichmentState };
            return [artistId, payload.state ?? null] as const;
          }),
        );

        if (cancelled) return;
        const next: Record<string, ArtistEnrichmentState> = {};
        for (const [artistId, state] of entries) if (state) next[artistId] = state;
        setArtistStates((current) => ({ ...current, ...next }));

        if (Object.values(next).some((state) => state.status === "pending" || state.status === "processing")) {
          timer = setTimeout(pollArtists, 1600);
        }
      } catch {
        if (!cancelled) timer = setTimeout(pollArtists, 2500);
      }
    }

    void pollArtists();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lastImport, secret]);

  useEffect(() => {
    if (!lastImport || !secret) return;
    const currentImport = lastImport;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pollSong() {
      try {
        const response = await fetch(`/api/music/enrich-song?songId=${encodeURIComponent(currentImport.songId)}`, {
          headers: { "x-music-admin-secret": secret },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo consultar el enriquecimiento de canción");
        const payload = (await response.json()) as { state?: SongEnrichmentState };
        if (cancelled || !payload.state) return;
        setSongState(payload.state);
        if (payload.state.status === "pending" || payload.state.status === "processing") {
          timer = setTimeout(pollSong, 1800);
        }
      } catch {
        if (!cancelled) timer = setTimeout(pollSong, 2800);
      }
    }

    timer = setTimeout(pollSong, 700);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lastImport, secret]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/music/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
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
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ spotifyId: candidate.spotifyId }),
      });
      const payload = (await response.json()) as {
        result?: ImportResult;
        enrichmentScheduled?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo importar");

      const imported = payload.result;
      const pendingArtists: Record<string, ArtistEnrichmentState> = {};
      imported.artistIds.forEach((artistId, index) => {
        pendingArtists[artistId] = {
          artistId,
          artistName: imported.track.artists[index]?.name ?? artistId,
          status: "pending",
        };
      });
      setArtistStates(pendingArtists);
      setSongState({ songId: imported.songId, songTitle: imported.track.title, status: "pending" });
      setLastImport(imported);
      setMessage(
        `${STATUS_COPY[imported.status]} · ${imported.track.title}` +
          (payload.enrichmentScheduled ? " · enriquecimiento automático iniciado" : ""),
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo importar");
    } finally {
      setImportingId(null);
    }
  }

  async function retryArtist(artistId: string) {
    setError(null);
    setEnrichingArtistId(artistId);
    try {
      const response = await fetch("/api/music/enrich-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ artistId }),
      });
      const payload = (await response.json()) as { state?: ArtistEnrichmentState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error || "No se pudo enriquecer el artista");
      setArtistStates((current) => ({ ...current, [artistId]: payload.state as ArtistEnrichmentState }));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "No se pudo enriquecer el artista");
    } finally {
      setEnrichingArtistId(null);
    }
  }

  async function retrySong() {
    if (!lastImport) return;
    setError(null);
    setEnrichingSong(true);
    setSongState((current) => current ? { ...current, status: "processing", error: undefined } : current);
    try {
      const response = await fetch("/api/music/enrich-song", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ songId: lastImport.songId }),
      });
      const payload = (await response.json()) as { state?: SongEnrichmentState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error || "No se pudo enriquecer la canción");
      setSongState(payload.state);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "No se pudo enriquecer la canción");
      const response = await fetch(`/api/music/enrich-song?songId=${encodeURIComponent(lastImport.songId)}`, {
        headers: { "x-music-admin-secret": secret },
        cache: "no-store",
      }).catch(() => null);
      if (response?.ok) {
        const payload = (await response.json()) as { state?: SongEnrichmentState };
        if (payload.state) setSongState(payload.state);
      }
    } finally {
      setEnrichingSong(false);
    }
  }

  const ready = health?.spotifyConfigured && health?.supabaseWriteConfigured && health?.adminSecretConfigured;

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno</p>
          <h1 className="game-title text-4xl mt-2">Catálogo musical</h1>
          <p className="game-muted mt-3">Busca una canción en Spotify. La identidad, sus artistas y la propia canción se enriquecen automáticamente con fuentes verificables.</p>
        </header>

        <section className="game-panel rounded-[2rem] p-5">
          <p className="font-black mb-3">Estado del pipeline</p>
          {!health ? <p className="game-muted text-sm">Comprobando configuración…</p> : (
            <div className="grid sm:grid-cols-3 gap-2 text-sm">
              <Status label="Spotify" ok={health.spotifyConfigured} />
              <Status label="Supabase escritura" ok={health.supabaseWriteConfigured} />
              <Status label="Clave admin" ok={health.adminSecretConfigured} />
            </div>
          )}
          {health && !ready && <p className="mt-3 text-sm text-amber-200">Faltan variables de entorno. La ingesta seguirá bloqueada hasta configurarlas.</p>}
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
              <p className="game-kicker">Paso 2 · automático</p>
              <h2 className="font-black text-xl mt-1">Enriquecimiento de artistas</h2>
              <p className="game-muted text-sm mt-1">MusicBrainz resuelve identidad, tipo, origen y géneros. Wikidata confirma datos cuando existe enlace estructurado.</p>
            </div>
            {lastImport.artistIds.map((artistId, index) => {
              const state = artistStates[artistId];
              const enrichment = state?.result;
              const artistName = lastImport.track.artists[index]?.name ?? state?.artistName ?? artistId;
              const working = state?.status === "pending" || state?.status === "processing";
              return (
                <div key={artistId} className="rounded-2xl border border-canvas-600/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div>
                    <p className="font-black">{artistName}</p>
                    {enrichment ? (
                      <div className="text-sm game-muted mt-1 space-y-1">
                        <p>{enrichment.artistType} · {enrichment.originCountryCode ?? "sin país"}{enrichment.originRegions.length ? ` · ${enrichment.originRegions.join(", ")}` : ""}</p>
                        <p>{enrichment.genreCodes.length ? enrichment.genreCodes.join(" · ") : "sin géneros canónicos"} · fuentes: {enrichment.sources.join(" + ") || "sin fuente externa"}</p>
                        <p className="text-emerald-200">✓ {enrichment.factsWritten} hechos verificados</p>
                      </div>
                    ) : state?.status === "failed" ? (
                      <div className="text-sm mt-1"><p className="text-rose-200">✕ Enriquecimiento automático fallido</p><p className="game-muted text-xs mt-1">{state.error}</p></div>
                    ) : <p className="text-sm game-muted mt-1">{state?.status === "processing" ? "Enriqueciendo automáticamente…" : "En cola para enriquecimiento automático…"}</p>}
                  </div>
                  <button type="button" onClick={() => retryArtist(artistId)} disabled={Boolean(enrichingArtistId) || working || !secret} className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40">
                    {enrichingArtistId === artistId ? "Enriqueciendo…" : working ? "Automático…" : state?.status === "failed" ? "Reintentar" : "Reenriquecer"}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {lastImport && (
          <section className="game-panel rounded-[2rem] p-5 space-y-3">
            <div>
              <p className="game-kicker">Paso 3 · automático</p>
              <h2 className="font-black text-xl mt-1">Enriquecimiento de canción</h2>
              <p className="game-muted text-sm mt-1">ISRC y Spotify identifican la grabación. MusicBrainz y Wikidata añaden únicamente hechos que podamos verificar.</p>
            </div>
            <div className="rounded-2xl border border-canvas-600/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="font-black">{lastImport.track.title}</p>
                {songState?.result ? (
                  <div className="text-sm game-muted mt-1 space-y-1">
                    <p>{songState.result.languageCodes.length ? `Idioma: ${songState.result.languageCodes.join(", ")}` : "Idioma aún no verificado"} · {songState.result.isCollaboration ? "colaboración" : "un artista acreditado"}</p>
                    <p>{[
                      songState.result.isCover ? "cover verificado" : null,
                      songState.result.isInstrumental ? "instrumental" : null,
                      songState.result.eurovision ? "Eurovisión" : null,
                      ...songState.result.soundtrackKinds.map((kind) => `banda sonora: ${kind}`),
                    ].filter(Boolean).join(" · ") || "Sin condiciones especiales verificadas"}</p>
                    <p>fuentes: {songState.result.sources.join(" + ") || "sin fuente externa"}</p>
                    <p className="text-emerald-200">✓ {songState.result.factsWritten} hechos verificados</p>
                    {songState.result.warnings.map((warning) => <p key={warning} className="text-amber-200">⚠ {warning}</p>)}
                  </div>
                ) : songState?.status === "failed" ? (
                  <div className="text-sm mt-1"><p className="text-rose-200">✕ Enriquecimiento de canción fallido</p><p className="game-muted text-xs mt-1">{songState.error}</p></div>
                ) : <p className="text-sm game-muted mt-1">{songState?.status === "processing" ? "Enriqueciendo canción automáticamente…" : "En cola para enriquecimiento de canción…"}</p>}
              </div>
              <button type="button" onClick={retrySong} disabled={enrichingSong || songState?.status === "processing" || songState?.status === "pending" || !secret} className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40">
                {enrichingSong ? "Enriqueciendo…" : songState?.status === "processing" || songState?.status === "pending" ? "Automático…" : songState?.status === "failed" ? "Reintentar" : "Reenriquecer"}
              </button>
            </div>
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
