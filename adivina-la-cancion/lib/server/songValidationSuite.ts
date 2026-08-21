import { searchSpotifyTracks, type SpotifyTrackCandidate } from "./spotifyCatalog";
import { ingestSpotifyTrackById } from "./musicIngestion";
import { runSongEnrichment } from "./songEnrichmentState";

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

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickExactCandidate(test: SongValidationCase, candidates: SpotifyTrackCandidate[]) {
  const title = normalize(test.title);
  const expectedArtist = normalize(test.artist);
  const exact = candidates.find((candidate) =>
    normalize(candidate.title) === title &&
    candidate.artists.some((artist) => normalize(artist.name) === expectedArtist),
  );
  if (!exact) {
    const summary = candidates.slice(0, 3).map((candidate) =>
      `${candidate.title} · ${candidate.artists.map((artist) => artist.name).join(", ")}`,
    ).join(" | ");
    throw new Error(`Spotify no devolvió una coincidencia exacta. Candidatos: ${summary || "ninguno"}`);
  }
  return exact;
}

function evaluate(kind: SongValidationKind, result: Awaited<ReturnType<typeof runSongEnrichment>>["result"]) {
  if (!result) return { passed: false, actual: "Sin resultado de enriquecimiento" };
  switch (kind) {
    case "collaboration":
      return {
        passed: result.isCollaboration,
        actual: result.isCollaboration ? "Colaboración verificada" : "No se detectó colaboración",
      };
    case "cover":
      return {
        passed: result.isCover,
        actual: result.isCover ? "Cover verificado" : "No se detectó cover",
      };
    case "eurovision":
      return {
        passed: result.eurovision,
        actual: result.eurovision ? "Eurovisión verificado" : "No se detectó Eurovisión",
      };
    case "soundtrack":
      return {
        passed: result.soundtrackKinds.length > 0,
        actual: result.soundtrackKinds.length
          ? `Banda sonora verificada: ${result.soundtrackKinds.join(", ")}`
          : "No se detectó banda sonora",
      };
  }
}

export async function runSongValidationCase(testId: string) {
  const test = SONG_VALIDATION_CASES.find((item) => item.id === testId);
  if (!test) throw new Error("Caso de validación desconocido");

  const candidates = await searchSpotifyTracks(test.title, test.artist);
  const candidate = pickExactCandidate(test, candidates);
  const imported = await ingestSpotifyTrackById(candidate.spotifyId);
  const state = await runSongEnrichment(imported.songId);
  const evaluation = evaluate(test.kind, state.result);

  return {
    test,
    passed: evaluation.passed,
    actual: evaluation.actual,
    songId: imported.songId,
    spotifyId: candidate.spotifyId,
    title: candidate.title,
    artists: candidate.artists.map((artist) => artist.name),
    enrichmentStatus: state.status,
    result: state.result,
  };
}
