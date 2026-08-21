import { GameCategory } from "./content";

/**
 * Core category recipes. These are content rules shared by rounds and the future Music Engine.
 * They are intentionally composable: a song may match several recipes.
 */
export const CORE_CATEGORIES: GameCategory[] = [
  {
    id: "rock-spain-2000s",
    name: "Rock español · 2000-2009",
    filters: { genresAny: ["rock"], regionsAny: ["spain"], yearFrom: 2000, yearTo: 2009 },
    preferredRounds: [2],
  },
  {
    id: "pop-divas-2010s",
    name: "Divas pop · 2010-2019",
    filters: { genresAny: ["pop"], yearFrom: 2010, yearTo: 2019, tagsAll: ["diva"] },
    preferredRounds: [2],
  },
  {
    id: "reggaeton-pre-2015",
    name: "Reggaetón · antes de 2015",
    filters: { genresAny: ["reggaeton"], yearTo: 2014 },
    preferredRounds: [2],
  },
  {
    id: "indie-spain-2010-2018",
    name: "Indie español · 2010-2018",
    filters: { genresAny: ["indie"], regionsAny: ["spain"], yearFrom: 2010, yearTo: 2018 },
    preferredRounds: [2],
  },
  {
    id: "one-hit-wonders-2000s",
    name: "One-hit wonders · años 2000",
    filters: { yearFrom: 2000, yearTo: 2009, tagsAll: ["one-hit-wonder"] },
    preferredRounds: [2],
  },
  {
    id: "animated-soundtracks",
    name: "Bandas sonoras · animación",
    filters: { genresAny: ["soundtrack"], tagsAll: ["animation"] },
    preferredRounds: [2],
  },
  {
    id: "pop-punk-2000s",
    name: "Pop punk · años 2000",
    filters: { genresAny: ["punk"], yearFrom: 2000, yearTo: 2009, tagsAll: ["pop-punk"] },
    preferredRounds: [2],
  },
  {
    id: "latin-ballads-1990-2009",
    name: "Baladas latinas · 90s y 00s",
    filters: { genresAny: ["latin"], regionsAny: ["latin-america", "spain"], yearFrom: 1990, yearTo: 2009, tagsAll: ["ballad"] },
    preferredRounds: [2],
  },
  {
    id: "britpop-1990s",
    name: "Britpop · años 90",
    filters: { genresAny: ["rock", "pop"], regionsAny: ["uk"], yearFrom: 1990, yearTo: 1999, tagsAll: ["britpop"] },
    preferredRounds: [2],
  },
  {
    id: "spain-summer-songs",
    name: "Canciones españolas · de verano",
    filters: { regionsAny: ["spain"], tagsAll: ["summer"] },
    preferredRounds: [2],
  },
];

export const DEFAULT_TERRITORY_CATEGORIES = CORE_CATEGORIES.filter((category) =>
  category.preferredRounds?.includes(2)
).slice(0, 10);

export function categoryById(id: string): GameCategory | undefined {
  return CORE_CATEGORIES.find((category) => category.id === id);
}
