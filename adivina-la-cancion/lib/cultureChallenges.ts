import { MusicLanguage, MusicRegion } from "./content";

export type CultureChallengeFamily =
  | "words"
  | "title"
  | "artist"
  | "release"
  | "instrumentation"
  | "audiovisual"
  | "music-history";

export type CultureValidationTier = "A" | "B" | "C";
export type CultureValidationSource =
  | "catalog"
  | "spotify"
  | "lyrics-provider"
  | "knowledge-base"
  | "instrumentation-index";

export type CultureCondition =
  | { type: "title_contains"; value: string }
  | { type: "lyrics_contains"; value: string; language?: MusicLanguage }
  | { type: "title_entity"; entity: "color" | "person" | "city" | "country" | "weekday" | "month" | "number" }
  | { type: "artist_origin"; region: MusicRegion | string }
  | { type: "artist_type"; value: "solo" | "group" | "duo" }
  | { type: "artist_name_initial"; value: string }
  | { type: "artist_relation"; value: "siblings" | "family" }
  | { type: "former_group_member" }
  | { type: "instrument_present"; instrument: string }
  | { type: "release_period"; yearFrom?: number; yearTo?: number }
  | { type: "language"; value: MusicLanguage }
  | { type: "soundtrack_kind"; value: "film" | "animation" | "series" | "musical" }
  | { type: "eurovision"; country?: string }
  | { type: "collaboration" }
  | { type: "cover_version" };

export interface CultureChallenge {
  id: string;
  prompt: string;
  family: CultureChallengeFamily;
  difficulty: "easy" | "medium" | "hard" | "expert";
  conditions: CultureCondition[];
  validationTier: CultureValidationTier;
  validationSources: CultureValidationSource[];
  autoJudge: boolean;
  notes?: string;
}

export interface CultureChallengeTemplate {
  id: string;
  name: string;
  family: CultureChallengeFamily;
  difficultyRange: Array<CultureChallenge["difficulty"]>;
  validationTier: CultureValidationTier;
  validationSources: CultureValidationSource[];
  autoJudge: boolean;
  parameterKeys: string[];
  samplePrompts: string[];
  notes?: string;
}

/**
 * Tier A: deterministic with structured data.
 * Tier B: objectively verifiable, but requires an enriched source/index.
 * Tier C: ambiguous or subjective. Never generated automatically.
 */
