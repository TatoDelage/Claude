import { resolveMusicBrainzArtist } from "./musicBrainz";
import { getWikidataArtistKnowledge } from "./wikidataKnowledge";

type ArtistRow = {
  id: string;
  name: string;
  artist_type: "solo" | "group" | "duo" | "unknown";
  origin_country_code?: string | null;
  origin_regions: string[];
  genre_codes: string[];
  tags: string[];
};

type ExternalIdRow = {
  provider: string;
  external_id: string;
  external_url?: string | null;
};

export type ArtistEnrichmentResult = {
  artistId: string;
  artistName: string;
  artistType: "solo" | "group" | "duo" | "unknown";
  originCountryCode?: string;
  originRegions: string[];
  genreCodes: string[];
  factsWritten: number;
  externalIdsWritten: number;
  sources: string[];
  warnings: string[];
};

function supabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (!secretKey && legacyServiceRoleKey) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/$/, ""), headers };
}

function mapArtistType(musicBrainzType?: string, wikidata?: { isMusicalGroup: boolean; isHuman: boolean }) {
  const normalized = musicBrainzType?.toLowerCase();
  if (normalized === "person" || wikidata?.isHuman) return "solo" as const;
  if (normalized === "group" || wikidata?.isMusicalGroup) return "group" as const;
  return "unknown" as const;
}

function mapGenres(rawGenres: string[]) {
  const result = new Set<string>();
  for (const genre of rawGenres.map((value) => value.toLowerCase())) {
    if (genre.includes("rock")) result.add("rock");
    if (genre.includes("pop")) result.add("pop");
    if (genre.includes("latin")) result.add("latin");
    if (genre.includes("indie")) result.add("indie");
    if (genre.includes("hip hop") || genre.includes("hip-hop") || genre.includes("rap")) result.add("hip-hop");
    if (genre.includes("r&b") || genre.includes("rhythm and blues")) result.add("rnb");
    if (genre.includes("electronic")) result.add("electronic");
    if (genre.includes("dance")) result.add("dance");
    if (genre.includes("disco")) result.add("disco");
    if (genre.includes("folk")) result.add("folk");
    if (genre.includes("country")) result.add("country");
    if (genre.includes("punk")) result.add("punk");
    if (genre.includes("metal")) result.add("metal");
    if (genre.includes("flamenco")) result.add("flamenco");
    if (genre.includes("salsa")) result.add("salsa");
    if (genre.includes("bachata")) result.add("bachata");
    if (genre.includes("merengue")) result.add("merengue");
    if (genre.includes("soul")) result.add("soul");
    if (genre.includes("jazz")) result.add("jazz");
    if (genre.includes("classical")) result.add("classical");
    if (genre.includes("k-pop")) result.add("k-pop");
    if (genre.includes("j-pop")) result.add("j-pop");
  }
  return Array.from(result);
}

