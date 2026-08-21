import { enrichArtist, type ArtistEnrichmentResult } from "./artistEnrichment";

export type ArtistEnrichmentStatus = "pending" | "processing" | "enriched" | "failed";

export type ArtistEnrichmentState = {
  artistId: string;
  artistName: string;
  status: ArtistEnrichmentStatus;
  attemptedAt?: string;
  error?: string;
  result?: ArtistEnrichmentResult;
};

type ArtistStatusRow = {
  id: string;
  name: string;
  artist_type: "solo" | "group" | "duo" | "unknown";
  origin_country_code?: string | null;
  origin_regions: string[];
  genre_codes: string[];
  enrichment_status: ArtistEnrichmentStatus;
  enrichment_attempted_at?: string | null;
  enrichment_error?: string | null;
};

type ExternalIdRow = {
  provider: string;
};

type FactRow = {
  id: string;
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

async function updateArtistState(
  artistId: string,
  status: ArtistEnrichmentStatus,
  error?: string,
): Promise<void> {
  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/music_artists?id=eq.${encodeURIComponent(artistId)}`, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      enrichment_status: status,
      enrichment_attempted_at: new Date().toISOString(),
      enrichment_error: error ?? null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo actualizar el estado de enriquecimiento (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function getArtistEnrichmentState(artistId: string): Promise<ArtistEnrichmentState> {
  const { url, headers } = supabaseServiceConfig();

  const [artistResponse, idsResponse, factsResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/music_artists?id=eq.${encodeURIComponent(artistId)}&select=id,name,artist_type,origin_country_code,origin_regions,genre_codes,enrichment_status,enrichment_attempted_at,enrichment_error&limit=1`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/music_external_ids?artist_id=eq.${encodeURIComponent(artistId)}&provider=in.(musicbrainz,wikidata)&select=provider`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/music_facts?artist_id=eq.${encodeURIComponent(artistId)}&status=eq.verified&select=id`,
      { headers, cache: "no-store" },
    ),
  ]);

  if (!artistResponse.ok) throw new Error(`No se pudo cargar el estado del artista (${artistResponse.status})`);
  if (!idsResponse.ok) throw new Error(`No se pudieron cargar las fuentes del artista (${idsResponse.status})`);
  if (!factsResponse.ok) throw new Error(`No se pudieron cargar los hechos del artista (${factsResponse.status})`);

  const artist = ((await artistResponse.json()) as ArtistStatusRow[])[0];
  if (!artist) throw new Error("Artista no encontrado en el catálogo");
  const externalIds = (await idsResponse.json()) as ExternalIdRow[];
  const facts = (await factsResponse.json()) as FactRow[];
  const sources = Array.from(new Set(externalIds.map((item) => item.provider)));

  const result: ArtistEnrichmentResult | undefined = artist.enrichment_status === "enriched"
    ? {
        artistId: artist.id,
        artistName: artist.name,
        artistType: artist.artist_type,
        originCountryCode: artist.origin_country_code ?? undefined,
        originRegions: artist.origin_regions ?? [],
        genreCodes: artist.genre_codes ?? [],
        factsWritten: facts.length,
        externalIdsWritten: externalIds.length,
        sources,
        warnings: [],
      }
    : undefined;

  return {
    artistId: artist.id,
    artistName: artist.name,
    status: artist.enrichment_status,
    attemptedAt: artist.enrichment_attempted_at ?? undefined,
    error: artist.enrichment_error ?? undefined,
    result,
  };
}

export async function runArtistEnrichment(artistId: string): Promise<ArtistEnrichmentState> {
  await updateArtistState(artistId, "processing");
  try {
    const result = await enrichArtist(artistId);
    await updateArtistState(artistId, "enriched");
    return {
      artistId,
      artistName: result.artistName,
      status: "enriched",
      attemptedAt: new Date().toISOString(),
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido enriqueciendo el artista";
    try {
      await updateArtistState(artistId, "failed", message);
    } catch (stateError) {
      console.error("No se pudo persistir el fallo de enriquecimiento", stateError);
    }
    throw error;
  }
}

export async function runArtistEnrichmentIfNeeded(artistId: string): Promise<ArtistEnrichmentState> {
  const current = await getArtistEnrichmentState(artistId);
  if (current.status === "enriched" || current.status === "processing") return current;
  return runArtistEnrichment(artistId);
}
