import type { CanonicalInstrument } from "../instrumentTaxonomy";
import { resolveMusicBrainzSong } from "./musicBrainzSong";
import { getWikidataSongKnowledge } from "./wikidataSongKnowledge";

type SongRow = {
  id: string;
  title: string;
  isrc?: string | null;
  language_codes: string[];
  tags: string[];
};

type ExternalIdRow = {
  provider: string;
  external_id: string;
  external_url?: string | null;
};

type SongArtistRow = {
  artist_id: string;
  music_artists?: { name?: string } | null;
};

export type SongEnrichmentResult = {
  songId: string;
  songTitle: string;
  languageCodes: string[];
  isCollaboration: boolean;
  isCover: boolean;
  isInstrumental: boolean;
  instrumentCodes: CanonicalInstrument[];
  eurovision: boolean;
  soundtrackKinds: string[];
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
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!secretKey && legacyServiceRoleKey) headers.Authorization = `Bearer ${key}`;
  return { url: url.replace(/\/$/, ""), headers };
}

async function getSong(songId: string) {
  const { url, headers } = supabaseServiceConfig();
  const [songResponse, idsResponse, artistsResponse] = await Promise.all([
    fetch(`${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}&select=id,title,isrc,language_codes,tags&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_external_ids?song_id=eq.${encodeURIComponent(songId)}&select=provider,external_id,external_url`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/music_song_artists?song_id=eq.${encodeURIComponent(songId)}&select=artist_id,music_artists(name)&order=credit_order.asc`, { headers, cache: "no-store" }),
  ]);
  if (!songResponse.ok) throw new Error(`No se pudo cargar la canción (${songResponse.status})`);
  if (!idsResponse.ok) throw new Error(`No se pudieron cargar los IDs de canción (${idsResponse.status})`);
  if (!artistsResponse.ok) throw new Error(`No se pudieron cargar los artistas de canción (${artistsResponse.status})`);

  const song = ((await songResponse.json()) as SongRow[])[0];
  if (!song) throw new Error("Canción no encontrada en el catálogo");
  return {
    song,
    externalIds: (await idsResponse.json()) as ExternalIdRow[],
    artists: (await artistsResponse.json()) as SongArtistRow[],
  };
}

function mapLanguage(code: string): string | undefined {
  const normalized = code.toLowerCase();
  const mapping: Record<string, string> = {
    spa: "es", es: "es",
    eng: "en", en: "en",
    fra: "fr", fre: "fr", fr: "fr",
    ita: "it", it: "it",
    por: "pt", pt: "pt",
    kor: "ko", ko: "ko",
    jpn: "ja", ja: "ja",
  };
  if (normalized === "zxx") return undefined;
  return mapping[normalized] ?? "other";
}

export async function enrichSong(songId: string): Promise<SongEnrichmentResult> {
  const { song, externalIds, artists } = await getSong(songId);
  const spotify = externalIds.find((item) => item.provider === "spotify");
  const knownMusicBrainz = externalIds.find((item) => item.provider === "musicbrainz");
  const knownWikidata = externalIds.find((item) => item.provider === "wikidata");
  const artistNames = artists.map((item) => item.music_artists?.name).filter((value): value is string => Boolean(value));

  const musicBrainz = await resolveMusicBrainzSong({
    title: song.title,
    isrc: song.isrc ?? undefined,
    artistNames,
    knownRecordingMbid: knownMusicBrainz?.external_id,
  });

  const warnings: string[] = [];
  const wikidataId = musicBrainz.wikidataId ?? knownWikidata?.external_id;
  let wikidata: Awaited<ReturnType<typeof getWikidataSongKnowledge>> | undefined;
  if (wikidataId) {
    try {
      wikidata = await getWikidataSongKnowledge(wikidataId);
    } catch (error) {
      warnings.push(error instanceof Error ? `Wikidata: ${error.message}` : "Wikidata no pudo verificarse");
    }
  } else {
    warnings.push("No existe todavía un enlace Wikidata para esta canción/obra");
  }

  const mbLanguages = musicBrainz.workLanguages.map(mapLanguage).filter((value): value is string => Boolean(value));
  const wdLanguages = (wikidata?.languageCodes ?? []).map(mapLanguage).filter((value): value is string => Boolean(value));
  const languageCodes = Array.from(new Set([...mbLanguages, ...wdLanguages]));
  const isCollaboration = artists.length > 1;
  const instrumentCodes = Array.from(new Set(musicBrainz.instrumentCredits.map((credit) => credit.instrument)));
  const facts: Array<Record<string, unknown>> = [];

  facts.push({
    predicate: "song_is_collaboration",
    value_bool: isCollaboration,
    verification_tier: "A",
    status: "verified",
    confidence: 1,
    evidence: [{
      provider: "spotify",
      source_ref: spotify?.external_id ?? song.id,
      source_url: spotify?.external_url ?? null,
      verdict: true,
      confidence: 1,
      notes: `${artists.length} artistas acreditados en la grabación canónica`,
    }],
  });

  for (const language of languageCodes) {
    const evidence: Array<Record<string, unknown>> = [];
    if (mbLanguages.includes(language)) {
      evidence.push({
        provider: "musicbrainz",
        source_ref: musicBrainz.workMbid ?? musicBrainz.recordingMbid,
        source_url: musicBrainz.workSourceUrl ?? musicBrainz.sourceUrl,
        verdict: true,
        confidence: 0.98,
        notes: `Idioma de letra de la obra: ${language}`,
      });
    }
    if (wdLanguages.includes(language) && wikidata) {
      evidence.push({
        provider: "wikidata",
        source_ref: wikidata.id,
        source_url: wikidata.sourceUrl,
        verdict: true,
        confidence: 0.98,
        notes: `Wikidata language of work: ${language}`,
      });
    }
    facts.push({
      predicate: "song_language",
      value_text: language,
      verification_tier: "A",
      status: "verified",
      confidence: evidence.length > 1 ? 1 : 0.98,
      evidence,
    });
  }

  for (const instrument of instrumentCodes) {
    const matchingCredits = musicBrainz.instrumentCredits.filter((credit) => credit.instrument === instrument);
    facts.push({
      predicate: "song_instrument_present",
      value_text: instrument,
      verification_tier: "A",
      status: "verified",
      confidence: 0.98,
      evidence: matchingCredits.map((credit) => ({
        provider: "musicbrainz",
        source_ref: musicBrainz.recordingMbid,
        source_url: musicBrainz.sourceUrl,
        verdict: true,
        confidence: 0.98,
        notes: `${credit.performerName ?? "Un intérprete"} aparece acreditado con ${credit.rawInstrument} en esta grabación`,
      })),
    });
  }

  if (musicBrainz.isCover) {
    facts.push({
      predicate: "song_is_cover",
      value_bool: true,
      verification_tier: "A",
      status: "verified",
      confidence: 1,
      evidence: [{
        provider: "musicbrainz",
        source_ref: musicBrainz.recordingMbid,
        source_url: musicBrainz.sourceUrl,
        verdict: true,
        confidence: 1,
        notes: "La relación recording→work está marcada explícitamente como cover",
      }],
    });
  }

  if (wikidata?.eurovision) {
    facts.push({
      predicate: "song_eurovision",
      value_bool: true,
      verification_tier: "B",
      status: "verified",
      confidence: 0.98,
      evidence: [{
        provider: "wikidata",
        source_ref: wikidata.id,
        source_url: wikidata.sourceUrl,
        verdict: true,
        confidence: 0.98,
        notes: "Wikidata enlaza la obra estructuralmente con Eurovision Song Contest",
      }],
    });
  }

  if (wikidata) {
    for (const kind of wikidata.soundtrackKinds) {
      facts.push({
        predicate: "song_soundtrack_kind",
        value_text: kind,
        verification_tier: "B",
        status: "verified",
        confidence: 0.95,
        evidence: [{
          provider: "wikidata",
          source_ref: wikidata.id,
          source_url: wikidata.sourceUrl,
          verdict: true,
          confidence: 0.95,
          notes: `La obra forma parte de un lanzamiento de banda sonora asociado a ${kind}`,
        }],
      });
    }
  }

  const tags = Array.from(new Set([
    ...song.tags,
    ...(musicBrainz.isInstrumental ? ["instrumental"] : []),
    ...(musicBrainz.workMbid ? [`mb-work:${musicBrainz.workMbid}`] : []),
  ]));

  const payload = {
    language_codes: languageCodes,
    tags,
    external_ids: [
      { provider: "musicbrainz", external_id: musicBrainz.recordingMbid, external_url: musicBrainz.sourceUrl },
      ...(wikidataId ? [{ provider: "wikidata", external_id: wikidataId, external_url: `https://www.wikidata.org/wiki/${wikidataId}` }] : []),
    ],
    facts,
  };

  const { url, headers } = supabaseServiceConfig();
  const response = await fetch(`${url}/rest/v1/rpc/upsert_song_enrichment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_song_id: songId, p_enrichment: payload }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo guardar el enriquecimiento de canción (${response.status}): ${detail.slice(0, 300)}`);
  }
  const saved = (await response.json()) as { facts_written?: number; external_ids_written?: number };

  return {
    songId,
    songTitle: song.title,
    languageCodes,
    isCollaboration,
    isCover: musicBrainz.isCover,
    isInstrumental: musicBrainz.isInstrumental,
    instrumentCodes,
    eurovision: Boolean(wikidata?.eurovision),
    soundtrackKinds: wikidata?.soundtrackKinds ?? [],
    factsWritten: saved.facts_written ?? facts.length,
    externalIdsWritten: saved.external_ids_written ?? payload.external_ids.length,
    sources: ["spotify", "musicbrainz", ...(wikidata ? ["wikidata"] : [])],
    warnings,
  };
}
