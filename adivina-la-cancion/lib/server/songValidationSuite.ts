import { SONG_VALIDATION_CASES, type SongValidationCase, type SongValidationKind } from "../songValidationCases";
import { searchSpotifyTracks, type SpotifyTrackCandidate } from "./spotifyCatalog";
import { ingestSpotifyTrackById } from "./musicIngestion";
import { runSongEnrichment } from "./songEnrichmentState";

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
