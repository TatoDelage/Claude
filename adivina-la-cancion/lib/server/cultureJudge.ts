import type { CultureChallenge, CultureCondition } from "../cultureChallenges";
import { canonicalInstrumentFromLabel } from "../instrumentTaxonomy";
import { normalizeMusicText, ingestSpotifyTrackById } from "./musicIngestion";
import { searchSpotifyTracks, getSpotifyTrack, type SpotifyTrackCandidate } from "./spotifyCatalog";
import { runArtistEnrichmentIfNeeded } from "./artistEnrichmentState";
import { runSongEnrichmentIfNeeded } from "./songEnrichmentState";
import { verifyLyricsFact } from "./lyricsFactVerification";
import { verifyInstrumentFact } from "./instrumentFactVerification";

export type CultureJudgeStatus = "valid" | "invalid" | "unverifiable" | "ambiguous" | "not_found";
export type CultureConditionStatus = "valid" | "invalid" | "unverifiable";

export type CultureJudgeCandidate = {
  spotifyId: string;
  title: string;
  artists: string[];
  albumName: string;
  releaseDate?: string;
};

export type CultureConditionDecision = {
  conditionType: CultureCondition["type"];
  status: CultureConditionStatus;
  reason: string;
  source?: string;
};

export type CultureJudgeResult = {
  status: CultureJudgeStatus;
  challengeId: string;
  prompt: string;
  candidate?: CultureJudgeCandidate;
  candidates?: CultureJudgeCandidate[];
  songId?: string;
  decisions: CultureConditionDecision[];
  warnings: string[];
};

type SongRow = {
  id: string;
  title: string;
  release_year?: number | null;
  language_codes: string[];
};

type ArtistRow = {
  id: string;
  name: string;
  artist_type: "solo" | "group" | "duo" | "unknown";
  origin_country_code?: string | null;
  origin_regions: string[];
};

type FactRow = {
  predicate: string;
  value_text?: string | null;
  value_bool?: boolean | null;
  status: "pending" | "verified" | "rejected";
  confidence?: number | null;
};

type JudgeContext = {
  song: SongRow;
  primaryArtist?: ArtistRow;
  songFacts: FactRow[];
  artistFacts: FactRow[];
};

const COUNTRY_CODES: Record<string, string> = {
  spain: "ES", espana: "ES",
  usa: "US", us: "US", "united states": "US", "estados unidos": "US",
  uk: "GB", "united kingdom": "GB", reino_unido: "GB",
  mexico: "MX", argentina: "AR", colombia: "CO", "puerto rico": "PR",
  "dominican republic": "DO", "republica dominicana": "DO", brazil: "BR", brasil: "BR",
  italy: "IT", italia: "IT", france: "FR", francia: "FR", germany: "DE", alemania: "DE",
  ireland: "IE", irlanda: "IE", sweden: "SE", suecia: "SE", australia: "AU",
  "south korea": "KR", "corea del sur": "KR", japan: "JP", japon: "JP",
};

