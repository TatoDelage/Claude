import { enrichSong, type SongEnrichmentResult } from "./songEnrichment";

export type SongEnrichmentStatus = "pending" | "processing" | "enriched" | "failed";

export type SongEnrichmentState = {
  songId: string;
  songTitle: string;
  status: SongEnrichmentStatus;
  attemptedAt?: string;
  error?: string;
  result?: SongEnrichmentResult;
};

type SongStatusRow = {
  id: string;
  title: string;
  language_codes: string[];
  enrichment_status: SongEnrichmentStatus;
  enrichment_attempted_at?: string | null;
  enrichment_error?: string | null;
};

type FactRow = {
  predicate: string;
  value_text?: string | null;
  value_bool?: boolean | null;
};

type ExternalIdRow = { provider: string };

function supabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!secretKey && legacyServiceRoleKey) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/$/, ""), headers };
}

async function updateSongState(songId: string, status: SongEnrichmentStatus, error?: string) {
  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
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
    throw new Error(`No se pudo actualizar el estado de canción (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function getSongEnrichmentState(songId: string): Promise<SongEnrichmentState> {
  const { url, headers } = supabaseServiceConfig();
  const [songResponse, factsResponse, idsResponse] = await Promise.all([
    fetch(`${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}&select=id,title,language_codes,enrichment_status,enrichment_attempted_at,enrichment_error&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_facts?song_id=eq.${encodeURIComponent(songId)}&status=eq.verified&select=predicate,value_text,value_bool`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_external_ids?song_id=eq.${encodeURIComponent(songId)}&select=provider`, { headers, cache: "no-store" }),
  ]);
  if (!songResponse.ok) throw new Error(`No se pudo cargar el estado de canción (${songResponse.status})`);
  if (!factsResponse.ok) throw new Error(`No se pudieron cargar hechos de canción (${factsResponse.status})`);
  if (!idsResponse.ok) throw new Error(`No se pudieron cargar fuentes de canción (${idsResponse.status})`);

  const song = ((await songResponse.json()) as SongStatusRow[])[0];
  if (!song) throw new Error("Canción no encontrada en el catálogo");
  const facts = (await factsResponse.json()) as FactRow[];
  const externalIds = (await idsResponse.json()) as ExternalIdRow[];

  let result: SongEnrichmentResult | undefined;
  if (song.enrichment_status === "enriched") {
    const collab = facts.find((fact) => fact.predicate === "song_is_collaboration")?.value_bool ?? false;
    const cover = facts.find((fact) => fact.predicate === "song_is_cover")?.value_bool ?? false;
    const eurovision = facts.find((fact) => fact.predicate === "song_eurovision")?.value_bool ?? false;
    const soundtrackKinds = facts
      .filter((fact) => fact.predicate === "song_soundtrack_kind" && fact.value_text)
      .map((fact) => fact.value_text as string);
    result = {
      songId: song.id,
      songTitle: song.title,
      languageCodes: song.language_codes ?? [],
      isCollaboration: collab,
      isCover: cover,
      isInstrumental: false,
      eurovision,
      soundtrackKinds,
      factsWritten: facts.length,
      externalIdsWritten: externalIds.length,
      sources: Array.from(new Set(externalIds.map((item) => item.provider))),
      warnings: [],
    };
  }

  return {
    songId: song.id,
    songTitle: song.title,
    status: song.enrichment_status,
    attemptedAt: song.enrichment_attempted_at ?? undefined,
    error: song.enrichment_error ?? undefined,
    result,
  };
}

export async function runSongEnrichment(songId: string): Promise<SongEnrichmentState> {
  await updateSongState(songId, "processing");
  try {
    const result = await enrichSong(songId);
    await updateSongState(songId, "enriched");
    return {
      songId,
      songTitle: result.songTitle,
      status: "enriched",
      attemptedAt: new Date().toISOString(),
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido enriqueciendo la canción";
    try {
      await updateSongState(songId, "failed", message);
    } catch (stateError) {
      console.error("No se pudo persistir el fallo de enriquecimiento de canción", stateError);
    }
    throw error;
  }
}

export async function runSongEnrichmentIfNeeded(songId: string): Promise<SongEnrichmentState> {
  const current = await getSongEnrichmentState(songId);
  if (current.status === "enriched") return current;
  if (current.status === "processing") return current;
  return runSongEnrichment(songId);
}
