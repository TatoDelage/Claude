type MbArea = {
  id: string;
  name: string;
  country?: string;
  "iso-3166-1-codes"?: string[];
};

type MbGenre = { id: string; name: string; count?: number };

type MbRelation = {
  type?: string;
  direction?: string;
  artist?: { id: string; name: string };
  area?: MbArea;
  url?: { id?: string; resource?: string };
};

type MbArtist = {
  id: string;
  name: string;
  type?: string;
  country?: string;
  area?: MbArea;
  "begin-area"?: MbArea;
  genres?: MbGenre[];
  relations?: MbRelation[];
};

type MbSearchArtist = MbArtist & { score?: number };

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "AdivinaLaCancion/0.2 (https://claude-blue-tau.vercel.app)";
const MIN_REQUEST_GAP_MS = 1400;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
let lastMusicBrainzRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  const sinceLast = Date.now() - lastMusicBrainzRequestAt;
  if (sinceLast < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - sinceLast);
  lastMusicBrainzRequestAt = Date.now();
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 6000);
  }
  return attempt === 0 ? 1600 : 3200;
}

async function musicBrainzFetch<T>(path: string): Promise<T> {
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForRateLimit();

    let response: Response;
    try {
      response = await fetch(`${MUSICBRAINZ_BASE}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      if (attempt < 2) {
        await sleep(attempt === 0 ? 1600 : 3200);
        continue;
      }
      const detail = error instanceof Error ? error.message : "error de red";
      throw new Error(`MusicBrainz no está disponible temporalmente (${detail})`);
    }

    if (response.ok) return (await response.json()) as T;

    lastStatus = response.status;
    if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) break;
    await sleep(retryDelay(response, attempt));
  }

  if (lastStatus === 429 || lastStatus === 503) {
    throw new Error(`MusicBrainz está temporalmente saturado (${lastStatus}); vuelve a intentarlo en unos segundos`);
  }
  throw new Error(`MusicBrainz respondió ${lastStatus ?? "con error"}`);
}

function simpleNormalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeLucene(value: string) {
  return value.replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

function validMbid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

async function mbidFromSpotifyUrl(spotifyUrl: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      resource: spotifyUrl,
      inc: "artist-rels",
      fmt: "json",
    });
    const data = await musicBrainzFetch<{ relations?: MbRelation[] }>(`/url?${params.toString()}`);
    return data.relations?.find((relation) => relation.artist?.id)?.artist?.id ?? null;
  } catch {
    return null;
  }
}

async function mbidFromName(name: string): Promise<string> {
  const params = new URLSearchParams({
    query: `artist:"${escapeLucene(name)}"`,
    limit: "5",
    fmt: "json",
  });
  const data = await musicBrainzFetch<{ artists?: MbSearchArtist[] }>(`/artist?${params.toString()}`);
  const artists = data.artists ?? [];
  if (!artists.length) throw new Error(`MusicBrainz no encontró al artista ${name}`);

  const normalized = simpleNormalize(name);
  const exact = artists.find((artist) => simpleNormalize(artist.name) === normalized && (artist.score ?? 0) >= 85);
  const best = exact ?? artists[0];
  if ((best.score ?? 0) < 85) {
    throw new Error(`MusicBrainz no pudo resolver ${name} con suficiente confianza`);
  }
  return best.id;
}

export type ResolvedMusicBrainzArtist = {
  mbid: string;
  name: string;
  type?: string;
  countryCode?: string;
  areaName?: string;
  beginAreaName?: string;
  genres: string[];
  wikidataId?: string;
  sourceUrl: string;
};

export async function resolveMusicBrainzArtist(
  name: string,
  spotifyUrl?: string,
  knownMbid?: string,
): Promise<ResolvedMusicBrainzArtist> {
  const mbid = validMbid(knownMbid)
    ? (knownMbid as string)
    : (spotifyUrl ? await mbidFromSpotifyUrl(spotifyUrl) : null) ?? (await mbidFromName(name));

  const params = new URLSearchParams({
    inc: "genres+area-rels+artist-rels+url-rels",
    fmt: "json",
  });
  const artist = await musicBrainzFetch<MbArtist>(`/artist/${encodeURIComponent(mbid)}?${params.toString()}`);
  const wikidataUrl = artist.relations?.find(
    (relation) => relation.type === "wikidata" && relation.url?.resource?.includes("wikidata.org/wiki/"),
  )?.url?.resource;
  const wikidataId = wikidataUrl?.match(/\/wiki\/(Q\d+)/i)?.[1]?.toUpperCase();

  return {
    mbid,
    name: artist.name,
    type: artist.type,
    countryCode: artist.country || artist.area?.["iso-3166-1-codes"]?.[0],
    areaName: artist.area?.name,
    beginAreaName: artist["begin-area"]?.name,
    genres: (artist.genres ?? []).map((genre) => genre.name),
    wikidataId,
    sourceUrl: `https://musicbrainz.org/artist/${mbid}`,
  };
}