const TITLE_ENTITY_WORDS = {
  color: ["red", "rojo", "roja", "blue", "azul", "green", "verde", "black", "negro", "negra", "white", "blanco", "blanca", "yellow", "amarillo", "amarilla", "pink", "rosa", "purple", "morado", "morada", "violeta", "orange", "naranja", "gold", "golden", "oro", "silver", "plata", "brown", "marron"],
  weekday: ["monday", "lunes", "tuesday", "martes", "wednesday", "miercoles", "thursday", "jueves", "friday", "viernes", "saturday", "sabado", "sunday", "domingo"],
  month: ["january", "enero", "february", "febrero", "march", "marzo", "april", "abril", "may", "mayo", "june", "junio", "july", "julio", "august", "agosto", "september", "septiembre", "october", "octubre", "november", "noviembre", "december", "diciembre"],
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

function candidateView(candidate: SpotifyTrackCandidate): CultureJudgeCandidate {
  return {
    spotifyId: candidate.spotifyId,
    title: candidate.title,
    artists: candidate.artists.map((artist) => artist.name),
    albumName: candidate.albumName,
    releaseDate: candidate.releaseDate,
  };
}

function normalizedWords(value: string) {
  return normalizeMusicText(value).split(" ").filter(Boolean);
}

function containsPhrase(value: string, phrase: string) {
  const haystack = ` ${normalizeMusicText(value)} `;
  const needle = normalizeMusicText(phrase);
  return Boolean(needle && haystack.includes(` ${needle} `));
}

function pickCandidate(candidates: SpotifyTrackCandidate[], title: string, artist?: string) {
  const normalizedTitle = normalizeMusicText(title);
  const normalizedArtist = artist ? normalizeMusicText(artist) : undefined;
  let exact = candidates.filter((candidate) => normalizeMusicText(candidate.title) === normalizedTitle);

  if (normalizedArtist) {
    exact = exact.filter((candidate) =>
      candidate.artists.some((item) => normalizeMusicText(item.name) === normalizedArtist),
    );
  }

  if (exact.length === 1) return { candidate: exact[0] };
  if (exact.length > 1) {
    const signatures = new Map<string, SpotifyTrackCandidate>();
    for (const candidate of exact) {
      const artistSignature = candidate.artists.map((item) => normalizeMusicText(item.name)).join("|");
      const recordingSignature = candidate.isrc || `${normalizeMusicText(candidate.title)}|${artistSignature}`;
      if (!signatures.has(recordingSignature)) signatures.set(recordingSignature, candidate);
    }
    const unique = [...signatures.values()];
    if (unique.length === 1) return { candidate: unique[0] };
    return { ambiguous: unique.slice(0, 3) };
  }

  return { ambiguous: candidates.slice(0, 3) };
}

async function resolveAnswer(input: { answerTitle?: string; answerArtist?: string; spotifyId?: string }) {
  if (input.spotifyId) return { candidate: await getSpotifyTrack(input.spotifyId) };
  const title = input.answerTitle?.trim() ?? "";
  if (title.length < 2) return { candidates: [] as SpotifyTrackCandidate[] };
  const candidates = await searchSpotifyTracks(title, input.answerArtist?.trim() || undefined);
  const picked = pickCandidate(candidates, title, input.answerArtist?.trim() || undefined);
  return { ...picked, candidates };
}

function conditionNeedsArtistEnrichment(condition: CultureCondition) {
  return ["artist_origin", "artist_type", "artist_relation", "former_group_member"].includes(condition.type);
}

function conditionNeedsSongEnrichment(condition: CultureCondition) {
  return ["language", "soundtrack_kind", "eurovision", "cover_version", "instrument_present"].includes(condition.type);
}

async function prepareEnrichment(challenge: CultureChallenge, artistIds: string[], songId: string, warnings: string[]) {
  if (challenge.conditions.some(conditionNeedsArtistEnrichment) && artistIds[0]) {
    try {
      await runArtistEnrichmentIfNeeded(artistIds[0]);
    } catch (error) {
      warnings.push(`Artista: ${error instanceof Error ? error.message : "no se pudo enriquecer"}`);
    }
  }

  if (challenge.conditions.some(conditionNeedsSongEnrichment)) {
    try {
      await runSongEnrichmentIfNeeded(songId);
    } catch (error) {
      warnings.push(`Canción: ${error instanceof Error ? error.message : "no se pudo enriquecer"}`);
    }
  }
}

async function loadJudgeContext(songId: string, primaryArtistId?: string): Promise<JudgeContext> {
  const { url, headers } = supabaseServiceConfig();
  const songPromise = fetch(
    `${url}/rest/v1/music_songs?id=eq.${encodeURIComponent(songId)}&select=id,title,release_year,language_codes&limit=1`,
    { headers, cache: "no-store" },
  );
  const artistPromise = primaryArtistId
    ? fetch(
        `${url}/rest/v1/music_artists?id=eq.${encodeURIComponent(primaryArtistId)}&select=id,name,artist_type,origin_country_code,origin_regions&limit=1`,
        { headers, cache: "no-store" },
      )
    : Promise.resolve(undefined);
  const songFactsPromise = fetch(
    `${url}/rest/v1/music_facts?song_id=eq.${encodeURIComponent(songId)}&status=in.(verified,rejected)&select=predicate,value_text,value_bool,status,confidence`,
    { headers, cache: "no-store" },
  );
  const artistFactsPromise = primaryArtistId
    ? fetch(
        `${url}/rest/v1/music_facts?artist_id=eq.${encodeURIComponent(primaryArtistId)}&status=in.(verified,rejected)&select=predicate,value_text,value_bool,status,confidence`,
        { headers, cache: "no-store" },
      )
    : Promise.resolve(undefined);

  const [songResponse, artistResponse, songFactsResponse, artistFactsResponse] = await Promise.all([
    songPromise,
    artistPromise,
    songFactsPromise,
    artistFactsPromise,
  ]);

  if (!songResponse.ok) throw new Error(`No se pudo cargar la canción (${songResponse.status})`);
  if (!songFactsResponse.ok) throw new Error(`No se pudieron cargar hechos de canción (${songFactsResponse.status})`);
  if (artistResponse && !artistResponse.ok) throw new Error(`No se pudo cargar el artista (${artistResponse.status})`);
  if (artistFactsResponse && !artistFactsResponse.ok) throw new Error(`No se pudieron cargar hechos del artista (${artistFactsResponse.status})`);

  const song = ((await songResponse.json()) as SongRow[])[0];
  if (!song) throw new Error("Canción no encontrada después de importarla");
  const primaryArtist = artistResponse ? ((await artistResponse.json()) as ArtistRow[])[0] : undefined;
  const songFacts = (await songFactsResponse.json()) as FactRow[];
  const artistFacts = artistFactsResponse ? ((await artistFactsResponse.json()) as FactRow[]) : [];
  return { song, primaryArtist, songFacts, artistFacts };
}

function reliableFact(fact: FactRow) {
  return fact.status === "verified" && (fact.confidence == null || Number(fact.confidence) >= 0.9);
}

function verifiedBoolean(facts: FactRow[], predicate: string) {
  return facts.some((fact) => fact.predicate === predicate && fact.value_bool === true && reliableFact(fact));
}

function verifiedTexts(facts: FactRow[], predicate: string) {
  return facts
    .filter((fact) => fact.predicate === predicate && fact.value_text && reliableFact(fact))
    .map((fact) => fact.value_text as string);
}

function countryCodeForRegion(region: string) {
  return COUNTRY_CODES[normalizeMusicText(region)];
}

function evaluateArtistOrigin(condition: Extract<CultureCondition, { type: "artist_origin" }>, context: JudgeContext): CultureConditionDecision {
  const artist = context.primaryArtist;
  if (!artist) return { conditionType: condition.type, status: "unverifiable", reason: "No existe un artista principal identificable" };

  const desired = normalizeMusicText(String(condition.region));
  const desiredCountry = countryCodeForRegion(desired);
  if (desiredCountry && artist.origin_country_code) {
    const valid = artist.origin_country_code.toUpperCase() === desiredCountry;
    return {
      conditionType: condition.type,
      status: valid ? "valid" : "invalid",
      reason: valid
        ? `${artist.name} tiene país de origen ${artist.origin_country_code}`
        : `${artist.name} tiene país de origen ${artist.origin_country_code}, no ${desiredCountry}`,
      source: "catálogo enriquecido",
    };
  }

  const regions = Array.from(new Set([
    ...(artist.origin_regions ?? []),
    ...verifiedTexts(context.artistFacts, "artist_origin_region"),
  ]));
  if (regions.some((region) => normalizeMusicText(region) === desired)) {
    return { conditionType: condition.type, status: "valid", reason: `${artist.name} tiene origen verificado en ${condition.region}`, source: "catálogo enriquecido" };
  }

  return {
    conditionType: condition.type,
    status: "unverifiable",
    reason: `No hay datos suficientemente completos para verificar que ${artist.name} sea de ${condition.region}`,
  };
}

function evaluateTitleEntity(condition: Extract<CultureCondition, { type: "title_entity" }>, title: string): CultureConditionDecision {
  const normalized = normalizeMusicText(title);
  if (condition.entity === "number") {
    const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "cero", "uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
    const valid = /\d/.test(title) || numberWords.some((word) => (` ${normalized} `).includes(` ${word} `));
    return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: valid ? "El título contiene un número" : "El título no contiene un número reconocible", source: "título canónico" };
  }

  if (condition.entity === "color" || condition.entity === "weekday" || condition.entity === "month") {
    const valid = TITLE_ENTITY_WORDS[condition.entity].some((word) => (` ${normalized} `).includes(` ${word} `));
    return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: valid ? `El título contiene ${condition.entity}` : `El título no contiene ${condition.entity} reconocible`, source: "título canónico" };
  }

  return {
    conditionType: condition.type,
    status: "unverifiable",
    reason: `La detección automática de ${condition.entity} en títulos todavía no está habilitada en la v1`,
  };
}

