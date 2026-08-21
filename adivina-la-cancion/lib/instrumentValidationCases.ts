import type { CanonicalInstrument } from "./instrumentTaxonomy";

export type InstrumentValidationCase = {
  id: string;
  label: string;
  title: string;
  artist: string;
  expectedInstrument: CanonicalInstrument;
  expectedLabel: string;
};

export const INSTRUMENT_VALIDATION_CASES: InstrumentValidationCase[] = [
  {
    id: "harmonica-piano-man",
    label: "Armónica",
    title: "Piano Man",
    artist: "Billy Joel",
    expectedInstrument: "harmonica",
    expectedLabel: "MusicBrainz debería acreditar armónica en la grabación",
  },
  {
    id: "saxophone-baker-street",
    label: "Saxofón",
    title: "Baker Street",
    artist: "Gerry Rafferty",
    expectedInstrument: "saxophone",
    expectedLabel: "MusicBrainz debería acreditar saxofón en la grabación",
  },
  {
    id: "piano-your-song",
    label: "Piano",
    title: "Your Song",
    artist: "Elton John",
    expectedInstrument: "piano",
    expectedLabel: "MusicBrainz debería acreditar piano en la grabación",
  },
  {
    id: "violin-devil-georgia",
    label: "Violín / fiddle",
    title: "The Devil Went Down to Georgia",
    artist: "The Charlie Daniels Band",
    expectedInstrument: "violin",
    expectedLabel: "MusicBrainz debería acreditar fiddle o violín en la grabación",
  },
  {
    id: "guitar-sweet-child",
    label: "Guitarra",
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    expectedInstrument: "guitar",
    expectedLabel: "MusicBrainz debería acreditar guitarra en la grabación",
  },
];
