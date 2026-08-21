const WDQS_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "AdivinaLaCancion/0.3 (https://claude-blue-tau.vercel.app)";

export type WikidataSongKnowledge = {
  id: string;
  languageCodes: string[];
  eurovision: boolean;
  soundtrackKinds: Array<"film" | "animation" | "series" | "musical">;
  sourceUrl: string;
};

type Binding = {
  languageCode?: { value: string };
  eurovision?: { value: string };
  soundtrackKind?: { value: string };
};

export async function getWikidataSongKnowledge(id: string): Promise<WikidataSongKnowledge> {
  if (!/^Q\d+$/i.test(id)) throw new Error("Wikidata ID inválido");
  const qid = id.toUpperCase();

  const query = `
    SELECT ?languageCode ?eurovision ?soundtrackKind WHERE {
      BIND(wd:${qid} AS ?item)

      OPTIONAL {
        ?item wdt:P407 ?language.
        OPTIONAL { ?language wdt:P218 ?languageCode. }
      }

      BIND(EXISTS {
        ?item wdt:P1344 ?event.
        ?event rdfs:label ?eventLabel.
        FILTER(LANG(?eventLabel) = "en")
        FILTER(CONTAINS(LCASE(STR(?eventLabel)), "eurovision song contest"))
      } AS ?eurovision)

      OPTIONAL {
        ?item wdt:P361 ?soundtrackRelease.
        ?soundtrackRelease wdt:P7937 ?soundtrackForm.
        VALUES ?soundtrackForm {
          wd:Q4176708 wd:Q65091986 wd:Q66049140 wd:Q60030240 wd:Q64547452
        }
        OPTIONAL {
          ?screenWork wdt:P406 ?soundtrackRelease.
          BIND(
            IF(EXISTS { ?screenWork wdt:P31/wdt:P279* wd:Q202866 }, "animation",
              IF(EXISTS { ?screenWork wdt:P31/wdt:P279* wd:Q11424 }, "film",
                IF(EXISTS { ?screenWork wdt:P31/wdt:P279* wd:Q5398426 }, "series",
                  IF(EXISTS { ?screenWork wdt:P31/wdt:P279* wd:Q2743 }, "musical", "")
                )
              )
            ) AS ?soundtrackKind
          )
        }
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
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Wikidata respondió ${response.status}`);

  const data = (await response.json()) as { results?: { bindings?: Binding[] } };
  const bindings = data.results?.bindings ?? [];

  const languageCodes = Array.from(new Set(
    bindings
      .map((binding) => binding.languageCode?.value?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  ));
  const soundtrackKinds = Array.from(new Set(
    bindings
      .map((binding) => binding.soundtrackKind?.value)
      .filter((value): value is "film" | "animation" | "series" | "musical" =>
        value === "film" || value === "animation" || value === "series" || value === "musical"),
  ));

  return {
    id: qid,
    languageCodes,
    eurovision: bindings.some((binding) => binding.eurovision?.value === "true"),
    soundtrackKinds,
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
  };
}
