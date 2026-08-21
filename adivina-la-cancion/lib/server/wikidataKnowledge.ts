const WDQS_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "AdivinaLaCancion/0.1 (https://github.com/TatoDelage/Claude)";

export type WikidataArtistKnowledge = {
  id: string;
  isMusicalGroup: boolean;
  isHuman: boolean;
  countryCodes: string[];
  sourceUrl: string;
};

type SparqlBinding = {
  isMusicalGroup?: { value: string };
  isHuman?: { value: string };
  countryCode?: { value: string };
};

export async function getWikidataArtistKnowledge(id: string): Promise<WikidataArtistKnowledge> {
  if (!/^Q\d+$/i.test(id)) throw new Error("Wikidata ID inválido");
  const qid = id.toUpperCase();
  const query = `
    SELECT ?isMusicalGroup ?isHuman ?countryCode WHERE {
      BIND(wd:${qid} AS ?item)
      BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q215380 } AS ?isMusicalGroup)
      BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q5 } AS ?isHuman)
      OPTIONAL {
        ?item wdt:P495 ?country.
        OPTIONAL { ?country wdt:P297 ?countryCode. }
      }
    }
  `;
  const params = new URLSearchParams({ query, format: "json" });
  const response = await fetch(`${WDQS_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Wikidata respondió ${response.status}`);

  const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
  const bindings = data.results?.bindings ?? [];
  const first = bindings[0];
  const countryCodes = Array.from(
    new Set(bindings.map((binding) => binding.countryCode?.value?.toUpperCase()).filter((value): value is string => Boolean(value))),
  );

  return {
    id: qid,
    isMusicalGroup: first?.isMusicalGroup?.value === "true",
    isHuman: first?.isHuman?.value === "true",
    countryCodes,
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
  };
}
