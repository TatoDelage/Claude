type MbArtistCredit = {
  artist?: { id?: string; name?: string };
  name?: string;
};

type MbUrl = { id?: string; resource?: string };

type MbWork = {
  id: string;
  title: string;
  type?: string;
  language?: string;
  languages?: string[];
  relations?: Array<{ type?: string; url?: MbUrl }>;
};

type MbRelation = {
  type?: string;
  attributes?: string[];
  work?: MbWork;
  url?: MbUrl;
};

type MbRecording = {
  id: string;
  title: string;
  score?: number;
  isrcs?: string[];
  "artist-credit"?: MbArtistCredit[];
  relations?: MbRelation[];
};

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "AdivinaLaCancion/0.3 (https://claude-blue-tau.vercel.app)";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1500) await sleep(1500 - elapsed);
  lastRequestAt = Date.now();
}

async function mbFetch<T>(path: string): Promise<T> {
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForRateLimit();
    let response: Response;
    try {
      response = await fetch(`${MUSICBRAINZ_BASE}${path}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
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
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 6000) : attempt === 0 ? 1600 : 3200);
  }
  throw new Error(`MusicBrainz respondió ${lastStatus ?? "con error"}`);
}

function normalize(value: string) {
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

function artistNames(recording: MbRecording) {
  return (recording["artist-credit"] ?? [])
    .map((credit) => credit.name ?? credit.artist?.name)
    .filter((value): value is string => Boolean(value));
}

function bestRecording(recordings: MbRecording[], title: string, expectedArtists: string[]) {
  if (!recordings.length) return undefined;
  const normalizedTitle = normalize(title);
  const normalizedArtists = expectedArtists.map(normalize);
  const exact = recordings.find((recording) => {
    const titleMatches = normalize(recording.title) === normalizedTitle;
    const recordingArtists = artistNames(recording).map(normalize);
    const artistMatches = normalizedArtists.length === 0 || normalizedArtists.some((artist) => recordingArtists.includes(artist));
    return titleMatches && artistMatches;
  });
  return exact ?? recordings[0];
}

async function recordingFromIsrc(isrc: string, title: string, artists: string[]) {
  const params = new URLSearchParams({ inc: "artist-credits+work-rels+url-rels", fmt: "json" });
  const data = await mbFetch<{ recordings?: MbRecording[] }>(`/isrc/${encodeURIComponent(isrc)}?${params.toString()}`);
  return bestRecording(data.recordings ?? [], title, artists)?.id;
}

async function recordingFromSearch(title: string, artists: string[]) {
  const queryParts = [`recording:"${escapeLucene(title)}"`];
  if (artists[0]) queryParts.push(`artist:"${escapeLucene(artists[0])}"`);
  const params = new URLSearchParams({ query: queryParts.join(" AND "), limit: "5", fmt: "json" });
  const data = await mbFetch<{ recordings?: MbRecording[] }>(`/recording?${params.toString()}`);
  const candidates = data.recordings ?? [];
  const best = bestRecording(candidates, title, artists);
  if (!best || (best.score ?? 0) < 85) throw new Error(`MusicBrainz no pudo resolver ${title} con suficiente confianza`);
  return best.id;
}

async function lookupRecording(mbid: string) {
  const params = new URLSearchParams({ inc: "artist-credits+isrcs+work-rels+url-rels+genres", fmt: "json" });
  return mbFetch<MbRecording>(`/recording/${encodeURIComponent(mbid)}?${params.toString()}`);
}

async function lookupWork(workId: string) {
  const params = new URLSearchParams({ inc: "url-rels+artist-rels", fmt: "json" });
  return mbFetch<MbWork>(`/work/${encodeURIComponent(workId)}?${params.toString()}`);
}

function wikidataIdFromRelations(relations?: MbRelation[]) {
  const url = relations?.find(
    (relation) => relation.type === "wikidata" && relation.url?.resource?.includes("wikidata.org/wiki/"),
  )?.url?.resource;
  return url?.match(/\/wiki\/(Q\d+)/i)?.[1]?.toUpperCase();
}

export type ResolvedMusicBrainzSong = {
  recordingMbid: string;
  recordingTitle: string;
  workMbid?: string;
  workTitle?: string;
  workLanguages: string[];
  isCover: boolean;
  isInstrumental: boolean;
  wikidataId?: string;
  sourceUrl: string;
  workSourceUrl?: string;
};

export async function resolveMusicBrainzSong(input: {
  title: string;
  isrc?: string;
  artistNames: string[];
  knownRecordingMbid?: string;
}): Promise<ResolvedMusicBrainzSong> {
  // Leave a small buffer because artist enrichment uses the same public service.
  await sleep(1500);

  const recordingMbid = validMbid(input.knownRecordingMbid)
    ? (input.knownRecordingMbid as string)
    : (input.isrc ? await recordingFromIsrc(input.isrc, input.title, input.artistNames) : undefined)
      ?? (await recordingFromSearch(input.title, input.artistNames));

  const recording = await lookupRecording(recordingMbid);
  const performanceRelations = (recording.relations ?? []).filter(
    (relation) => relation.type === "performance" && relation.work?.id,
  );
  const primaryPerformance = performanceRelations[0];
  const attributes = new Set((primaryPerformance?.attributes ?? []).map((value) => value.toLowerCase()));

  let work: MbWork | undefined;
  if (primaryPerformance?.work?.id) {
    work = await lookupWork(primaryPerformance.work.id);
  }

  const languages = Array.from(new Set([
    ...(work?.languages ?? []),
    ...(work?.language ? [work.language] : []),
  ].filter(Boolean)));

  return {
    recordingMbid,
    recordingTitle: recording.title,
    workMbid: work?.id ?? primaryPerformance?.work?.id,
    workTitle: work?.title ?? primaryPerformance?.work?.title,
    workLanguages: languages,
    isCover: attributes.has("cover"),
    isInstrumental: attributes.has("instrumental"),
    wikidataId: wikidataIdFromRelations(work?.relations) ?? wikidataIdFromRelations(recording.relations),
    sourceUrl: `https://musicbrainz.org/recording/${recordingMbid}`,
    workSourceUrl: work?.id ? `https://musicbrainz.org/work/${work.id}` : undefined,
  };
}
