import type { CultureChallenge, CultureChallengeFamily } from "../cultureChallenges";
import { normalizeMusicText } from "./musicIngestion";

export type CultureGenerationMode = "development" | "game";

export type CultureGenerationCandidate = {
  key: string;
  challenge: CultureChallenge;
  knownAnswerCount: number;
  sampleAnswers: string[];
  requiredKnownAnswers: number;
  ready: boolean;
  readinessReason: string;
  validatorKind:
    | "catalog"
    | "spotify"
    | "lyrics"
    | "knowledge"
    | "instrumentation";
};

export type CultureGenerationReport = {
  mode: CultureGenerationMode;
  requestedCount: number;
  generatedCount: number;
  catalogSongCount: number;
  selected: CultureGenerationCandidate[];
  readyCandidates: CultureGenerationCandidate[];
  blockedCandidates: CultureGenerationCandidate[];
  warnings: string[];
};

type SongRow = {
  id: string;
  title: string;
  release_year?: number | null;
  language_codes?: string[] | null;
};

type ArtistRow = {
  id: string;
  name: string;
  artist_type?: "solo" | "group" | "duo" | "unknown";
  origin_country_code?: string | null;
  origin_regions?: string[] | null;
};

type SongArtistRow = {
  song_id: string;
  artist_id: string;
  credit_order?: number | null;
  role?: string | null;
  music_artists?: ArtistRow | null;
};

type FactRow = {
  song_id?: string | null;
  artist_id?: string | null;
  predicate: string;
  value_text?: string | null;
  value_bool?: boolean | null;
  confidence?: number | null;
};

type CatalogSnapshot = {
  songs: SongRow[];
  songArtists: SongArtistRow[];
  facts: FactRow[];
};

const PAGE_SIZE = 1000;

const LANGUAGE_LABELS: Record<string, string> = {
  es: "español",
  en: "inglés",
  fr: "francés",
  it: "italiano",
  pt: "portugués",
  ko: "coreano",
  ja: "japonés",
};

const COUNTRY_LABELS: Record<string, string> = {
  ES: "españoles",
  US: "estadounidenses",
  GB: "británicos",
  MX: "mexicanos",
  AR: "argentinos",
  CO: "colombianos",
  PR: "puertorriqueños",
  DO: "dominicanos",
  BR: "brasileños",
  IT: "italianos",
  FR: "franceses",
  DE: "alemanes",
  IE: "irlandeses",
  SE: "suecos",
  AU: "australianos",
  KR: "surcoreanos",
  JP: "japoneses",
};

const INSTRUMENT_LABELS: Record<string, string> = {
  harmonica: "armónica",
  saxophone: "saxofón",
  piano: "piano",
  violin: "violín",
  guitar: "guitarra",
  bass: "bajo",
  drums: "batería",
  percussion: "percusión",
  trumpet: "trompeta",
  trombone: "trombón",
  flute: "flauta",
  clarinet: "clarinete",
  cello: "violonchelo",
  organ: "órgano",
  synthesizer: "sintetizador",
  accordion: "acordeón",
  banjo: "banjo",
  mandolin: "mandolina",
  ukulele: "ukelele",
  harp: "arpa",
};

const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "of", "to", "in", "on", "for", "with", "my", "your", "me", "you",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "y", "en", "por", "para", "con", "mi", "tu",
  "feat", "featuring", "remaster", "remastered", "version", "edit", "live",
]);

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

async function fetchAll<T>(path: string): Promise<T[]> {
  const { url, headers } = supabaseServiceConfig();
  const output: T[] = [];
  for (let offset = 0; offset < 20_000; offset += PAGE_SIZE) {
    const response = await fetch(`${url}${path}${path.includes("?") ? "&" : "?"}offset=${offset}&limit=${PAGE_SIZE}`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`No se pudo leer cobertura del catálogo (${response.status}): ${detail.slice(0, 220)}`);
    }
    const rows = (await response.json()) as T[];
    output.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return output;
}

