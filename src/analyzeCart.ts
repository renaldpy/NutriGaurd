import "dotenv/config";
import "./env.js";
import OpenAI from "openai";
import { Exa } from "exa-js";
import { extractAllergens, extractAllergensFromReceiptImage } from "./extractAllergens.js";
import { scoreNutrition } from "./scoreNutrition.js";
import { searchAlternatives } from "./searchAlternatives.js";
import { checkAllergensWithExa } from "./checkAllergensWithExa.js";
import { parseAnalyzeCartInput } from "./validateInput.js";
import type { AnalyzeCartInput, AnalyzeCartResult } from "./types.js";

export type {
  AnalyzeCartInput,
  AnalyzeCartResult,
  CartItem,
  Recommendation,
  ReceiptImage,
  AllergenVerification,
} from "./types.js";

export type AnalyzeCartDeps = {
  openai: OpenAI;
  openrouter: OpenAI;
  exa: Exa;
  openrouterModel: string;
};

function defaultDeps(): AnalyzeCartDeps {
  return {
    openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    openrouter: new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    }),
    exa: new Exa(process.env.EXA_API_KEY),
    openrouterModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct",
  };
}

export async function analyzeCart(
  rawInput: unknown,
  deps: AnalyzeCartDeps = defaultDeps()
): Promise<AnalyzeCartResult> {
  const input: AnalyzeCartInput = parseAnalyzeCartInput(rawInput);
  const allergens = input.allergens ?? [];
  const targetVitamins = input.targetVitamins ?? [];

  const { items, warnings } = input.domText
    ? await extractAllergens(deps.openai, input.domText, allergens)
    : await extractAllergensFromReceiptImage(deps.openai, input.receiptImage!, allergens);

  const flaggedItemNames = items.filter((item) => item.flagged).map((item) => item.name);

  const [nutritionSummary, recommendations, allergenVerification] = await Promise.all([
    scoreNutrition(deps.openrouter, deps.openrouterModel, items, targetVitamins),
    searchAlternatives(deps.exa, allergens, targetVitamins),
    checkAllergensWithExa(deps.exa, flaggedItemNames, allergens),
  ]);

  return { items, warnings, nutritionSummary, recommendations, allergenVerification };
}
