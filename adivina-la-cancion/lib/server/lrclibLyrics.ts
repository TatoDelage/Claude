export type LyricsVerificationInput = {
  title: string;
  artist?: string;
  albumName?: string;
  durationSeconds?: number;
  query: string;
};

export type LyricsVerificationResult = {
  provider: "lrclib";
  status: "verified" | "rejected" | "unverifiable";
  contains: boolean | null;
  normalizedQuery: string;
  lyricsId?: number;
  language?: string;
  providerVerified: boolean;
  instrumental: boolean;
  restricted: boolean;
  confidence?: number;
  reason: string;
  sourceUrl?: string;
};

type LrclibRecord = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const BASE_URL = "https://lrclib.net/api";
const USER_AGENT = "AdivinaLaCancion/0.4 (https://claude-blue-tau.vercel.app)";

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholePhrase(haystack: string, needle: string) {
  const text = normalizeText(haystack);
  const query = normalizeText(needle);
  if (!query) return false;
  return (` ${text} `).includes(` ${query} `);
}

function syncedToPlain(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, ""))
    .join("\n")
    .trim();
}

async function resolveLyrics(input: LyricsVerificationInput): Promise<LrclibRecord | null> {
  const params = new URLSearchParams({
    track_name: input.title,
    artist_name: input.artist ?? "",
  });
  if (input.albumName) params.set("album_name", input.albumName);
  if (input.durationSeconds && Number.isFinite(input.durationSeconds)) {
    params.set("duration", String(Math.round(input.durationSeconds)));
  }

  const response = await fetch(`${BASE_URL}/get?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 404) return null;
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`LRCLIB limitó temporalmente las peticiones${retryAfter ? `; reintenta en ${retryAfter}s` : ""}`);
  }
  if (!response.ok) throw new Error(`LRCLIB respondió ${response.status}`);
  return (await response.json()) as LrclibRecord;
}

export async function verifyLyricsContains(input: LyricsVerificationInput): Promise<LyricsVerificationResult> {
  const normalizedQuery = normalizeText(input.query);
  if (normalizedQuery.length < 1 || normalizedQuery.length > 80) {
    throw new Error("La palabra o frase debe tener entre 1 y 80 caracteres");
  }

  const record = await resolveLyrics(input);
  if (!record) {
    return {
      provider: "lrclib",
      status: "unverifiable",
      contains: null,
      normalizedQuery,
      providerVerified: false,
      instrumental: false,
      restricted: false,
      reason: "LRCLIB no encontró una letra suficientemente coincidente para esta grabación",
    };
  }

  const sourceUrl = record.id ? `https://lrclib.net/api/get/${record.id}` : undefined;
  if (record.instrumental) {
    return {
      provider: "lrclib",
      status: "rejected",
      contains: false,
      normalizedQuery,
      lyricsId: record.id,
      providerVerified: true,
      instrumental: true,
      restricted: false,
      confidence: 0.98,
      reason: "LRCLIB identifica la grabación como instrumental",
      sourceUrl,
    };
  }

  const body = (record.plainLyrics ?? "").trim() || syncedToPlain(record.syncedLyrics ?? "");
  if (!body) {
    return {
      provider: "lrclib",
      status: "unverifiable",
      contains: null,
      normalizedQuery,
      lyricsId: record.id,
      providerVerified: false,
      instrumental: false,
      restricted: false,
      reason: "LRCLIB identificó la grabación pero no devolvió texto utilizable para verificarla",
      sourceUrl,
    };
  }

  const contains = containsWholePhrase(body, normalizedQuery);

  // `body` is intentionally discarded here. It is never returned or persisted.
  return {
    provider: "lrclib",
    status: contains ? "verified" : "rejected",
    contains,
    normalizedQuery,
    lyricsId: record.id,
    providerVerified: false,
    instrumental: false,
    restricted: false,
    confidence: 0.94,
    reason: contains
      ? `La letra contiene “${normalizedQuery}”`
      : `La letra disponible no contiene “${normalizedQuery}” como palabra o frase completa`,
    sourceUrl,
  };
}