async function loadSnapshot(): Promise<CatalogSnapshot> {
  const [songs, songArtists, facts] = await Promise.all([
    fetchAll<SongRow>("/rest/v1/music_songs?select=id,title,release_year,language_codes"),
    fetchAll<SongArtistRow>("/rest/v1/music_song_artists?select=song_id,artist_id,credit_order,role,music_artists(id,name,artist_type,origin_country_code,origin_regions)&order=credit_order.asc"),
    fetchAll<FactRow>("/rest/v1/music_facts?status=eq.verified&confidence=gte.0.9&select=song_id,artist_id,predicate,value_text,value_bool,confidence"),
  ]);
  return { songs, songArtists, facts };
}

function addToGroup(map: Map<string, Set<string>>, key: string | undefined | null, songId: string) {
  if (!key) return;
  const normalized = String(key).trim();
  if (!normalized) return;
  const set = map.get(normalized) ?? new Set<string>();
  set.add(songId);
  map.set(normalized, set);
}

function factSongGroups(facts: FactRow[], predicate: string, truthyOnly = false) {
  const groups = new Map<string, Set<string>>();
  for (const fact of facts) {
    if (fact.predicate !== predicate || !fact.song_id) continue;
    if (truthyOnly) {
      if (fact.value_bool === true) addToGroup(groups, "true", fact.song_id);
      continue;
    }
    if (fact.value_text) addToGroup(groups, fact.value_text, fact.song_id);
  }
  return groups;
}

function answerTitles(ids: Iterable<string>, songById: Map<string, SongRow>, limit = 5) {
  const titles: string[] = [];
  for (const id of ids) {
    const title = songById.get(id)?.title;
    if (title && !titles.includes(title)) titles.push(title);
    if (titles.length >= limit) break;
  }
  return titles;
}

function gameMinimum(kind: CultureGenerationCandidate["validatorKind"]) {
  if (kind === "lyrics" || kind === "instrumentation") return 8;
  if (kind === "knowledge") return 6;
  return 6;
}

function requiredKnownAnswers(mode: CultureGenerationMode, kind: CultureGenerationCandidate["validatorKind"]) {
  return mode === "development" ? 1 : gameMinimum(kind);
}

function challengeDifficulty(kind: CultureGenerationCandidate["validatorKind"], count: number, total: number): CultureChallenge["difficulty"] {
  if (kind === "instrumentation") return count >= 10 ? "medium" : "hard";
  if (kind === "lyrics") return count >= 10 ? "medium" : "hard";
  if (kind === "knowledge") return count >= 10 ? "medium" : "hard";
  const ratio = total > 0 ? count / total : 0;
  if (count >= 8 && ratio >= 0.35) return "easy";
  if (count >= 4) return "medium";
  return "hard";
}

function makeCandidate(input: {
  key: string;
  prompt: string;
  family: CultureChallengeFamily;
  conditions: CultureChallenge["conditions"];
  tier: CultureChallenge["validationTier"];
  sources: CultureChallenge["validationSources"];
  validatorKind: CultureGenerationCandidate["validatorKind"];
  answerIds: Set<string>;
  snapshot: CatalogSnapshot;
  mode: CultureGenerationMode;
}): CultureGenerationCandidate {
  const songById = new Map(input.snapshot.songs.map((song) => [song.id, song]));
  const knownAnswerCount = input.answerIds.size;
  const required = requiredKnownAnswers(input.mode, input.validatorKind);
  const ready = knownAnswerCount >= required;
  return {
    key: input.key,
    challenge: {
      id: `generated-${input.key}`,
      prompt: input.prompt,
      family: input.family,
      difficulty: challengeDifficulty(input.validatorKind, knownAnswerCount, input.snapshot.songs.length),
      conditions: input.conditions,
      validationTier: input.tier,
      validationSources: input.sources,
      autoJudge: true,
      notes: `Generado con ${knownAnswerCount} respuestas ancla verificables en catálogo.`,
    },
    knownAnswerCount,
    sampleAnswers: answerTitles(input.answerIds, songById),
    requiredKnownAnswers: required,
    ready,
    readinessReason: ready
      ? `${knownAnswerCount} respuestas ancla verificables (mínimo ${required})`
      : `Solo ${knownAnswerCount} respuestas ancla; hacen falta ${required}`,
    validatorKind: input.validatorKind,
  };
}