export const CULTURE_CHALLENGE_TEMPLATES: CultureChallengeTemplate[] = [
  {
    id: "lyrics-word",
    name: "Palabra en la letra",
    family: "words",
    difficultyRange: ["easy", "medium", "hard"],
    validationTier: "B",
    validationSources: ["lyrics-provider", "catalog"],
    autoJudge: true,
    parameterKeys: ["word", "language"],
    samplePrompts: [
      "Canciones en español cuya letra contenga la palabra «amor»",
      "Canciones en inglés cuya letra contenga la palabra «night»",
    ],
  },
  {
    id: "title-word",
    name: "Palabra en el título",
    family: "title",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["spotify", "catalog"],
    autoJudge: true,
    parameterKeys: ["word"],
    samplePrompts: ["Canciones con la palabra «corazón» en el título"],
  },
  {
    id: "title-color",
    name: "Color en el título",
    family: "title",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["catalog"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que tengan un color en el título"],
  },
  {
    id: "title-person",
    name: "Nombre de persona en el título",
    family: "title",
    difficultyRange: ["easy", "medium"],
    validationTier: "B",
    validationSources: ["catalog", "knowledge-base"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que tengan un nombre de persona en el título"],
  },
  {
    id: "title-city",
    name: "Ciudad en el título",
    family: "title",
    difficultyRange: ["medium", "hard"],
    validationTier: "B",
    validationSources: ["catalog", "knowledge-base"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que tengan una ciudad en el título"],
  },
  {
    id: "title-weekday",
    name: "Día de la semana en el título",
    family: "title",
    difficultyRange: ["medium", "hard"],
    validationTier: "A",
    validationSources: ["catalog"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que mencionen un día de la semana en el título"],
  },
  {
    id: "title-number",
    name: "Número en el título",
    family: "title",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["catalog"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que tengan un número en el título"],
  },
  {
    id: "artist-country",
    name: "Artista de un país",
    family: "artist",
    difficultyRange: ["easy", "medium", "hard"],
    validationTier: "B",
    validationSources: ["knowledge-base", "catalog"],
    autoJudge: true,
    parameterKeys: ["country", "artistType"],
    samplePrompts: [
      "Canciones de grupos argentinos",
      "Canciones de artistas mexicanos",
    ],
  },
  {
    id: "artist-subregion",
    name: "Artista de una región concreta",
    family: "artist",
    difficultyRange: ["medium", "hard", "expert"],
    validationTier: "B",
    validationSources: ["knowledge-base"],
    autoJudge: true,
    parameterKeys: ["subregion", "artistType"],
    samplePrompts: ["Canciones de grupos andaluces"],
    notes: "Requires artist origin below country level, e.g. Andalucía, Galicia, Texas or California.",
  },
  {
    id: "artist-name-initial",
    name: "Inicial del artista",
    family: "artist",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["spotify", "catalog"],
    autoJudge: true,
    parameterKeys: ["letter"],
    samplePrompts: ["Canciones de artistas cuyo nombre empiece por M"],
  },
  {
    id: "artist-type",
    name: "Tipo de artista",
    family: "artist",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["catalog", "knowledge-base"],
    autoJudge: true,
    parameterKeys: ["artistType"],
    samplePrompts: ["Canciones interpretadas por un dúo"],
  },
  {
    id: "siblings",
    name: "Grupos con hermanos",
    family: "music-history",
    difficultyRange: ["hard", "expert"],
    validationTier: "B",
    validationSources: ["knowledge-base"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones de grupos formados por al menos dos hermanos"],
  },
  {
    id: "former-group-member",
    name: "Solista que perteneció a un grupo",
    family: "music-history",
    difficultyRange: ["medium", "hard"],
    validationTier: "B",
    validationSources: ["knowledge-base"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones de solistas que antes pertenecieron a un grupo"],
  },
  {
    id: "instrument-present",
    name: "Instrumento presente",
    family: "instrumentation",
    difficultyRange: ["medium", "hard", "expert"],
    validationTier: "B",
    validationSources: ["instrumentation-index", "knowledge-base"],
    autoJudge: true,
    parameterKeys: ["instrument"],
    samplePrompts: [
      "Canciones donde suene una armónica",
      "Canciones donde suene un saxofón",
      "Canciones donde suene claramente un violín",
    ],
    notes: "Only instantiate instruments with enough pre-verified songs in the catalogue.",
  },
  {
    id: "release-period",
    name: "Periodo de publicación",
    family: "release",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["spotify", "catalog"],
    autoJudge: true,
    parameterKeys: ["yearFrom", "yearTo"],
    samplePrompts: ["Canciones publicadas entre 1990 y 1999"],
  },
  {
    id: "language",
    name: "Idioma de la canción",
    family: "words",
    difficultyRange: ["easy", "medium"],
    validationTier: "B",
    validationSources: ["catalog", "lyrics-provider"],
    autoJudge: true,
    parameterKeys: ["language"],
    samplePrompts: ["Canciones cantadas principalmente en italiano"],
  },
  {
    id: "soundtrack-kind",
    name: "Canción asociada a cine, series o musicales",
    family: "audiovisual",
    difficultyRange: ["medium", "hard"],
    validationTier: "B",
    validationSources: ["knowledge-base", "catalog"],
    autoJudge: true,
    parameterKeys: ["kind"],
    samplePrompts: [
      "Canciones que aparezcan en una película de animación",
      "Canciones pertenecientes a un musical",
    ],
  },
  {
    id: "eurovision",
    name: "Eurovisión",
    family: "music-history",
    difficultyRange: ["medium", "hard"],
    validationTier: "B",
    validationSources: ["knowledge-base", "catalog"],
    autoJudge: true,
    parameterKeys: ["country"],
    samplePrompts: ["Canciones de artistas que hayan representado a España en Eurovisión"],
  },
  {
    id: "collaboration",
    name: "Colaboración entre artistas",
    family: "artist",
    difficultyRange: ["easy", "medium"],
    validationTier: "A",
    validationSources: ["spotify", "catalog"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones acreditadas a dos o más artistas principales"],
  },
  {
    id: "cover-version",
    name: "Versiones de otras canciones",
    family: "music-history",
    difficultyRange: ["medium", "hard"],
    validationTier: "B",
    validationSources: ["knowledge-base", "catalog"],
    autoJudge: true,
    parameterKeys: [],
    samplePrompts: ["Canciones que sean una versión de una canción anterior"],
  },
  {
    id: "subjective-sound",
    name: "Condición sonora subjetiva",
    family: "instrumentation",
    difficultyRange: ["hard", "expert"],
    validationTier: "C",
    validationSources: [],
    autoJudge: false,
    parameterKeys: ["description"],
    samplePrompts: ["Canciones con un solo de guitarra épico"],
    notes: "Kept only to define the boundary. Tier C challenges are excluded from automatic games.",
  },
];

export const AUTO_CULTURE_TEMPLATES = CULTURE_CHALLENGE_TEMPLATES.filter(
  (template) => template.autoJudge && template.validationTier !== "C",
);

export function selectCultureTemplates(
  count: number,
  pool: CultureChallengeTemplate[] = AUTO_CULTURE_TEMPLATES,
  random: () => number = Math.random,
): CultureChallengeTemplate[] {
  const available = [...pool];
  const selected: CultureChallengeTemplate[] = [];

  while (selected.length < count && available.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    available.forEach((candidate, index) => {
      const sameFamily = selected.filter((item) => item.family === candidate.family).length;
      const consecutivePenalty = selected.at(-1)?.family === candidate.family ? 45 : 0;
      const tierPenalty = selected.filter((item) => item.validationTier === candidate.validationTier).length * 2;
      const score = 100 - sameFamily * 18 - consecutivePenalty - tierPenalty + random() * 10;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    selected.push(available.splice(bestIndex, 1)[0]);
  }

  return selected;
}
