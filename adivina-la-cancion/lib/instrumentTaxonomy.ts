export type CanonicalInstrument =
  | "harmonica"
  | "saxophone"
  | "piano"
  | "violin"
  | "guitar"
  | "bass"
  | "drums"
  | "percussion"
  | "trumpet"
  | "trombone"
  | "flute"
  | "clarinet"
  | "cello"
  | "organ"
  | "synthesizer"
  | "accordion"
  | "banjo"
  | "mandolin"
  | "ukulele"
  | "harp";

const RULES: Array<{ instrument: CanonicalInstrument; patterns: RegExp[] }> = [
  { instrument: "harmonica", patterns: [/\bharmonica\b/i, /\bblues harp\b/i, /\bmouth harp\b/i] },
  { instrument: "saxophone", patterns: [/\bsaxophone\b/i, /\bsax\b/i] },
  { instrument: "piano", patterns: [/\bpiano\b/i, /\bgrand piano\b/i] },
  { instrument: "violin", patterns: [/\bviolin\b/i, /\bfiddle\b/i] },
  { instrument: "guitar", patterns: [/\bguitar\b/i] },
  { instrument: "bass", patterns: [/\bbass guitar\b/i, /\belectric bass\b/i, /\bdouble bass\b/i, /\bupright bass\b/i] },
  { instrument: "drums", patterns: [/\bdrums?\b/i, /\bdrum kit\b/i] },
  { instrument: "percussion", patterns: [/\bpercussion\b/i] },
  { instrument: "trumpet", patterns: [/\btrumpet\b/i, /\bcornet\b/i] },
  { instrument: "trombone", patterns: [/\btrombone\b/i] },
  { instrument: "flute", patterns: [/\bflute\b/i, /\bpiccolo\b/i] },
  { instrument: "clarinet", patterns: [/\bclarinet\b/i] },
  { instrument: "cello", patterns: [/\bcello\b/i, /\bvioloncello\b/i] },
  { instrument: "organ", patterns: [/\borgan\b/i, /\bhammond\b/i] },
  { instrument: "synthesizer", patterns: [/\bsynthesizer\b/i, /\bsynthesiser\b/i, /\bsynth\b/i] },
  { instrument: "accordion", patterns: [/\baccordion\b/i] },
  { instrument: "banjo", patterns: [/\bbanjo\b/i] },
  { instrument: "mandolin", patterns: [/\bmandolin\b/i] },
  { instrument: "ukulele", patterns: [/\bukulele\b/i] },
  { instrument: "harp", patterns: [/\bharp\b/i] },
];

export function canonicalInstrumentFromLabel(label: string): CanonicalInstrument | undefined {
  const clean = label.trim();
  if (!clean) return undefined;
  return RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(clean)))?.instrument;
}

export function supportedCanonicalInstruments(): CanonicalInstrument[] {
  return RULES.map((rule) => rule.instrument);
}
