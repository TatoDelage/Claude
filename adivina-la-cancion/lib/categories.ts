import { CategoryFilter, GameCategory } from "./content";

export type TerritoryFamily = "genre" | "geography" | "era" | "artist-type" | "universe";

export interface TerritoryCategory extends GameCategory {
  family: TerritoryFamily;
  /** Used only to keep a generated board varied. These are not song filters. */
  diversityTags: string[];
  weight?: number;
}

function territory(
  id: string,
  name: string,
  emoji: string,
  family: TerritoryFamily,
  filters: CategoryFilter,
  diversityTags: string[],
  description?: string,
): TerritoryCategory {
  return { id, name, emoji, family, filters, diversityTags, description, preferredRounds: [2], weight: 1 };
}

/**
 * Territorio must feel immediate: the player should understand the musical world in one glance.
 * Do not put puzzle-like conditions here (words in lyrics, instruments, member relationships, etc.).
 * Those belong to Cultura Musical.
 */
export const TERRITORY_CATALOG: TerritoryCategory[] = [
  // Géneros y escenas
  territory("rap-usa", "Rap estadounidense", "🎤", "genre", { genresAny: ["hip-hop"], regionsAny: ["usa"] }, ["hip-hop", "usa"]),
  territory("rock-spain", "Rock español", "🎸", "genre", { genresAny: ["rock"], regionsAny: ["spain"] }, ["rock", "spain"]),
  territory("reggaeton-classic", "Reggaetón clásico", "🔥", "genre", { genresAny: ["reggaeton"], yearTo: 2014 }, ["reggaeton", "pre-2015"]),
  territory("reggaeton-new", "Reggaetón actual", "🌴", "genre", { genresAny: ["reggaeton"], yearFrom: 2015 }, ["reggaeton", "2015+"]),
  territory("indie-spain", "Indie español", "🌙", "genre", { genresAny: ["indie"], regionsAny: ["spain"] }, ["indie", "spain"]),
  territory("latin-pop", "Pop latino", "☀️", "genre", { genresAny: ["pop", "latin"], regionsAny: ["latin-america", "spain"] }, ["pop", "latin"]),
  territory("rnb-2000s", "R&B de los 2000", "💿", "genre", { genresAny: ["rnb"], yearFrom: 2000, yearTo: 2009 }, ["rnb", "2000s"]),
  territory("pop-punk-2000s", "Pop punk de los 2000", "🤘", "genre", { genresAny: ["punk"], yearFrom: 2000, yearTo: 2009, tagsAll: ["pop-punk"] }, ["punk", "2000s"]),
  territory("heavy-metal", "Heavy metal", "🤘", "genre", { genresAny: ["metal"] }, ["metal"]),
  territory("flamenco-pop", "Flamenco pop", "💃", "genre", { genresAny: ["flamenco"], tagsAny: ["pop-flamenco", "flamenco-pop"] }, ["flamenco", "spain"]),
  territory("salsa", "Salsa", "🪇", "genre", { genresAny: ["salsa"] }, ["salsa", "latin"]),
  territory("bachata", "Bachata", "🌹", "genre", { genresAny: ["bachata"] }, ["bachata", "latin"]),
  territory("country-usa", "Country estadounidense", "🤠", "genre", { genresAny: ["country"], regionsAny: ["usa"] }, ["country", "usa"]),
  territory("edm-2010s", "Electrónica de los 2010", "⚡", "genre", { genresAny: ["electronic", "dance"], yearFrom: 2010, yearTo: 2019 }, ["electronic", "2010s"]),
  territory("disco-classics", "Clásicos disco", "🪩", "genre", { genresAny: ["disco"], yearFrom: 1970, yearTo: 1989 }, ["disco", "70s-80s"]),
  territory("indie-folk", "Indie folk", "🪕", "genre", { genresAny: ["folk"], tagsAny: ["indie-folk"] }, ["folk", "indie"]),
  territory("alternative-90s", "Rock alternativo de los 90", "📼", "genre", { genresAny: ["rock"], yearFrom: 1990, yearTo: 1999, tagsAny: ["alternative"] }, ["rock", "90s"]),
  territory("latin-trap", "Trap latino", "🖤", "genre", { genresAny: ["hip-hop", "latin"], tagsAny: ["latin-trap"] }, ["hip-hop", "latin", "trap"]),
  territory("kpop", "K-pop", "✨", "genre", { genresAny: ["k-pop"], regionsAny: ["south-korea"] }, ["k-pop", "asia"]),
  territory("jpop", "J-pop", "🌸", "genre", { genresAny: ["j-pop"], regionsAny: ["japan"] }, ["j-pop", "asia"]),

  // Países y mercados
  territory("pop-spain", "Pop español", "🇪🇸", "geography", { genresAny: ["pop"], regionsAny: ["spain"] }, ["pop", "spain"]),
  territory("pop-mexico", "Pop mexicano", "🇲🇽", "geography", { genresAny: ["pop", "latin"], regionsAny: ["mexico"] }, ["pop", "mexico"]),
  territory("rock-argentina", "Rock argentino", "🇦🇷", "geography", { genresAny: ["rock"], regionsAny: ["argentina"] }, ["rock", "argentina"]),
  territory("pop-colombia", "Pop colombiano", "🇨🇴", "geography", { genresAny: ["pop", "latin"], regionsAny: ["colombia"] }, ["pop", "colombia"]),
  territory("urbano-puerto-rico", "Urbano puertorriqueño", "🇵🇷", "geography", { genresAny: ["reggaeton", "hip-hop"], regionsAny: ["puerto-rico"] }, ["urban", "puerto-rico"]),
  territory("pop-uk", "Pop británico", "🇬🇧", "geography", { genresAny: ["pop"], regionsAny: ["uk"] }, ["pop", "uk"]),
  territory("rock-uk", "Rock británico", "🇬🇧", "geography", { genresAny: ["rock"], regionsAny: ["uk"] }, ["rock", "uk"]),
  territory("pop-france", "Pop francés", "🇫🇷", "geography", { genresAny: ["pop"], regionsAny: ["france"], languagesAny: ["fr"] }, ["pop", "france"]),
  territory("pop-italy", "Pop italiano", "🇮🇹", "geography", { genresAny: ["pop"], regionsAny: ["italy"], languagesAny: ["it"] }, ["pop", "italy"]),
  territory("pop-sweden", "Pop sueco", "🇸🇪", "geography", { genresAny: ["pop"], regionsAny: ["sweden"] }, ["pop", "sweden"]),

  // Épocas
  territory("hits-70s", "Hits de los 70", "🕺", "era", { yearFrom: 1970, yearTo: 1979 }, ["70s"]),
  territory("hits-80s", "Hits de los 80", "📻", "era", { yearFrom: 1980, yearTo: 1989 }, ["80s"]),
  territory("hits-90s", "Hits de los 90", "📼", "era", { yearFrom: 1990, yearTo: 1999 }, ["90s"]),
  territory("hits-2000s", "Hits de los 2000", "💿", "era", { yearFrom: 2000, yearTo: 2009 }, ["2000s"]),
  territory("hits-2010s", "Hits de los 2010", "📱", "era", { yearFrom: 2010, yearTo: 2019 }, ["2010s"]),
  territory("hits-2020s", "Hits de los 2020", "🚀", "era", { yearFrom: 2020, yearTo: 2029 }, ["2020s"]),

  // Tipo de artista
  territory("pop-divas", "Divas del pop", "👑", "artist-type", { genresAny: ["pop"], tagsAll: ["diva"] }, ["pop", "diva"]),
  territory("boybands", "Boybands", "🕺", "artist-type", { tagsAll: ["boyband"] }, ["group", "boyband"]),
  territory("girl-groups", "Girl groups", "💅", "artist-type", { tagsAll: ["girl-group"] }, ["group", "girl-group"]),
  territory("duos", "Dúos musicales", "👯", "artist-type", { tagsAll: ["duo"] }, ["duo"]),
  territory("one-hit-wonders", "One-hit wonders", "🎯", "artist-type", { tagsAll: ["one-hit-wonder"] }, ["one-hit-wonder"]),

  // Universos muy reconocibles
  territory("disney", "Canciones Disney", "🏰", "universe", { genresAny: ["soundtrack"], tagsAll: ["disney"] }, ["soundtrack", "disney"]),
  territory("animation", "Bandas sonoras de animación", "🎬", "universe", { genresAny: ["soundtrack"], tagsAll: ["animation"] }, ["soundtrack", "animation"]),
  territory("film-soundtracks", "Bandas sonoras de cine", "🍿", "universe", { genresAny: ["soundtrack"], tagsAll: ["film"] }, ["soundtrack", "film"]),
  territory("tv-soundtracks", "Canciones de series", "📺", "universe", { genresAny: ["soundtrack"], tagsAll: ["tv"] }, ["soundtrack", "tv"]),
  territory("eurovision", "Eurovisión", "🌍", "universe", { tagsAll: ["eurovision"] }, ["eurovision"]),
  territory("musicals", "Musicales", "🎭", "universe", { genresAny: ["soundtrack"], tagsAll: ["musical"] }, ["soundtrack", "musical"]),
  territory("summer", "Canciones del verano", "☀️", "universe", { tagsAll: ["summer"] }, ["summer"]),
  territory("christmas", "Canciones de Navidad", "🎄", "universe", { tagsAll: ["christmas"] }, ["christmas"]),
  territory("karaoke", "Clásicos de karaoke", "🎙️", "universe", { tagsAll: ["karaoke-classic"] }, ["karaoke"]),
  territory("party-anthems", "Himnos de fiesta", "🥳", "universe", { tagsAll: ["party-anthem"] }, ["party"]),
  territory("ballads", "Grandes baladas", "❤️", "universe", { tagsAll: ["ballad"] }, ["ballad"]),
];

