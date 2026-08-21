import { STARTER_CATALOG_SEEDS, starterCatalogSeedById } from "../starterCatalog";
import { getSpotifyTrack, searchSpotifyTracks, type SpotifyTrackCandidate } from "./spotifyCatalog";
import { ingestSpotifyTrackById, normalizeMusicText } from "./musicIngestion";
import { runArtistEnrichmentIfNeeded } from "./artistEnrichmentState";
import { runSongEnrichmentIfNeeded } from "./songEnrichmentState";

export type StarterImportCandidate = {
  spotifyId: string;
  title: string;
  artists: string[];
  albumName: string;
  releaseDate?: string;
};

export type StarterImportResult = {
  seedId: string;
  status: "imported" | "existing" | "needs_review";
  songId?: string;
  title: string;
  artist: string;
  resolved?: StarterImportCandidate;
  candidates?: StarterImportCandidate[];
  reason?: string;
};

export type StarterCatalogStatus = {
  totalSeeds: number;
  imported: Array<{ seedId: string; songId: string }>;
};

function supabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!secretKey && legacyServiceRoleKey) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/$/, ""), headers };
}

function candidateView(candidate: SpotifyTrackCandidate): StarterImportCandidate {
  return {
    spotifyId: candidate.spotifyId,
    title: candidate.title,
    artists: candidate.artists.map((artist) => artist.name),
    albumName: candidate.albumName,
    releaseDate: candidate.releaseDate,
  };
}

function exactArtist(candidate: SpotifyTrackCandidate, artist: string) {
  const expected = normalizeMusicText(artist);
  return candidate.artists.some((item) => normalizeMusicText(item.name) === expected);
}

function normalizedTitleWithoutEdition(value: string) {
  return normalizeMusicText(value)
    .replace(/\b(remaster(?:ed)?|remastered|radio edit|single version|album version|original mix|edit)\b.*$/i, "")
    .trim();
}

function resolveCandidate(candidates: SpotifyTrackCandidate[], title: string, artist: string) {
  const expectedTitle = normalizeMusicText(title);
  const exact = candidates.filter(
    (candidate) => normalizeMusicText(candidate.title) === expectedTitle && exactArtist(candidate, artist),
  );
  if (exact.length) return exact[0];

  const tolerant = candidates.filter(
    (candidate) => normalizedTitleWithoutEdition(candidate.title) === expectedTitle && exactArtist(candidate, artist),
  );
  if (tolerant.length) return tolerant[0];
  return undefined;
}

async function markStarterSeed(songId: string, seedId: string) {
  const { url, headers } = supabaseServiceConfig();
  const query = new URLSearchParams({
    provider: "eq.starter-catalog",
    external_id: `eq.${seedId}`,
    select: "id,song_id",
    limit: "1",
  });

  const existingResponse = await fetch(`${url}/rest/v1/music_external_ids?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!existingResponse.ok) {
    const detail = await existingResponse.text();
    throw new Error(`No se pudo comprobar la semilla del catálogo (${existingResponse.status}): ${detail.slice(0, 220)}`);
  }

  const existing = (await existingResponse.json()) as Array<{ id: string; song_id?: string | null }>;
  if (existing[0]) {
    if (existing[0].song_id && existing[0].song_id !== songId) {
      throw new Error(`La semilla ${seedId} ya está asociada a otra canción`);
    }
    return;
  }

  const response = await fetch(`${url}/rest/v1/music_external_ids`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      song_id: songId,
      artist_id: null,
      provider: "starter-catalog",
      external_id: seedId,
    }),
    cache: "no-store",
  });

  if (response.ok) return;

  const detail = await response.text();
  if (response.status === 409 && detail.includes("23505")) return;
  throw new Error(`No se pudo marcar la semilla del catálogo (${response.status}): ${detail.slice(0, 220)}`);
}

export async function importStarterSeed(seedId: string, spotifyId?: string): Promise<StarterImportResult> {
  const seed = starterCatalogSeedById(seedId);
  if (!seed) throw new Error("Semilla de catálogo desconocida");

  let track: SpotifyTrackCandidate | undefined;
  let candidates: SpotifyTrackCandidate[] = [];

  if (spotifyId) {
    track = await getSpotifyTrack(spotifyId);
  } else {
    candidates = await searchSpotifyTracks(seed.title, seed.artist);
    track = resolveCandidate(candidates, seed.title, seed.artist);
  }

  if (!track) {
    return {
      seedId,
      status: "needs_review",
      title: seed.title,
      artist: seed.artist,
      reason: candidates.length
        ? "Spotify devolvió resultados, pero ninguno coincide con suficiente confianza"
        : "Spotify no devolvió resultados",
      candidates: candidates.slice(0, 5).map(candidateView),
    };
  }

  const ingested = await ingestSpotifyTrackById(track.spotifyId);
  await markStarterSeed(ingested.songId, seedId);

  return {
    seedId,
    status: ingested.status === "created" ? "imported" : "existing",
    songId: ingested.songId,
    title: seed.title,
    artist: seed.artist,
    resolved: candidateView(ingested.track),
  };
}

export async function getStarterCatalogStatus(): Promise<StarterCatalogStatus> {
  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(
    `${url}/rest/v1/music_external_ids?provider=eq.starter-catalog&select=external_id,song_id&limit=1000`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`No se pudo leer el estado del catálogo inicial (${response.status})`);
  const rows = (await response.json()) as Array<{ external_id?: string | null; song_id?: string | null }>;
  const validSeeds = new Set(STARTER_CATALOG_SEEDS.map((seed) => seed.id));
  return {
    totalSeeds: STARTER_CATALOG_SEEDS.length,
    imported: rows
      .filter((row) => Boolean(row.external_id && row.song_id && validSeeds.has(row.external_id)))
      .map((row) => ({ seedId: row.external_id as string, songId: row.song_id as string })),
  };
}

async function linkedArtistIds(songId: string) {
  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(
    `${url}/rest/v1/music_song_artists?song_id=eq.${encodeURIComponent(songId)}&select=artist_id&order=credit_order.asc`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`No se pudieron cargar artistas de la canción (${response.status})`);
  const rows = (await response.json()) as Array<{ artist_id: string }>;
  return Array.from(new Set(rows.map((row) => row.artist_id).filter(Boolean)));
}

export async function enrichStarterSong(songId: string) {
  const artistIds = await linkedArtistIds(songId);
  const artistResults = [];
  const warnings: string[] = [];

  for (const artistId of artistIds) {
    try {
      const result = await runArtistEnrichmentIfNeeded(artistId);
      artistResults.push({ artistId, status: result.status });
    } catch (error) {
      warnings.push(`Artista ${artistId}: ${error instanceof Error ? error.message : "fallo de enriquecimiento"}`);
    }
  }

  let songStatus = "failed";
  try {
    const songResult = await runSongEnrichmentIfNeeded(songId);
    songStatus = songResult.status;
  } catch (error) {
    warnings.push(`Canción: ${error instanceof Error ? error.message : "fallo de enriquecimiento"}`);
  }

  return {
    songId,
    artistResults,
    songStatus,
    warnings,
    ok: songStatus === "enriched" && warnings.length === 0,
  };
}