async function getArtist(artistId: string) {
  const { url, headers } = supabaseServiceConfig();
  const artistResponse = await fetch(
    `${url}/rest/v1/music_artists?id=eq.${encodeURIComponent(artistId)}&select=id,name,artist_type,origin_country_code,origin_regions,genre_codes,tags&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!artistResponse.ok) throw new Error(`No se pudo cargar el artista (${artistResponse.status})`);
  const artists = (await artistResponse.json()) as ArtistRow[];
  const artist = artists[0];
  if (!artist) throw new Error("Artista no encontrado en el catálogo");

  const idsResponse = await fetch(
    `${url}/rest/v1/music_external_ids?artist_id=eq.${encodeURIComponent(artistId)}&select=provider,external_id,external_url`,
    { headers, cache: "no-store" },
  );
  if (!idsResponse.ok) throw new Error(`No se pudieron cargar los IDs externos (${idsResponse.status})`);
  const externalIds = (await idsResponse.json()) as ExternalIdRow[];
  return { artist, externalIds };
}

export async function enrichArtist(artistId: string): Promise<ArtistEnrichmentResult> {
  const { artist, externalIds } = await getArtist(artistId);
  const spotify = externalIds.find((item) => item.provider === "spotify");
  const knownMusicBrainz = externalIds.find((item) => item.provider === "musicbrainz");
  const knownWikidata = externalIds.find((item) => item.provider === "wikidata");
  const musicBrainz = await resolveMusicBrainzArtist(
    artist.name,
    spotify?.external_url ?? undefined,
    knownMusicBrainz?.external_id,
  );

  const warnings: string[] = [];
  const wikidataId = musicBrainz.wikidataId ?? knownWikidata?.external_id;
  let wikidata: Awaited<ReturnType<typeof getWikidataArtistKnowledge>> | undefined;
  if (wikidataId) {
    try {
      wikidata = await getWikidataArtistKnowledge(wikidataId);
    } catch (error) {
      warnings.push(error instanceof Error ? `Wikidata: ${error.message}` : "Wikidata no pudo verificarse");
    }
  } else {
    warnings.push("No existe todavía un enlace a Wikidata para este artista");
  }

  const artistType = mapArtistType(musicBrainz.type, wikidata);
  const countryCode = musicBrainz.countryCode?.toUpperCase();
  const countryConfirmedByWikidata = Boolean(countryCode && wikidata?.countryCodes.includes(countryCode));
  const typeConfirmedByWikidata =
    (artistType === "group" && wikidata?.isMusicalGroup) || (artistType === "solo" && wikidata?.isHuman);
  const originRegions = Array.from(new Set([musicBrainz.beginAreaName].filter((value): value is string => Boolean(value))));
  const genreCodes = mapGenres(musicBrainz.genres);
  const tags = Array.from(new Set([
    ...artist.tags,
    ...musicBrainz.genres.map((genre) => `mb-genre:${genre.toLowerCase().replace(/\s+/g, "-")}`),
  ]));

  const facts: Array<Record<string, unknown>> = [];
  if (artistType !== "unknown") {
    facts.push({
      predicate: "artist_type",
      value_text: artistType,
      verification_tier: "A",
      status: "verified",
      confidence: typeConfirmedByWikidata ? 1 : 0.98,
      evidence: [
        {
          provider: "musicbrainz",
          source_ref: musicBrainz.mbid,
          source_url: musicBrainz.sourceUrl,
          verdict: true,
          confidence: 0.98,
          notes: `MusicBrainz type: ${musicBrainz.type ?? "unknown"}`,
        },
        ...(typeConfirmedByWikidata && wikidata
          ? [{
              provider: "wikidata",
              source_ref: wikidata.id,
              source_url: wikidata.sourceUrl,
              verdict: true,
              confidence: 1,
              notes: artistType === "group" ? "Instance/subclass of musical group" : "Instance/subclass of human",
            }]
          : []),
      ],
    });
  }

  if (countryCode) {
    facts.push({
      predicate: "artist_origin_country",
      value_text: countryCode,
      verification_tier: "B",
      status: "verified",
      confidence: countryConfirmedByWikidata ? 1 : 0.97,
      evidence: [
        {
          provider: "musicbrainz",
          source_ref: musicBrainz.mbid,
          source_url: musicBrainz.sourceUrl,
          verdict: true,
          confidence: 0.97,
          notes: `MusicBrainz area/country: ${musicBrainz.areaName ?? countryCode}`,
        },
        ...(countryConfirmedByWikidata && wikidata
          ? [{
              provider: "wikidata",
              source_ref: wikidata.id,
              source_url: wikidata.sourceUrl,
              verdict: true,
              confidence: 1,
              notes: `Wikidata country of origin ISO code: ${countryCode}`,
            }]
          : []),
      ],
    });
  }

  for (const region of originRegions) {
    facts.push({
      predicate: "artist_origin_region",
      value_text: region,
      verification_tier: "B",
      status: "verified",
      confidence: 0.95,
      evidence: [{
        provider: "musicbrainz",
        source_ref: musicBrainz.mbid,
        source_url: musicBrainz.sourceUrl,
        verdict: true,
        confidence: 0.95,
        notes: `MusicBrainz begin area: ${region}`,
      }],
    });
  }

  const payload = {
    artist_type: artistType,
    origin_country_code: countryCode ?? "",
    origin_regions: originRegions,
    genre_codes: genreCodes,
    tags,
    external_ids: [
      {
        provider: "musicbrainz",
        external_id: musicBrainz.mbid,
        external_url: musicBrainz.sourceUrl,
      },
      ...(wikidataId
        ? [{
            provider: "wikidata",
            external_id: wikidataId,
            external_url: `https://www.wikidata.org/wiki/${wikidataId}`,
          }]
        : []),
    ],
    facts,
  };

  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/rpc/upsert_artist_enrichment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_artist_id: artistId, p_enrichment: payload }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo guardar el enriquecimiento (${response.status}): ${detail.slice(0, 300)}`);
  }
  const saved = (await response.json()) as { facts_written?: number; external_ids_written?: number };

  return {
    artistId,
    artistName: artist.name,
    artistType,
    originCountryCode: countryCode,
    originRegions,
    genreCodes,
    factsWritten: saved.facts_written ?? facts.length,
    externalIdsWritten: saved.external_ids_written ?? payload.external_ids.length,
    sources: ["musicbrainz", ...(wikidata ? ["wikidata"] : [])],
    warnings,
  };
}
