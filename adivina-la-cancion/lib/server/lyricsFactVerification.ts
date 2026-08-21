import { verifyLyricsContains, type LyricsVerificationResult } from "./musixmatchLyrics";

type SongRow = {
  id: string;
  title: string;
  isrc?: string | null;
};

type ExternalIdRow = {
  provider: string;
  external_id: string;
};

type SongArtistRow = {
  music_artists?: { name?: string } | null;
};

export type LyricsFactVerificationResult = LyricsVerificationResult & {
  songId: string;
  songTitle: string;
  artistName?: string;
  factPersisted: boolean;
  rawLyricsStored: false;
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
  const [songResponse, idsResponse, artistsResponse] = await Promise.all([
    fetch(`${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}&select=id,title,isrc&limit=1`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${url}/rest/v1/music_external_ids?song_id=eq.${encodeURIComponent(songId)}&select=provider,external_id`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${url}/rest/v1/music_song_artists?song_id=eq.${encodeURIComponent(songId)}&select=music_artists(name)&order=credit_order.asc`, {
      headers,
      cache: "no-store",
    }),
  ]);

  if (!songResponse.ok) throw new Error(`No se pudo cargar la canción (${songResponse.status})`);
  if (!idsResponse.ok) throw new Error(`No se pudieron cargar IDs externos (${idsResponse.status})`);
  if (!artistsResponse.ok) throw new Error(`No se pudieron cargar artistas (${artistsResponse.status})`);

  const song = ((await songResponse.json()) as SongRow[])[0];
  if (!song) throw new Error("Canción no encontrada en el catálogo");

  const externalIds = (await idsResponse.json()) as ExternalIdRow[];
  const artists = (await artistsResponse.json()) as SongArtistRow[];
  const artistName = artists.map((item) => item.music_artists?.name).find(Boolean);

  return { song, externalIds, artistName };
}

async function persistVerification(songId: string, verification: LyricsVerificationResult) {
  const externalIds = verification.commontrackId
    ? [{
        provider: "musixmatch",
        external_id: String(verification.commontrackId),
        external_url: null,
      }]
    : [];

  const facts = verification.status === "unverifiable"
    ? []
    : [{
        predicate: "song_lyrics_contains",
        value_text: verification.normalizedQuery,
        verification_tier: "B",
        status: verification.status,
        confidence: verification.confidence ?? 0.96,
        evidence: [{
          provider: "musixmatch",
          source_ref: verification.lyricsId
            ? `lyrics:${verification.lyricsId}`
            : verification.commontrackId
              ? `commontrack:${verification.commontrackId}`
              : null,
          source_url: null,
          verdict: verification.contains === true,
          confidence: verification.confidence ?? 0.96,
          notes: "Verificado de forma transitoria contra el proveedor licenciado; la letra original no se almacena.",
        }],
      }];

  if (externalIds.length === 0 && facts.length === 0) return false;

  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/rpc/upsert_song_enrichment`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_song_id: songId,
      p_enrichment: {
        language_codes: [],
        tags: [],
        external_ids: externalIds,
        facts,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo guardar la verificación de letra (${response.status}): ${detail.slice(0, 240)}`);
  }
  return facts.length > 0;
}

export async function verifyLyricsFact(songId: string, query: string): Promise<LyricsFactVerificationResult> {
  const { song, externalIds, artistName } = await loadSong(songId);
  const spotifyId = externalIds.find((item) => item.provider === "spotify")?.external_id;

  const verification = await verifyLyricsContains({
    title: song.title,
    artist: artistName,
    isrc: song.isrc ?? undefined,
    spotifyId,
    query,
  });

  const factPersisted = await persistVerification(songId, verification);

  return {
    ...verification,
    songId,
    songTitle: song.title,
    artistName,
    factPersisted,
    rawLyricsStored: false,
  };
}
