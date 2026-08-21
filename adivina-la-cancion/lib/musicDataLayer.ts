export type MusicProvider =
  | "spotify"
  | "musicbrainz"
  | "wikidata"
  | "discogs"
  | "musixmatch"
  | "lrclib"
  | "instrumentation-index"
  | "manual";

export type MusicEntityType = "song" | "artist";

export type MusicFactPredicate =
  | "artist_origin_country"
  | "artist_origin_region"
  | "artist_type"
  | "artist_has_sibling_member"
  | "artist_former_group_member"
  | "song_language"
  | "song_lyrics_contains"
  | "song_instrument_present"
  | "song_soundtrack_kind"
  | "song_eurovision"
  | "song_is_collaboration"
  | "song_is_cover";

export interface ProviderResponsibility {
  provider: MusicProvider;
  role: "identity" | "metadata" | "knowledge" | "lyrics" | "instrumentation" | "manual-review";
  storesRawPayload: false;
  notes: string;
}

/**
 * Product rule: providers help us resolve or verify facts, but Supabase stores our
 * canonical catalogue plus compact assertions/evidence, never raw lyrics or provider payload dumps.
 */
export const PROVIDER_RESPONSIBILITIES: ProviderResponsibility[] = [
  {
    provider: "spotify",
    role: "identity",
    storesRawPayload: false,
    notes: "Resolve track/artist identity and durable external IDs such as Spotify IDs and ISRC when available.",
  },
  {
    provider: "musicbrainz",
    role: "metadata",
    storesRawPayload: false,
    notes: "Enrich artist areas, relationships, releases and recording-level instrument credits.",
  },
  {
    provider: "wikidata",
    role: "knowledge",
    storesRawPayload: false,
    notes: "Verify structured biographical/geographic facts and relationships not covered reliably by the music catalogue.",
  },
  {
    provider: "discogs",
    role: "instrumentation",
    storesRawPayload: false,
    notes: "Fallback for explicit track-level instrument credits when MusicBrainz has insufficient coverage; preserve only compact fact/evidence references.",
  },
  {
    provider: "lrclib",
    role: "lyrics",
    storesRawPayload: false,
    notes: "Development lyrics verifier with openly accessible API; store only query-specific facts/evidence, never raw lyrics.",
  },
  {
    provider: "musixmatch",
    role: "lyrics",
    storesRawPayload: false,
    notes: "Optional licensed production lyrics provider; store only the resulting fact/evidence reference.",
  },
  {
    provider: "instrumentation-index",
    role: "instrumentation",
    storesRawPayload: false,
    notes: "Internal curated index that accumulates verified audible-instrument facts from trusted sources.",
  },
  {
    provider: "manual",
    role: "manual-review",
    storesRawPayload: false,
    notes: "Resolve exceptional disputed or low-confidence facts before they become eligible for automatic play.",
  },
];

export interface CanonicalSongRecord {
  id: string;
  title: string;
  normalizedTitle: string;
  releaseYear?: number;
  isrc?: string;
  languageCodes: string[];
  regionCodes: string[];
  genreCodes: string[];
  tags: string[];
  baselineDifficulty?: "easy" | "medium" | "hard" | "expert";
  catalogStatus: "draft" | "active" | "review" | "blocked";
}

export interface CanonicalArtistRecord {
  id: string;
  name: string;
  normalizedName: string;
  artistType: "solo" | "group" | "duo" | "unknown";
  originCountryCode?: string;
  originRegions: string[];
  genreCodes: string[];
  tags: string[];
  catalogStatus: "draft" | "active" | "review" | "blocked";
}

export interface VerifiableMusicFact {
  entityType: MusicEntityType;
  entityId: string;
  predicate: MusicFactPredicate | string;
  verificationTier: "A" | "B" | "C";
  status: "pending" | "verified" | "rejected";
  confidence?: number;
  providerEvidence: Array<{
    provider: MusicProvider;
    sourceRef?: string;
    sourceUrl?: string;
    verdict: boolean;
    confidence?: number;
  }>;
}

export const AUTO_JUDGE_MIN_CONFIDENCE = 0.9;

export function factCanAutoJudge(fact: VerifiableMusicFact): boolean {
  if (fact.verificationTier === "C" || fact.status !== "verified") return false;
  if (fact.confidence !== undefined && fact.confidence < AUTO_JUDGE_MIN_CONFIDENCE) return false;
  return fact.providerEvidence.some((evidence) => evidence.verdict);
}
