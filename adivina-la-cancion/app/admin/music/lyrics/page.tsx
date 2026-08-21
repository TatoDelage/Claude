"use client";

import { FormEvent, useEffect, useState } from "react";

type Health = {
  spotifyConfigured: boolean;
  supabaseWriteConfigured: boolean;
  adminSecretConfigured: boolean;
  musixmatchConfigured?: boolean;
};

type Candidate = {
  spotifyId: string;
  title: string;
  artists: Array<{ spotifyId: string; name: string; spotifyUrl?: string }>;
  albumName: string;
  releaseDate?: string;
  isrc?: string;
  spotifyUrl?: string;
};

type ImportResult = {
  status: "created" | "existing" | "linked";
  songId: string;
  artistIds: string[];
  track: Candidate;
};

type LyricsResult = {
  status: "verified" | "rejected" | "unverifiable";
  contains: boolean | null;
  normalizedQuery: string;
  lyricsId?: number;
  trackId?: number;
  commontrackId?: number;
  language?: string;
  providerVerified: boolean;
  instrumental: boolean;
  restricted: boolean;
  confidence?: number;
  reason: string;
  songId: string;
  songTitle: string;
  artistName?: string;
  factPersisted: boolean;
  rawLyricsStored: false;
};

export default function LyricsLabPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [secret, setSecret] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<ImportResult | null>(null);
  const [lyricsResult, setLyricsResult] = useState<LyricsResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/music/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setHealth(data as Health))
      .catch(() => setHealth(null));
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    setSelected(null);
    setLyricsResult(null);
    try {
      const response = await fetch("/api/music/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ title, artist: artist || undefined }),
      });
      const payload = (await response.json()) as { results?: Candidate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo buscar en Spotify");
      setResults(payload.results ?? []);
    } catch (searchError) {
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar");
    } finally {
      setSearching(false);
    }
  }

  async function choose(candidate: Candidate) {
    setImportingId(candidate.spotifyId);
    setError(null);
    setLyricsResult(null);
    try {
      const response = await fetch("/api/music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ spotifyId: candidate.spotifyId }),
      });
      const payload = (await response.json()) as { result?: ImportResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo importar la canción");
      setSelected(payload.result);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo importar");
    } finally {
      setImportingId(null);
    }
  }

  async function verify() {
    if (!selected) return;
    setVerifying(true);
    setError(null);
    setLyricsResult(null);
    try {
      const response = await fetch("/api/music/verify-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-music-admin-secret": secret },
        body: JSON.stringify({ songId: selected.songId, query }),
      });
      const payload = (await response.json()) as { result?: LyricsResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "No se pudo verificar la letra");
      setLyricsResult(payload.result);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "No se pudo verificar la letra");
    } finally {
      setVerifying(false);
    }
  }

  const musixmatchReady = Boolean(health?.musixmatchConfigured);

  return (
    <main className="game-stage min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <p className="game-kicker">Laboratorio interno · Letras</p>
          <h1 className="game-title text-4xl mt-2">Verificador de letras</h1>
          <p className="game-muted mt-3">Comprueba una palabra o frase contra Musixmatch. La letra se procesa solo en memoria y nunca se guarda en el catálogo.</p>
          <a href="/admin/music" className="inline-block mt-3 text-sm underline game-muted">← Volver al catálogo</a>
        </header>

        <section className="game-panel rounded-[2rem] p-5">
          <p className="font-black mb-3">Estado</p>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <Status label="Spotify" ok={Boolean(health?.spotifyConfigured)} />
            <Status label="Musixmatch" ok={musixmatchReady} />
            <Status label="Supabase escritura" ok={Boolean(health?.supabaseWriteConfigured)} />
            <Status label="Clave admin" ok={Boolean(health?.adminSecretConfigured)} />
          </div>
          {health && !musixmatchReady && (
            <p className="mt-3 text-sm text-amber-200">Falta MUSIXMATCH_API_KEY en Vercel. Puedes preparar la canción, pero la verificación de letra seguirá bloqueada.</p>
          )}
        </section>

        <form onSubmit={search} className="game-panel rounded-[2rem] p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider game-muted">Clave admin</span>
            <input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Canción</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="Ej. I Will Always Love You" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Artista</span>
              <input value={artist} onChange={(event) => setArtist(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="Ej. Whitney Houston" />
            </label>
          </div>
          <button disabled={searching || !secret || title.trim().length < 2} className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40">
            {searching ? "Buscando…" : "Buscar en Spotify"}
          </button>
        </form>

        {error && <div className="rounded-2xl border border-rose-700/40 bg-rose-950/25 p-4 text-rose-200 text-sm">{error}</div>}

        {results.length > 0 && (
          <section className="space-y-3">
            {results.map((candidate) => (
              <article key={candidate.spotifyId} className="game-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="min-w-0">
                  <h2 className="font-black text-lg truncate">{candidate.title}</h2>
                  <p className="text-sm text-gold-300 font-bold">{candidate.artists.map((item) => item.name).join(", ")}</p>
                  <p className="text-xs game-muted mt-1">{candidate.albumName}{candidate.releaseDate ? ` · ${candidate.releaseDate}` : ""}{candidate.isrc ? ` · ISRC ${candidate.isrc}` : ""}</p>
                </div>
                <button type="button" onClick={() => choose(candidate)} disabled={Boolean(importingId)} className="game-primary rounded-xl px-5 py-3 font-black shrink-0 disabled:opacity-40">
                  {importingId === candidate.spotifyId ? "Preparando…" : "Usar esta versión"}
                </button>
              </article>
            ))}
          </section>
        )}

        {selected && (
          <section className="game-panel rounded-[2rem] p-5 space-y-4">
            <div>
              <p className="game-kicker">Verificación</p>
              <h2 className="font-black text-xl mt-1">{selected.track.title} · {selected.track.artists.map((item) => item.name).join(", ")}</h2>
              <p className="game-muted text-sm mt-1">La grabación ya está identificada por Spotify/ISRC.</p>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider game-muted">Palabra o frase exacta</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 w-full rounded-xl bg-black/20 border border-canvas-600 px-4 py-3" placeholder="Ej. love" />
            </label>
            <button type="button" onClick={verify} disabled={verifying || !musixmatchReady || query.trim().length < 1} className="game-primary w-full rounded-xl py-3 font-black disabled:opacity-40">
              {verifying ? "Verificando…" : "Verificar en la letra"}
            </button>
          </section>
        )}

        {lyricsResult && (
          <section className={`rounded-[2rem] border p-5 ${lyricsResult.status === "verified" ? "border-emerald-700/40 bg-emerald-950/20" : lyricsResult.status === "rejected" ? "border-rose-700/40 bg-rose-950/20" : "border-amber-700/40 bg-amber-950/20"}`}>
            <p className="game-kicker">Resultado</p>
            <h2 className="font-black text-2xl mt-1">
              {lyricsResult.status === "verified" ? "✓ VÁLIDA" : lyricsResult.status === "rejected" ? "✕ NO VÁLIDA" : "⚠ NO VERIFICABLE"}
            </h2>
            <div className="text-sm game-muted mt-3 space-y-1">
              <p>{lyricsResult.reason}</p>
              <p>Consulta normalizada: <strong>{lyricsResult.normalizedQuery}</strong></p>
              {lyricsResult.language && <p>Idioma Musixmatch: {lyricsResult.language}</p>}
              {lyricsResult.confidence !== undefined && <p>Confianza: {Math.round(lyricsResult.confidence * 100)}%</p>}
              <p>Hecho persistido: {lyricsResult.factPersisted ? "sí" : "no"}</p>
              <p className="text-emerald-200">✓ Letra original almacenada: no</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border px-3 py-2 ${ok ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-200" : "border-rose-700/40 bg-rose-950/20 text-rose-200"}`}>{ok ? "✓" : "✕"} {label}</div>;
}