async function evaluateCondition(
  condition: CultureCondition,
  context: JudgeContext,
  candidate: SpotifyTrackCandidate,
): Promise<CultureConditionDecision> {
  switch (condition.type) {
    case "title_contains": {
      const valid = containsPhrase(candidate.title, condition.value);
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: valid ? `El título contiene «${condition.value}»` : `El título no contiene «${condition.value}» como palabra o frase completa`, source: "Spotify" };
    }
    case "lyrics_contains": {
      try {
        const result = await verifyLyricsFact(context.song.id, condition.value);
        if (result.status === "verified") return { conditionType: condition.type, status: "valid", reason: result.reason, source: result.provider };
        if (result.status === "rejected") return { conditionType: condition.type, status: "invalid", reason: result.reason, source: result.provider };
        return { conditionType: condition.type, status: "unverifiable", reason: result.reason, source: result.provider };
      } catch (error) {
        return { conditionType: condition.type, status: "unverifiable", reason: error instanceof Error ? error.message : "No se pudo verificar la letra" };
      }
    }
    case "title_entity":
      return evaluateTitleEntity(condition, candidate.title);
    case "artist_origin":
      return evaluateArtistOrigin(condition, context);
    case "artist_type": {
      const artist = context.primaryArtist;
      if (!artist || artist.artist_type === "unknown") return { conditionType: condition.type, status: "unverifiable", reason: "El tipo del artista principal todavía no está verificado" };
      const valid = artist.artist_type === condition.value;
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: `${artist.name} está clasificado como ${artist.artist_type}`, source: "catálogo enriquecido" };
    }
    case "artist_name_initial": {
      const artist = candidate.artists[0];
      if (!artist) return { conditionType: condition.type, status: "unverifiable", reason: "No hay artista principal" };
      const expected = normalizeMusicText(condition.value).slice(0, 1);
      const actual = normalizeMusicText(artist.name).slice(0, 1);
      const valid = Boolean(expected && actual === expected);
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: `${artist.name} ${valid ? "empieza" : "no empieza"} por ${condition.value.toUpperCase()}`, source: "Spotify" };
    }
    case "artist_relation": {
      if (condition.value !== "siblings") return { conditionType: condition.type, status: "unverifiable", reason: "La relación familiar genérica todavía no tiene un validador suficientemente preciso" };
      if (verifiedBoolean(context.artistFacts, "artist_has_sibling_member")) return { conditionType: condition.type, status: "valid", reason: "Existe una relación verificada de hermanos dentro del artista/grupo", source: "catálogo enriquecido" };
      return { conditionType: condition.type, status: "unverifiable", reason: "No existe todavía evidencia suficiente sobre hermanos en este artista/grupo" };
    }
    case "former_group_member": {
      if (verifiedBoolean(context.artistFacts, "artist_former_group_member")) return { conditionType: condition.type, status: "valid", reason: "El catálogo acredita pertenencia anterior a un grupo", source: "catálogo enriquecido" };
      return { conditionType: condition.type, status: "unverifiable", reason: "No existe todavía evidencia suficiente sobre pertenencia anterior a un grupo" };
    }
    case "instrument_present": {
      const instrument = canonicalInstrumentFromLabel(condition.instrument);
      if (!instrument) return { conditionType: condition.type, status: "unverifiable", reason: `El instrumento «${condition.instrument}» no pertenece todavía a la taxonomía soportada` };
      try {
        const result = await verifyInstrumentFact(context.song.id, instrument);
        return result.status === "verified"
          ? { conditionType: condition.type, status: "valid", reason: result.reason, source: result.provider }
          : { conditionType: condition.type, status: "unverifiable", reason: result.reason };
      } catch (error) {
        return { conditionType: condition.type, status: "unverifiable", reason: error instanceof Error ? error.message : "No se pudo verificar el instrumento" };
      }
    }
    case "release_period": {
      const year = context.song.release_year ?? Number.parseInt(candidate.releaseDate?.slice(0, 4) ?? "", 10);
      if (!Number.isFinite(year)) return { conditionType: condition.type, status: "unverifiable", reason: "No hay un año de publicación utilizable" };
      const afterStart = condition.yearFrom == null || year >= condition.yearFrom;
      const beforeEnd = condition.yearTo == null || year <= condition.yearTo;
      const valid = afterStart && beforeEnd;
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: `Año de publicación usado por el catálogo: ${year}`, source: "Spotify/catálogo" };
    }
    case "language": {
      const languages = context.song.language_codes ?? [];
      if (!languages.length) return { conditionType: condition.type, status: "unverifiable", reason: "El idioma de la canción todavía no está verificado" };
      const valid = languages.includes(condition.value);
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: `Idiomas verificados: ${languages.join(", ")}`, source: "catálogo enriquecido" };
    }
    case "soundtrack_kind": {
      const kinds = verifiedTexts(context.songFacts, "song_soundtrack_kind");
      if (kinds.includes(condition.value)) return { conditionType: condition.type, status: "valid", reason: `La canción está vinculada a banda sonora de tipo ${condition.value}`, source: "Wikidata/catálogo" };
      if (kinds.length) return { conditionType: condition.type, status: "invalid", reason: `La canción tiene banda sonora verificada, pero de tipo ${kinds.join(", ")}`, source: "Wikidata/catálogo" };
      return { conditionType: condition.type, status: "unverifiable", reason: "No existe una relación de banda sonora suficientemente verificada" };
    }
    case "eurovision": {
      if (!verifiedBoolean(context.songFacts, "song_eurovision")) return { conditionType: condition.type, status: "unverifiable", reason: "No existe una relación positiva de Eurovisión suficientemente verificada" };
      if (condition.country) {
        const originDecision = evaluateArtistOrigin({ type: "artist_origin", region: condition.country }, context);
        if (originDecision.status !== "valid") return { conditionType: condition.type, status: originDecision.status, reason: `Eurovisión está verificado, pero el país no: ${originDecision.reason}`, source: "Wikidata/catálogo" };
      }
      return { conditionType: condition.type, status: "valid", reason: "La canción tiene participación en Eurovisión verificada", source: "Wikidata/catálogo" };
    }
    case "collaboration": {
      const valid = candidate.artists.length > 1;
      return { conditionType: condition.type, status: valid ? "valid" : "invalid", reason: valid ? `Spotify acredita ${candidate.artists.length} artistas` : "Spotify acredita un solo artista", source: "Spotify" };
    }
    case "cover_version": {
      if (verifiedBoolean(context.songFacts, "song_is_cover")) return { conditionType: condition.type, status: "valid", reason: "MusicBrainz marca explícitamente esta grabación como cover", source: "MusicBrainz/catálogo" };
      return { conditionType: condition.type, status: "unverifiable", reason: "No existe evidencia positiva suficiente para confirmar que sea una versión; ausencia de dato no se trata como falso" };
    }
  }
}

