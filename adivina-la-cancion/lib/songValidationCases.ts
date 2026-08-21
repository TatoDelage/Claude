export type SongValidationKind = "collaboration" | "cover" | "eurovision" | "soundtrack";

export type SongValidationCase = {
  id: string;
  kind: SongValidationKind;
  label: string;
  title: string;
  artist: string;
  expected: string;
};

export const SONG_VALIDATION_CASES: SongValidationCase[] = [
  {
    id: "collaboration-under-pressure",
    kind: "collaboration",
    label: "Colaboración",
    title: "Under Pressure",
    artist: "Queen",
    expected: "Spotify debe acreditar más de un artista",
  },
  {
    id: "cover-whitney",
    kind: "cover",
    label: "Cover",
    title: "I Will Always Love You",
    artist: "Whitney Houston",
    expected: "MusicBrainz debe marcar la relación recording→work como cover",
  },
  {
    id: "eurovision-euphoria",
    kind: "eurovision",
    label: "Eurovisión",
    title: "Euphoria",
    artist: "Loreen",
    expected: "Wikidata debe vincular la obra con Eurovision Song Contest 2012",
  },
  {
    id: "soundtrack-shallow",
    kind: "soundtrack",
    label: "Banda sonora",
    title: "Shallow",
    artist: "Lady Gaga",
    expected: "Wikidata debe vincular la obra con un lanzamiento de banda sonora",
  },
];
