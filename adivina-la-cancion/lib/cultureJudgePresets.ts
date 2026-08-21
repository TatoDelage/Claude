import type { CultureChallenge } from "./cultureChallenges";

export interface CultureJudgePreset {
  id: string;
  challenge: CultureChallenge;
  suggestedAnswer: string;
  suggestedArtist?: string;
}

export const CULTURE_JUDGE_PRESETS: CultureJudgePreset[] = [
  {
    id: "lyrics-love",
    challenge: {
      id: "judge-lyrics-love",
      prompt: "Canciones cuya letra contenga la palabra «love»",
      family: "words",
      difficulty: "easy",
      conditions: [{ type: "lyrics_contains", value: "love", language: "en" }],
      validationTier: "B",
      validationSources: ["lyrics-provider", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "I Will Always Love You",
    suggestedArtist: "Whitney Houston",
  },
  {
    id: "title-corazon",
    challenge: {
      id: "judge-title-corazon",
      prompt: "Canciones con la palabra «corazón» en el título",
      family: "title",
      difficulty: "easy",
      conditions: [{ type: "title_contains", value: "corazón" }],
      validationTier: "A",
      validationSources: ["spotify", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "Corazón partío",
    suggestedArtist: "Alejandro Sanz",
  },
  {
    id: "artist-spain",
    challenge: {
      id: "judge-artist-spain",
      prompt: "Canciones de artistas españoles",
      family: "artist",
      difficulty: "easy",
      conditions: [{ type: "artist_origin", region: "spain" }],
      validationTier: "B",
      validationSources: ["knowledge-base", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "La Flaca",
    suggestedArtist: "Jarabe de Palo",
  },
  {
    id: "release-90s",
    challenge: {
      id: "judge-release-90s",
      prompt: "Canciones publicadas entre 1990 y 1999",
      family: "release",
      difficulty: "easy",
      conditions: [{ type: "release_period", yearFrom: 1990, yearTo: 1999 }],
      validationTier: "A",
      validationSources: ["spotify", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "Wonderwall",
    suggestedArtist: "Oasis",
  },
  {
    id: "collaboration",
    challenge: {
      id: "judge-collaboration",
      prompt: "Canciones acreditadas a dos o más artistas",
      family: "artist",
      difficulty: "easy",
      conditions: [{ type: "collaboration" }],
      validationTier: "A",
      validationSources: ["spotify", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "Under Pressure",
    suggestedArtist: "Queen",
  },
  {
    id: "eurovision",
    challenge: {
      id: "judge-eurovision",
      prompt: "Canciones que hayan participado en Eurovisión",
      family: "music-history",
      difficulty: "medium",
      conditions: [{ type: "eurovision" }],
      validationTier: "B",
      validationSources: ["knowledge-base", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "Euphoria",
    suggestedArtist: "Loreen",
  },
  {
    id: "soundtrack-film",
    challenge: {
      id: "judge-soundtrack-film",
      prompt: "Canciones asociadas a una banda sonora de cine",
      family: "audiovisual",
      difficulty: "medium",
      conditions: [{ type: "soundtrack_kind", value: "film" }],
      validationTier: "B",
      validationSources: ["knowledge-base", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "Shallow",
    suggestedArtist: "Lady Gaga",
  },
  {
    id: "cover",
    challenge: {
      id: "judge-cover",
      prompt: "Canciones que sean una versión de una canción anterior",
      family: "music-history",
      difficulty: "medium",
      conditions: [{ type: "cover_version" }],
      validationTier: "B",
      validationSources: ["knowledge-base", "catalog"],
      autoJudge: true,
    },
    suggestedAnswer: "I Will Always Love You",
    suggestedArtist: "Whitney Houston",
  },
  {
    id: "instrument-saxophone",
    challenge: {
      id: "judge-instrument-saxophone",
      prompt: "Canciones donde suene un saxofón verificado",
      family: "instrumentation",
      difficulty: "medium",
      conditions: [{ type: "instrument_present", instrument: "saxophone" }],
      validationTier: "B",
      validationSources: ["instrumentation-index", "knowledge-base"],
      autoJudge: true,
    },
    suggestedAnswer: "Baker Street",
    suggestedArtist: "Gerry Rafferty",
  },
];

export function cultureJudgePresetById(id: string): CultureJudgePreset | undefined {
  return CULTURE_JUDGE_PRESETS.find((preset) => preset.id === id);
}
