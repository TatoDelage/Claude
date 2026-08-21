import type { SpotifyTrackCandidate } from "./spotifyCatalog";
import { getSpotifyTrack } from "./spotifyCatalog";

export type SpotifyIngestStatus = "created" | "existing" | "linked";

export interface SpotifyIngestResult {
  status: SpotifyIngestStatus;
  songId: string;
  artistIds: string[];
  track: SpotifyTrackCandidate;
}

function supabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { url: url.replace(/\/$/, ""), key };
}

export function supabaseMusicWriteIsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function normalizeMusicText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function releaseYear(releaseDate?: string): number | undefined {
  if (!releaseDate) return undefined;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : undefined;
}

async function ingestNormalizedTrack(track: SpotifyTrackCandidate): Promise<SpotifyIngestResult> {
  const { url, key } = supabaseServiceConfig();
  const payload = {
    spotify_id: track.spotifyId,
    spotify_url: track.spotifyUrl ?? "",
    title: track.title,
    normalized_title: normalizeMusicText(track.title),
    release_date: track.releaseDate ?? "",
    release_year: releaseYear(track.releaseDate),
    release_precision: track.releasePrecision ?? "",
    isrc: track.isrc ?? "",
    explicit: track.explicit,
    artists: track.artists.map((artist, index) => ({
      spotify_id: artist.spotifyId,
      spotify_url: artist.spotifyUrl ?? "",
      name: artist.name,
      normalized_name: normalizeMusicText(artist.name),
      credit_order: index,
    })),
  };

  const response = await fetch(`${url}/rest/v1/rpc/ingest_spotify_track`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_track: payload }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo importar la canción (${response.status}): ${detail.slice(0, 300)}`);
  }

  const raw = (await response.json()) as {
    status?: SpotifyIngestStatus;
    song_id?: string;
    artist_ids?: string[];
  };
  if (!raw.song_id || !raw.status) throw new Error("Supabase devolvió una respuesta de ingesta incompleta");

  return {
    status: raw.status,
    songId: raw.song_id,
    artistIds: raw.artist_ids ?? [],
    track,
  };
}

export async function ingestSpotifyTrackById(spotifyId: string): Promise<SpotifyIngestResult> {
  const track = await getSpotifyTrack(spotifyId);
  return ingestNormalizedTrack(track);
}