/** Curated board used while Territorio is still manual. */
export const DEFAULT_TERRITORY_IDS = [
  "rap-usa",
  "rock-spain",
  "reggaeton-classic",
  "pop-divas",
  "indie-spain",
  "disney",
  "hits-2000s",
  "rock-argentina",
  "latin-pop",
  "boybands",
] as const;

export const DEFAULT_TERRITORY_CATEGORIES = DEFAULT_TERRITORY_IDS.map((id) =>
  TERRITORY_CATALOG.find((category) => category.id === id),
).filter((category): category is TerritoryCategory => Boolean(category));

export function categoryById(id: string): TerritoryCategory | undefined {
  return TERRITORY_CATALOG.find((category) => category.id === id);
}

/**
 * Greedy diversity selector for the future Music Engine.
 * It penalises repeated families and concepts so a board does not become
 * "rock español / pop español / indie español / hits españoles...".
 */
export function selectTerritories(
  count = 10,
  pool: TerritoryCategory[] = TERRITORY_CATALOG,
  random: () => number = Math.random,
): TerritoryCategory[] {
  const available = [...pool];
  const selected: TerritoryCategory[] = [];

  while (selected.length < count && available.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    available.forEach((candidate, index) => {
      const sameFamily = selected.filter((item) => item.family === candidate.family).length;
      if (sameFamily >= 3) return;

      const sharedTags = selected.reduce(
        (sum, item) => sum + candidate.diversityTags.filter((tag) => item.diversityTags.includes(tag)).length,
        0,
      );
      const score = (candidate.weight ?? 1) * 100 - sameFamily * 16 - sharedTags * 24 + random() * 10;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    selected.push(available.splice(bestIndex, 1)[0]);
  }

  return selected;
}
