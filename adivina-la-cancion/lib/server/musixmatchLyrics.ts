type MusixmatchHeader = {
  status_code?: number;
  execute_time?: number;
};

type MusixmatchTrack = {
  track_id?: number;
  commontrack_id?: number;
  track_name?: string;
  artist_name?: string;
  track_isrc?: string;
  track_spotify_id?: string;
  has_lyrics?: number;
  instrumental?: number;
  restricted?: number;
};

type MusixmatchLyrics = {
  lyrics_id?: number;
  lyrics_body?: string;
  lyrics_language?: string;
  verified?: number;
  restricted?: number;
  instrumental?: number;
};

type MusixmatchEnvelope<T> = {
  message?: {
    header?: MusixmatchHeader;
    body?: T;
  };
};

export type LyricsVerificationInput = {
  title: string;
  artist?: string;
  isrc?: string;
  spotifyId?: string;
  query: string;
};

export type LyricsVerificationResult = {
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
};

const BASE_URL = "https://api.musixmatch.com/ws/1.1";

function apiKey() {
  const value = process.env.MUSIXMATCH_API_KEY?.trim();
  if (!value) throw new Error("MUSIXMATCH_API_KEY no está configurado");
  return value;
}

export function musixmatchIsConfigured() {
  return Boolean(process.env.MUSIXMATCH_API_KEY?.trim());
}

async function mxmFetch<T>(method: string, params: Record<string, string | undefined>): Promise<T> {
  const query = new URLSearchParams({ apikey: apiKey(), format: "json" });
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  const response = await fetch(`${BASE_URL}/${method}?${query.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Musixmatch respondió HTTP ${response.status}`);

  const payload = (await response.json()) as MusixmatchEnvelope<T>;
  const status = payload.message?.header?.status_code ?? response.status;
  if (status !== 200) {
    if (status === 401) throw new Error("Musixmatch rechazó la API key o el plan no permite esta operación");
    if (status === 402) throw new Error("El plan de Musixmatch no permite esta operación");
    if (status === 404) throw new Error("Musixmatch no encontró la canción o su letra");
    throw new Error(`Musixmatch respondió ${status}`);
  }

  const body = payload.message?.body;
  if (!body) throw new Error("Musixmatch devolvió una respuesta vacía");
  return body;
}

async function resolveTrack(input: LyricsVerificationInput): Promise<MusixmatchTrack> {
  if (input.isrc || input.spotifyId) {
    try {
      const body = await mxmFetch<{ track?: MusixmatchTrack }>("track.get", {
        track_isrc: input.isrc,
        track_spotify_id: input.spotifyId,
      });
      if (body.track?.commontrack_id || body.track?.track_id) return body.track;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("no encontró")) throw error;
    }
  }

  const body = await mxmFetch<{ track?: MusixmatchTrack }>("matcher.track.get", {
    q_track: input.title,
    q_artist: input.artist,
    track_isrc: input.isrc,
  });
  if (!body.track?.commontrack_id && !body.track?.track_id) {
    throw new Error("Musixmatch no pudo resolver la grabación");
  }
  return body.track;
}

async function getLyrics(track: MusixmatchTrack, input: LyricsVerificationInput): Promise<MusixmatchLyrics> {
  const body = await mxmFetch<{ lyrics?: MusixmatchLyrics }>("track.lyrics.get", {
    commontrack_id: track.commontrack_id ? String(track.commontrack_id) : undefined,
    track_isrc: input.isrc,
    track_spotify_id: input.spotifyId,
  });
  if (!body.lyrics) throw new Error("Musixmatch no devolvió la letra");
  return body.lyrics;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripProviderFooter(value: string) {
  return value
    .split(/\*{3,}\s*this lyrics is not for commercial use/i)[0]
    .split(/\*{3,}\s*these lyrics are not for commercial use/i)[0]
    .trim();
}

function containsWholePhrase(haystack: string, needle: string) {
  const text = normalizeText(haystack);
  const query = normalizeText(needle);
  if (!query) return false;
  return (` ${text} `).includes(` ${query} `);
}

export async function verifyLyricsContains(input: LyricsVerificationInput): Promise<LyricsVerificationResult> {
  const normalizedQuery = normalizeText(input.query);
  if (normalizedQuery.length < 1 || normalizedQuery.length > 80) {
    throw new Error("La palabra o frase debe tener entre 1 y 80 caracteres");
  }

  const track = await resolveTrack(input);
  const trackInstrumental = track.instrumental === 1;

  if (trackInstrumental) {
    return {
      status: "rejected",
      contains: false,
      normalizedQuery,
      trackId: track.track_id,
      commontrackId: track.commontrack_id,
      providerVerified: true,
      instrumental: true,
      restricted: false,
      confidence: 1,
      reason: "Musixmatch identifica la grabación como instrumental, por lo que no contiene letra",
    };
  }

  let lyrics: MusixmatchLyrics;
  try {
    lyrics = await getLyrics(track, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar la letra";
    if (message.includes("no encontró") || message.includes("plan no permite")) {
      return {
        status: "unverifiable",
        contains: null,
        normalizedQuery,
        trackId: track.track_id,
        commontrackId: track.commontrack_id,
        providerVerified: false,
        instrumental: false,
        restricted: true,
        reason: message,
      };
    }
    throw error;
  }

  const restricted = lyrics.restricted === 1;
  const instrumental = lyrics.instrumental === 1;
  const body = stripProviderFooter(lyrics.lyrics_body ?? "");

  if (instrumental) {
    return {
      status: "rejected",
      contains: false,
      normalizedQuery,
      lyricsId: lyrics.lyrics_id,
      trackId: track.track_id,
      commontrackId: track.commontrack_id,
      language: lyrics.lyrics_language,
      providerVerified: lyrics.verified === 1,
      instrumental: true,
      restricted,
      confidence: 1,
      reason: "Musixmatch identifica la letra como instrumental",
    };
  }

  if (restricted || !body) {
    return {
      status: "unverifiable",
      contains: null,
      normalizedQuery,
      lyricsId: lyrics.lyrics_id,
      trackId: track.track_id,
      commontrackId: track.commontrack_id,
      language: lyrics.lyrics_language,
      providerVerified: lyrics.verified === 1,
      instrumental: false,
      restricted: true,
      reason: "Musixmatch identifica la canción, pero la letra no está disponible para verificación con este acceso",
    };
  }

  const contains = containsWholePhrase(body, normalizedQuery);
  const providerVerified = lyrics.verified === 1;
  const confidence = providerVerified ? 0.99 : 0.96;

  // `body` is intentionally discarded here. It is never returned or persisted.
  return {
    status: contains ? "verified" : "rejected",
    contains,
    normalizedQuery,
    lyricsId: lyrics.lyrics_id,
    trackId: track.track_id,
    commontrackId: track.commontrack_id,
    language: lyrics.lyrics_language,
    providerVerified,
    instrumental: false,
    restricted: false,
    confidence,
    reason: contains
      ? `La letra contiene “${normalizedQuery}”`
      : `La letra disponible no contiene “${normalizedQuery}” como palabra o frase completa`,
  };
}
