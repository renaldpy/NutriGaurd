import type { Exa } from "exa-js";
import { logger } from "./logger.js";
import { withTimeout } from "./withTimeout.js";
import type { AllergenVerificationResult } from "./types.js";

const TIMEOUT_MS = 8000;

// Exa's /answer endpoint: a grounded, citation-backed answer with structured output.
// Used here (rather than /search) because this is a fact-lookup question ("does X
// contain Y allergen, per real sources") that Exa can answer end-to-end in one call —
// not a broad retrieval task we need to rank or extract from ourselves.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          containsAllergen: { type: "boolean" },
          allergen: { type: ["string", "null"] },
        },
        required: ["name", "containsAllergen", "allergen"],
      },
    },
  },
  required: ["items"],
};

const SYSTEM_PROMPT =
  "Answer only from verifiable ingredient/allergen information on the cited sources. " +
  "Never guess: if an item's allergen content cannot be confirmed from a source, set " +
  "containsAllergen to false and allergen to null rather than assuming.";

function fallback(items: string[]): AllergenVerificationResult {
  return {
    items: items.map((name) => ({ name, containsAllergen: false, allergen: null })),
    citations: [],
  };
}

type RawAnswer = {
  items?: { name: string; containsAllergen: boolean; allergen: string | null }[];
};

export async function checkAllergensWithExa(
  exa: Exa,
  items: string[],
  allergens: string[]
): Promise<AllergenVerificationResult> {
  const emptyResult: AllergenVerificationResult = { items: [], citations: [] };
  if (items.length === 0 || allergens.length === 0) return emptyResult;

  const query = `For each of these grocery items — ${items.join(", ")} — does it commonly contain any of these allergens: ${allergens.join(", ")}? Cite your sources.`;
  const fallbackResult = fallback(items);

  const call = exa
    .answer(query, { systemPrompt: SYSTEM_PROMPT, outputSchema: OUTPUT_SCHEMA })
    .then((response) => {
      if (typeof response.answer !== "object" || response.answer === null) return fallbackResult;

      const parsed = response.answer as RawAnswer;
      if (!Array.isArray(parsed.items)) return fallbackResult;

      // Exa's /answer returns one shared citations list for the whole response, not a
      // per-item mapping — attaching a single citation to every item would misattribute
      // sources, so citations are surfaced once at the batch level instead.
      const citations = (response.citations || []).map((c) => c.url).filter((url): url is string => Boolean(url));
      return { items: parsed.items, citations };
    })
    .catch((error: unknown) => {
      logger.error("checkAllergensWithExa: Exa answer call failed", error);
      return fallbackResult;
    });

  return withTimeout(call, TIMEOUT_MS, fallbackResult, "checkAllergensWithExa");
}