export async function judgeCultureAnswer(input: {
  challenge: CultureChallenge;
  answerTitle?: string;
  answerArtist?: string;
  spotifyId?: string;
}): Promise<CultureJudgeResult> {
  if (!input.challenge.autoJudge || input.challenge.validationTier === "C") {
    return {
      status: "unverifiable",
      challengeId: input.challenge.id,
      prompt: input.challenge.prompt,
      decisions: [],
      warnings: ["Este reto no admite arbitraje automático"],
    };
  }

  const resolution = await resolveAnswer(input);
  if (!resolution.candidate) {
    const candidates = (resolution.ambiguous ?? resolution.candidates ?? []).map(candidateView);
    if (!candidates.length) {
      return {
        status: "not_found",
        challengeId: input.challenge.id,
        prompt: input.challenge.prompt,
        decisions: [],
        warnings: ["Spotify no encontró una canción suficientemente coincidente"],
      };
    }
    return {
      status: "ambiguous",
      challengeId: input.challenge.id,
      prompt: input.challenge.prompt,
      candidates,
      decisions: [],
      warnings: ["Hay varias coincidencias posibles. El jugador debe elegir la grabación correcta."],
    };
  }

  const candidate = resolution.candidate;
  const imported = await ingestSpotifyTrackById(candidate.spotifyId);
  const warnings: string[] = [];
  await prepareEnrichment(input.challenge, imported.artistIds, imported.songId, warnings);
  const context = await loadJudgeContext(imported.songId, imported.artistIds[0]);

  const decisions: CultureConditionDecision[] = [];
  for (const condition of input.challenge.conditions) {
    decisions.push(await evaluateCondition(condition, context, candidate));
  }

  const status: CultureJudgeStatus = decisions.some((decision) => decision.status === "invalid")
    ? "invalid"
    : decisions.length > 0 && decisions.every((decision) => decision.status === "valid")
      ? "valid"
      : "unverifiable";

  return {
    status,
    challengeId: input.challenge.id,
    prompt: input.challenge.prompt,
    candidate: candidateView(candidate),
    songId: imported.songId,
    decisions,
    warnings,
  };
}
