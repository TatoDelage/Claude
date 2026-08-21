import type { CanonicalInstrument } from "../instrumentTaxonomy";
import { discogsIsConfigured, verifyDiscogsInstrument } from "./discogsInstrumentation";

type SongRow = { id: string; title: string };
type SongArtistRow = { music_artists?: { name?: string } | null };
type FactRow = { value_text?: string | null };

export type InstrumentFactVerificationResult = {
  songId: string;
  songTitle: string;
  artistName?: string;
  instrument: CanonicalInstrument;
  status: "verified" | "unverifiable";
  provider?: "musicbrainz" | "discogs";
  confidence?: number;
  sourceUrl?: string;
  reason: string;
  factPersisted: boolean;
};

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

async function loadSong(songId: string) {
  const { url, headers } = supabaseServiceConfig();
  const [songResponse, artistsResponse, factResponse] = await Promise.all([
    fetch(`${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}&select=id,title&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_song_artists?song_id=eq.${encodeURIComponent(songId)}&select=music_artists(name)&order=credit_order.asc`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_facts?song_id=eq.${encodeURIComponent(songId)}&predicate=eq.song_instrument_present&status=eq.verified&select=value_text`, { headers, cache: "no-store" }),
  ]);
  if (!songResponse.ok) throw new Error(`No se pudo cargar la canción (${songResponse.status})`);
  if (!artistsResponse.ok) throw new Error(`No se pudieron cargar artistas (${artistsResponse.status})`);
  if (!factResponse.ok) throw new Error(`No se pudieron cargar instrumentos existentes (${factResponse.status})`);

  const song = ((await songResponse.json()) as SongRow[])[0];
  if (!song) throw new Error("Canción no encontrada");
  const artistName = ((await artistsResponse.json()) as SongArtistRow[])
    .map((item) => item.music_artists?.name)
    .find((value): value is string => Boolean(value));
  const facts = (await factResponse.json()) as FactRow[];
  return { song, artistName, existing: facts.map((fact) => fact.value_text).filter(Boolean) as string[] };
}

async function persistDiscogsFact(songId: string, instrument: CanonicalInstrument, verification: Awaited<ReturnType<typeof verifyDiscogsInstrument>>) {
  if (verification.status !== "verified") return false;
  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/rpc/upsert_song_enrichment`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_song_id: songId,
      p_enrichment: {
        language_codes: [],
        tags: [],
        external_ids: [],
        facts: [{
          predicate: "song_instrument_present",
          value_text: instrument,
          verification_tier: "B",
          status: "verified",
          confidence: verification.confidence ?? 0.96,
          evidence: [{
            provider: "discogs",
            source_ref: verification.releaseId
              ? `release:${verification.releaseId}${verification.trackPosition ? `:track:${verification.trackPosition}` : ""}`
              : null,
            source_url: verification.releaseUrl ?? null,
            verdict: true,
            confidence: verification.confidence ?? 0.96,
            notes: `Crédito de pista en Discogs. Roles: ${verification.matchedRoles.join(", ")}`,
          }],
        }],
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo guardar el instrumento Discogs (${response.status}): ${detail.slice(0, 240)}`);
  }
  return true;
}

export async function verifyInstrumentFact(songId: string, instrument: CanonicalInstrument): Promise<InstrumentFactVerificationResult> {
  const { song, artistName, existing } = await loadSong(songId);
  if (existing.includes(instrument)) {
    return {
      songId,
      songTitle: song.title,
      artistName,
      instrument,
      status: "verified",
      provider: "musicbrainz",
      confidence: 0.98,
      reason: "El catálogo ya contiene un crédito de instrumento verificado",
      factPersisted: false,
    };
  }

  if (!artistName) {
    return {
      songId,
      songTitle: song.title,
      instrument,
      status: "unverifiable",
      reason: "No hay artista principal suficiente para consultar Discogs",
      factPersisted: false,
    };
  }

  if (!discogsIsConfigured()) {
    return {
      songId,
      songTitle: song.title,
      artistName,
      instrument,
      status: "unverifiable",
      reason: "MusicBrainz no lo acreditó y Discogs todavía no está configurado",
      factPersisted: false,
    };
  }

  const verification = await verifyDiscogsInstrument({
    title: song.title,
    artist: artistName,
    instrument,
  });
  const factPersisted = await persistDiscogsFact(songId, instrument, verification);

  return {
    songId,
    songTitle: song.title,
    artistName,
    instrument,
    status: verification.status,
    provider: verification.status === "verified" ? "discogs" : undefined,
    confidence: verification.confidence,
    sourceUrl: verification.releaseUrl,
    reason: verification.reason,
    factPersisted,
  };
}
