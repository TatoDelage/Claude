export type MusicGenre =
  | "pop"
  | "rock"
  | "indie"
  | "reggaeton"
  | "latin"
  | "hip-hop"
  | "rnb"
  | "electronic"
  | "folk"
  | "punk"
  | "metal"
  | "flamenco"
  | "tropical"
  | "soundtrack"
  | "other";

export type MusicLanguage = "es" | "en" | "fr" | "it" | "pt" | "other";

export type MusicRegion =
  | "spain"
  | "latin-america"
  | "usa"
  | "uk"
  | "europe"
  | "global"
  | "other";

export type BaselineDifficulty = "easy" | "medium" | "hard" | "expert";

/**
 * Flexible labels for concepts that do not belong to one stable axis.
 * Examples: diva, summer, christmas, animation, one-hit-wonder, boyband.
 */
export type MusicTag = string;

export interface SongIdentity {
  title: string;
  artist: string;
}

/** Manual rounds can start with just title/artist and gain metadata later. */
export interface SongDraft extends SongIdentity {
  metadata?: Partial<SongMetadata>;
}

/** Canonical song shape for the future Music Engine/catalogue. */
export interface CatalogSong extends SongIdentity {
  id: string;
  metadata: SongMetadata;
  externalIds?: {
    spotify?: string;
    youtube?: string;
  };
}

export interface SongMetadata {
  genres: MusicGenre[];
  releaseYear?: number;
  languages: MusicLanguage[];
  regions: MusicRegion[];
  baselineDifficulty?: BaselineDifficulty;
  tags: MusicTag[];
}

export interface CategoryFilter {
  genresAny?: MusicGenre[];
  yearFrom?: number;
  yearTo?: number;
  languagesAny?: MusicLanguage[];
  regionsAny?: MusicRegion[];
  difficultiesAny?: BaselineDifficulty[];
  tagsAny?: MusicTag[];
  tagsAll?: MusicTag[];
}

/**
 * A game category is a reusable recipe over song metadata, not a hard-coded folder.
 * The same song can belong to many categories at once.
 */
export interface GameCategory {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  filters: CategoryFilter;
  /** Rounds where this recipe is especially useful. Empty/omitted means global. */
  preferredRounds?: number[];
}

function intersects<T>(left: T[], right: T[]): boolean {
  return left.some((value) => right.includes(value));
}

export function songMatchesCategory(song: SongDraft | CatalogSong, category: GameCategory): boolean {
  const metadata = song.metadata;
  if (!metadata) return false;

  const filter = category.filters;
  const genres = metadata.genres ?? [];
  const languages = metadata.languages ?? [];
  const regions = metadata.regions ?? [];
  const tags = metadata.tags ?? [];

  if (filter.genresAny?.length && !intersects(genres, filter.genresAny)) return false;
  if (filter.languagesAny?.length && !intersects(languages, filter.languagesAny)) return false;
  if (filter.regionsAny?.length && !intersects(regions, filter.regionsAny)) return false;
  if (filter.tagsAny?.length && !intersects(tags, filter.tagsAny)) return false;
  if (filter.tagsAll?.length && !filter.tagsAll.every((tag) => tags.includes(tag))) return false;

  if (filter.difficultiesAny?.length) {
    const difficulty = metadata.baselineDifficulty;
    if (!difficulty || !filter.difficultiesAny.includes(difficulty)) return false;
  }

  if (filter.yearFrom !== undefined) {
    if (metadata.releaseYear === undefined || metadata.releaseYear < filter.yearFrom) return false;
  }
  if (filter.yearTo !== undefined) {
    if (metadata.releaseYear === undefined || metadata.releaseYear > filter.yearTo) return false;
  }

  return true;
}

export function songsForCategory<T extends SongDraft | CatalogSong>(songs: T[], category: GameCategory): T[] {
  return songs.filter((song) => songMatchesCategory(song, category));
}
