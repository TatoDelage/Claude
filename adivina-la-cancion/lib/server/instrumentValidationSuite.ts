import { INSTRUMENT_VALIDATION_CASES } from "../instrumentValidationCases";
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

function pickExactCandidate(
  title: string,
  artist: string,
  candidates: SpotifyTrackCandidate[],
) {
  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(artist);
  const exact = candidates.find((candidate) =>
    normalize(candidate.title) === normalizedTitle &&
    candidate.artists.some((item) => normalize(item.name) === normalizedArtist),
  );

  if (!exact) {
    const summary = candidates.slice(0, 3).map((candidate) =>
      `${candidate.title} · ${candidate.artists.map((item) => item.name).join(", ")}`,
    ).join(" | ");
    throw new Error(`Spotify no devolvió coincidencia exacta. Candidatos: ${summary || "ninguno"}`);
  }

  return exact;
}

export async function runInstrumentValidationCase(testId: string) {
  const test = INSTRUMENT_VALIDATION_CASES.find((item) => item.id === testId);
  if (!test) throw new Error("Caso de instrumentación desconocido");

  const candidates = await searchSpotifyTracks(test.title, test.artist);
  const candidate = pickExactCandidate(test.title, test.artist, candidates);
  const imported = await ingestSpotifyTrackById(candidate.spotifyId);
  const state = await runSongEnrichment(imported.songId);
  const detected = state.result?.instrumentCodes ?? [];
  const passed = detected.includes(test.expectedInstrument);

  return {
    test,
    passed,
    songId: imported.songId,
    spotifyId: candidate.spotifyId,
    title: candidate.title,
    artists: candidate.artists.map((item) => item.name),
    enrichmentStatus: state.status,
    detectedInstruments: detected,
    sources: state.result?.sources ?? [],
    warnings: state.result?.warnings ?? [],
    actual: passed
      ? `${test.label} verificado por crédito de grabación`
      : detected.length
        ? `No se detectó ${test.label.toLowerCase()}. Sí aparecen: ${detected.join(", ")}`
        : `MusicBrainz no devolvió instrumentos canónicos para esta grabación`,
  };
}
