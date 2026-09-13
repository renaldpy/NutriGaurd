import type { Exa } from "exa-js";
import { logger } from "./logger.js";
import { withTimeout } from "./withTimeout.js";
import type { Recommendation } from "./types.js";

const MAX_ALLERGENS_SEARCHED = 3;
const RESULTS_PER_QUERY = 2;
const MAX_TOTAL_RESULTS = 6;
const TIMEOUT_MS = 5000;

const GENERIC_FALLBACK: Recommendation[] = [
  { title: "Vitamin D sources: salmon, fortified oat milk, mushrooms", url: "https://ods.od.nih.gov/factsheets/VitaminD-Consumer/" },
  { title: "Iron-rich foods safe for common allergies", url: "https://ods.od.nih.gov/factsheets/Iron-Consumer/" },
];

function fallbackFor(allergen: string): Recommendation[] {
  return [
    {
      title: `Dietary alternatives for a ${allergen} allergy (search unavailable)`,
      url: "https://ods.od.nih.gov/factsheets/list-all/",
    },
  ];
}

async function searchForAllergen(exa: Exa, allergen: string, vitaminPart: string): Promise<Recommendation[]> {
  const fallback = fallbackFor(allergen);
  const query = `foods high in ${vitaminPart} safe for someone allergic to ${allergen}`;

  const call = exa
    .searchAndContents(query, { type: "fast", numResults: RESULTS_PER_QUERY })
    .then((result) => {
      const recs = (result.results || [])
        .map((r: { title?: string | null; url: string }) => ({ title: r.title || r.url, url: r.url }))
        .filter((r: { url: string }) => r.url);
      return recs.length ? recs : fallback;
    })
    .catch((error: unknown) => {
      logger.error(`searchAlternatives: Exa call failed for allergen "${allergen}"`, error);
      return fallback;
    });

  return withTimeout(call, TIMEOUT_MS, fallback, `searchAlternatives(${allergen})`);
}

function dedupe(recommendations: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  return recommendations.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

export async function searchAlternatives(
  exa: Exa,
  allergens: string[],
  targetVitamins: string[]
): Promise<Recommendation[]> {
  const vitaminPart = targetVitamins.length ? targetVitamins.join(", ") : "general nutrition";
  const searchedAllergens = allergens.slice(0, MAX_ALLERGENS_SEARCHED);

  if (searchedAllergens.length === 0) {
    return searchForAllergen(exa, "no known allergens", vitaminPart);
  }

  const perAllergenResults = await Promise.all(
    searchedAllergens.map((allergen) => searchForAllergen(exa, allergen, vitaminPart))
  );

  const merged = dedupe(perAllergenResults.flat()).slice(0, MAX_TOTAL_RESULTS);
  return merged.length ? merged : GENERIC_FALLBACK;
}