function collectCandidates(snapshot: CatalogSnapshot, mode: CultureGenerationMode): CultureGenerationCandidate[] {
  const candidates: CultureGenerationCandidate[] = [];
  const songById = new Map(snapshot.songs.map((song) => [song.id, song]));

  const primaryArtistBySong = new Map<string, ArtistRow>();
  const artistsPerSong = new Map<string, Set<string>>();
  for (const link of snapshot.songArtists) {
    const artistIds = artistsPerSong.get(link.song_id) ?? new Set<string>();
    artistIds.add(link.artist_id);
    artistsPerSong.set(link.song_id, artistIds);
    if ((link.credit_order ?? 0) === 0 && link.music_artists) primaryArtistBySong.set(link.song_id, link.music_artists);
  }

  // Language. Prefer canonical song metadata; verified facts fill gaps.
  const languageGroups = new Map<string, Set<string>>();
  for (const song of snapshot.songs) {
    for (const language of song.language_codes ?? []) addToGroup(languageGroups, language, song.id);
  }
  for (const fact of snapshot.facts) {
    if (fact.predicate === "song_language" && fact.song_id && fact.value_text) addToGroup(languageGroups, fact.value_text, fact.song_id);
  }
  for (const [language, ids] of languageGroups) {
    const label = LANGUAGE_LABELS[language] ?? language.toUpperCase();
    candidates.push(makeCandidate({
      key: `language-${normalizeMusicText(language)}`,
      prompt: `Canciones cantadas principalmente en ${label}`,
      family: "words",
      conditions: [{ type: "language", value: language as never }],
      tier: "B",
      sources: ["catalog", "lyrics-provider"],
      validatorKind: "catalog",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  // Release decades.
  const decadeGroups = new Map<string, Set<string>>();
  for (const song of snapshot.songs) {
    if (!song.release_year) continue;
    const decade = Math.floor(song.release_year / 10) * 10;
    if (decade < 1950 || decade > 2020) continue;
    addToGroup(decadeGroups, String(decade), song.id);
  }
  for (const [decadeText, ids] of decadeGroups) {
    const decade = Number(decadeText);
    candidates.push(makeCandidate({
      key: `release-${decade}s`,
      prompt: `Canciones publicadas entre ${decade} y ${decade + 9}`,
      family: "release",
      conditions: [{ type: "release_period", yearFrom: decade, yearTo: decade + 9 }],
      tier: "A",
      sources: ["spotify", "catalog"],
      validatorKind: "spotify",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  // Artist origin, type and initial from primary artist.
  const countryGroups = new Map<string, Set<string>>();
  const typeGroups = new Map<string, Set<string>>();
  const initialGroups = new Map<string, Set<string>>();
  for (const song of snapshot.songs) {
    const artist = primaryArtistBySong.get(song.id);
    if (!artist) continue;
    if (artist.origin_country_code) addToGroup(countryGroups, artist.origin_country_code.toUpperCase(), song.id);
    if (artist.artist_type && artist.artist_type !== "unknown") addToGroup(typeGroups, artist.artist_type, song.id);
    const initial = normalizeMusicText(artist.name).slice(0, 1).toUpperCase();
    if (/^[A-Z0-9]$/.test(initial)) addToGroup(initialGroups, initial, song.id);
  }
  for (const [country, ids] of countryGroups) {
    const label = COUNTRY_LABELS[country] ?? `de ${country}`;
    candidates.push(makeCandidate({
      key: `artist-country-${country.toLowerCase()}`,
      prompt: `Canciones de artistas ${label}`,
      family: "artist",
      conditions: [{ type: "artist_origin", region: country.toLowerCase() }],
      tier: "B",
      sources: ["knowledge-base", "catalog"],
      validatorKind: "knowledge",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }
  for (const [artistType, ids] of typeGroups) {
    const label = artistType === "solo" ? "solistas" : artistType === "group" ? "grupos" : "dúos";
    candidates.push(makeCandidate({
      key: `artist-type-${artistType}`,
      prompt: `Canciones interpretadas por ${label}`,
      family: "artist",
      conditions: [{ type: "artist_type", value: artistType as "solo" | "group" | "duo" }],
      tier: "A",
      sources: ["catalog", "knowledge-base"],
      validatorKind: "catalog",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }
  for (const [initial, ids] of initialGroups) {
    candidates.push(makeCandidate({
      key: `artist-initial-${initial.toLowerCase()}`,
      prompt: `Canciones de artistas cuyo nombre empiece por ${initial}`,
      family: "artist",
      conditions: [{ type: "artist_name_initial", value: initial }],
      tier: "A",
      sources: ["spotify", "catalog"],
      validatorKind: "spotify",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  // Collaboration can be inferred deterministically from credits; positive facts also count.
  const collaborationIds = new Set<string>();
  for (const [songId, artistIds] of artistsPerSong) if (artistIds.size > 1) collaborationIds.add(songId);
  for (const fact of snapshot.facts) {
    if (fact.predicate === "song_is_collaboration" && fact.song_id && fact.value_bool === true) collaborationIds.add(fact.song_id);
  }
  if (collaborationIds.size) {
    candidates.push(makeCandidate({
      key: "collaboration",
      prompt: "Canciones acreditadas a dos o más artistas",
      family: "artist",
      conditions: [{ type: "collaboration" }],
      tier: "A",
      sources: ["spotify", "catalog"],
      validatorKind: "spotify",
      answerIds: collaborationIds,
      snapshot,
      mode,
    }));
  }

  // Positive knowledge facts.
  const coverIds = factSongGroups(snapshot.facts, "song_is_cover", true).get("true") ?? new Set<string>();
  if (coverIds.size) candidates.push(makeCandidate({
    key: "cover-version",
    prompt: "Canciones que sean una versión de una canción anterior",
    family: "music-history",
    conditions: [{ type: "cover_version" }],
    tier: "B",
    sources: ["knowledge-base", "catalog"],
    validatorKind: "knowledge",
    answerIds: coverIds,
    snapshot,
    mode,
  }));

  const eurovisionIds = factSongGroups(snapshot.facts, "song_eurovision", true).get("true") ?? new Set<string>();
  if (eurovisionIds.size) candidates.push(makeCandidate({
    key: "eurovision",
    prompt: "Canciones que hayan participado en Eurovisión",
    family: "music-history",
    conditions: [{ type: "eurovision" }],
    tier: "B",
    sources: ["knowledge-base", "catalog"],
    validatorKind: "knowledge",
    answerIds: eurovisionIds,
    snapshot,
    mode,
  }));

  const soundtrackGroups = factSongGroups(snapshot.facts, "song_soundtrack_kind");
  for (const [kind, ids] of soundtrackGroups) {
    const labels: Record<string, string> = { film: "cine", animation: "animación", series: "series", musical: "musicales" };
    candidates.push(makeCandidate({
      key: `soundtrack-${normalizeMusicText(kind)}`,
      prompt: `Canciones asociadas a una banda sonora de ${labels[kind] ?? kind}`,
      family: "audiovisual",
      conditions: [{ type: "soundtrack_kind", value: kind as "film" | "animation" | "series" | "musical" }],
      tier: "B",
      sources: ["knowledge-base", "catalog"],
      validatorKind: "knowledge",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  const instrumentGroups = factSongGroups(snapshot.facts, "song_instrument_present");
  for (const [instrument, ids] of instrumentGroups) {
    const label = INSTRUMENT_LABELS[instrument] ?? instrument;
    candidates.push(makeCandidate({
      key: `instrument-${normalizeMusicText(instrument)}`,
      prompt: `Canciones donde suene ${/^[aeiouáéíóú]/i.test(label) ? "un" : "un"} ${label}`,
      family: "instrumentation",
      conditions: [{ type: "instrument_present", instrument }],
      tier: "B",
      sources: ["instrumentation-index", "knowledge-base"],
      validatorKind: "instrumentation",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  const lyricGroups = factSongGroups(snapshot.facts, "song_lyrics_contains");
  for (const [word, ids] of lyricGroups) {
    candidates.push(makeCandidate({
      key: `lyrics-${normalizeMusicText(word)}`,
      prompt: `Canciones cuya letra contenga la palabra o frase «${word}»`,
      family: "words",
      conditions: [{ type: "lyrics_contains", value: word }],
      tier: "B",
      sources: ["lyrics-provider", "catalog"],
      validatorKind: "lyrics",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  // Common words in canonical titles. These are deterministic and cheap to judge.
  const titleWordGroups = new Map<string, Set<string>>();
  for (const song of snapshot.songs) {
    const uniqueWords = new Set(normalizeMusicText(song.title).split(" ").filter(Boolean));
    for (const word of uniqueWords) {
      if (word.length < 3 || TITLE_STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      addToGroup(titleWordGroups, word, song.id);
    }
  }
  for (const [word, ids] of titleWordGroups) {
    if (ids.size < 2 && mode === "development") continue;
    candidates.push(makeCandidate({
      key: `title-word-${word}`,
      prompt: `Canciones con la palabra «${word}» en el título`,
      family: "title",
      conditions: [{ type: "title_contains", value: word }],
      tier: "A",
      sources: ["spotify", "catalog"],
      validatorKind: "spotify",
      answerIds: ids,
      snapshot,
      mode,
    }));
  }

  // Remove impossible stale song IDs just in case facts outlive a deleted song.
  const existingSongIds = new Set(songById.keys());
  return candidates.map((candidate) => ({
    ...candidate,
    sampleAnswers: candidate.sampleAnswers.filter((title) => Boolean(title)),
  })).filter((candidate) => candidate.knownAnswerCount > 0 && existingSongIds.size > 0);
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function selectDiverse(candidates: CultureGenerationCandidate[], count: number, random: () => number) {
  const available = [...candidates];
  const selected: CultureGenerationCandidate[] = [];
  while (available.length && selected.length < count) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    available.forEach((candidate, index) => {
      const sameFamily = selected.filter((item) => item.challenge.family === candidate.challenge.family).length;
      const sameValidator = selected.filter((item) => item.validatorKind === candidate.validatorKind).length;
      const consecutiveFamily = selected.at(-1)?.challenge.family === candidate.challenge.family ? 40 : 0;
      const supportBonus = Math.min(20, candidate.knownAnswerCount * 1.5);
      const score = 100 + supportBonus - sameFamily * 24 - sameValidator * 5 - consecutiveFamily + random() * 16;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    selected.push(available.splice(bestIndex, 1)[0]);
  }
  return selected;
}

export async function generateCultureRound(input?: {
  mode?: CultureGenerationMode;
  count?: number;
  seed?: string;
}): Promise<CultureGenerationReport> {
  const mode = input?.mode ?? "game";
  const requestedCount = Math.max(1, Math.min(12, Math.trunc(input?.count ?? 9)));
  const snapshot = await loadSnapshot();
  const allCandidates = collectCandidates(snapshot, mode);
  const readyCandidates = allCandidates
    .filter((candidate) => candidate.ready)
    .sort((a, b) => b.knownAnswerCount - a.knownAnswerCount || a.challenge.prompt.localeCompare(b.challenge.prompt));
  const blockedCandidates = allCandidates
    .filter((candidate) => !candidate.ready)
    .sort((a, b) => b.knownAnswerCount - a.knownAnswerCount || a.challenge.prompt.localeCompare(b.challenge.prompt));
  const random = seededRandom(input?.seed ?? `${Date.now()}`);
  const selected = selectDiverse(readyCandidates, requestedCount, random);
  const warnings: string[] = [];

  if (snapshot.songs.length < 100) {
    warnings.push(`El catálogo todavía es pequeño (${snapshot.songs.length} canciones). La cobertura crecerá al ampliar la ingesta.`);
  }
  if (selected.length < requestedCount) {
    warnings.push(`Solo hay ${selected.length} retos con cobertura suficiente para generar ${requestedCount}. No se rellenan huecos con retos débiles.`);
  }
  if (mode === "development") {
    warnings.push("Modo desarrollo: basta 1 respuesta ancla para probar el validador. No equivale a estar listo para una partida real.");
  }

  return {
    mode,
    requestedCount,
    generatedCount: selected.length,
    catalogSongCount: snapshot.songs.length,
    selected,
    readyCandidates,
    blockedCandidates,
    warnings,
  };
}
