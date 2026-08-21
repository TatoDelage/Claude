import { canonicalInstrumentFromLabel, type CanonicalInstrument } from "../instrumentTaxonomy";

const BASE_URL = "https://api.discogs.com";
const USER_AGENT = "AdivinaLaCancion/0.4 +https://claude-blue-tau.vercel.app";

type DiscogsSearchResult = {
  id?: number;
  type?: string;
  title?: string;
  year?: string;
  resource_url?: string;
  uri?: string;
};

type DiscogsCredit = {
  name?: string;
  role?: string;
  tracks?: string;
};

type DiscogsTrack = {
  position?: string;
  title?: string;
  extraartists?: DiscogsCredit[];
};

type DiscogsRelease = {
  id?: number;
  title?: string;
  artists?: Array<{ name?: string }>;
  tracklist?: DiscogsTrack[];
  extraartists?: DiscogsCredit[];
  uri?: string;
  resource_url?: string;
};

export type DiscogsInstrumentVerification = {
  status: "verified" | "unverifiable";
  instrument: CanonicalInstrument;
  releaseId?: number;
  releaseUrl?: string;
  trackPosition?: string;
  matchedRoles: string[];
  confidence?: number;
  reason: string;
};

export function discogsIsConfigured() {
  return Boolean(process.env.DISCOGS_TOKEN?.trim());
}

function token() {
  const value = process.env.DISCOGS_TOKEN?.trim();
  if (!value) throw new Error("DISCOGS_TOKEN no está configurado");
  return value;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function discogsFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Discogs token=${token()}`,
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Discogs rechazó el token");
    if (response.status === 429) throw new Error("Discogs alcanzó temporalmente el límite de peticiones");
    throw new Error(`Discogs respondió ${response.status}`);
  }
  return (await response.json()) as T;
}

function exactTrack(release: DiscogsRelease, title: string) {
  const normalizedTitle = normalize(title);
  return (release.tracklist ?? []).find((track) => normalize(track.title ?? "") === normalizedTitle);
}

function releaseArtistMatches(release: DiscogsRelease, artist: string) {
  const expected = normalize(artist);
  return (release.artists ?? []).some((item) => {
    const actual = normalize((item.name ?? "").replace(/\s*\(\d+\)$/, ""));
    return actual === expected || actual.includes(expected) || expected.includes(actual);
  });
}

function roleMatchesInstrument(role: string, instrument: CanonicalInstrument) {
  return role
    .split(/,|\//)
    .map((part) => canonicalInstrumentFromLabel(part.trim()))
    .some((value) => value === instrument);
}

function trackListIncludesPosition(tracks: string | undefined, position: string | undefined) {
  if (!tracks || !position) return false;
  const expected = normalize(position);
  return tracks
    .split(/,|&|\band\b/i)
    .map((part) => normalize(part))
    .some((part) => part === expected || part.split(/\s+/).includes(expected));
}

function matchingCredits(release: DiscogsRelease, track: DiscogsTrack, instrument: CanonicalInstrument) {
  const trackCredits = (track.extraartists ?? []).filter((credit) => roleMatchesInstrument(credit.role ?? "", instrument));
  const releaseCredits = (release.extraartists ?? []).filter((credit) =>
    roleMatchesInstrument(credit.role ?? "", instrument) && trackListIncludesPosition(credit.tracks, track.position),
  );
  return [...trackCredits, ...releaseCredits];
}

export async function verifyDiscogsInstrument(input: {
  title: string;
  artist: string;
  instrument: CanonicalInstrument;
}): Promise<DiscogsInstrumentVerification> {
  const searchParams = new URLSearchParams({
    type: "release",
    track: input.title,
    artist: input.artist,
    per_page: "8",
    page: "1",
  });
  const search = await discogsFetch<{ results?: DiscogsSearchResult[] }>(`/database/search?${searchParams.toString()}`);
  const candidates = (search.results ?? []).filter((item) => item.id && item.type === "release").slice(0, 8);

  let exactReleaseWithoutCredit = false;

  for (const candidate of candidates) {
    const release = await discogsFetch<DiscogsRelease>(`/releases/${candidate.id}`);
    const track = exactTrack(release, input.title);
    if (!track || !releaseArtistMatches(release, input.artist)) continue;
    exactReleaseWithoutCredit = true;

    const credits = matchingCredits(release, track, input.instrument);
    if (!credits.length) continue;

    const releaseId = release.id ?? candidate.id;
    const releaseUrl = releaseId ? `https://www.discogs.com/release/${releaseId}` : undefined;
    return {
      status: "verified",
      instrument: input.instrument,
      releaseId,
      releaseUrl,
      trackPosition: track.position,
      matchedRoles: Array.from(new Set(credits.map((credit) => credit.role ?? "").filter(Boolean))),
      confidence: 0.96,
      reason: `Discogs acredita ${input.instrument} específicamente para la pista en una edición coincidente`,
    };
  }

  return {
    status: "unverifiable",
    instrument: input.instrument,
    matchedRoles: [],
    reason: exactReleaseWithoutCredit
      ? `Discogs encontró una edición/pista coincidente, pero no un crédito específico de ${input.instrument}`
      : "Discogs no encontró una edición/pista suficientemente coincidente",
  };
}
