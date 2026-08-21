type SpotifyImage = { url: string; height: number | null; width: number | null };

type SpotifyArtist = {
  id: string;
  name: string;
  external_urls?: { spotify?: string };
};

type SpotifyTrack = {
  id: string;
  name: string;
  explicit?: boolean;
  duration_ms?: number;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    release_date?: string;
    release_date_precision?: "year" | "month" | "day";
    images?: SpotifyImage[];
  };
};

type SpotifySearchResponse = {
  tracks?: { items?: SpotifyTrack[] };
};

export interface SpotifyTrackCandidate {
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
  imageUrl?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function spotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
  return { clientId, clientSecret, market: process.env.SPOTIFY_MARKET || "ES" };
}

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const { clientId, clientSecret } = spotifyConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Spotify OAuth falló (${response.status}): ${detail.slice(0, 180)}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in) * 1000,
  };
  return cachedToken.value;
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getSpotifyToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Spotify API falló (${response.status}): ${detail.slice(0, 220)}`);
  }
  return (await response.json()) as T;
}

function toCandidate(track: SpotifyTrack): SpotifyTrackCandidate {
  return {
    spotifyId: track.id,
    title: track.name,
    artists: track.artists.map((artist) => ({
      spotifyId: artist.id,
      name: artist.name,
      spotifyUrl: artist.external_urls?.spotify,
    })),
    albumName: track.album.name,
    releaseDate: track.album.release_date,
    releasePrecision: track.album.release_date_precision,
    isrc: track.external_ids?.isrc,
    explicit: track.explicit,
    durationMs: track.duration_ms,
    spotifyUrl: track.external_urls?.spotify,
    imageUrl: track.album.images?.[0]?.url,
  };
}

export async function searchSpotifyTracks(title: string, artist?: string): Promise<SpotifyTrackCandidate[]> {
  const cleanTitle = title.trim();
  if (cleanTitle.length < 2) return [];
  const { market } = spotifyConfig();
  const q = artist?.trim() ? `track:${cleanTitle} artist:${artist.trim()}` : `track:${cleanTitle}`;
  const params = new URLSearchParams({ q, type: "track", market, limit: "5" });
  const payload = await spotifyFetch<SpotifySearchResponse>(`/search?${params.toString()}`);
  return (payload.tracks?.items ?? []).map(toCandidate);
}

export async function getSpotifyTrack(spotifyId: string): Promise<SpotifyTrackCandidate> {
  const cleanId = spotifyId.trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(cleanId)) throw new Error("Spotify track ID no válido");
  const { market } = spotifyConfig();
  const track = await spotifyFetch<SpotifyTrack>(`/tracks/${encodeURIComponent(cleanId)}?market=${encodeURIComponent(market)}`);
  return toCandidate(track);
}

export function spotifyIsConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}
