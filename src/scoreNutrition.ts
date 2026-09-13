import OpenAI from "openai";
import { logger } from "./logger.js";
import { withTimeout } from "./withTimeout.js";
import type { CartItem } from "./types.js";

const TIMEOUT_MS = 8000;
const FALLBACK_SUMMARY = "Nutrition scoring unavailable right now.";

export function scoreNutrition(
  openrouter: OpenAI,
  model: string,
  items: CartItem[],
  targetVitamins: string[]
): Promise<string> {
  const call = openrouter.chat.completions
    .create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition assistant. Given a family's grocery items and their target " +
            "vitamins/macros, write ONE short friendly sentence identifying the biggest gap " +
            "(e.g. low in Vitamin D, high in sodium). Plain text only, no JSON.",
        },
        {
          role: "user",
          content: `Target vitamins/macros: ${targetVitamins.join(", ") || "general balance"}\n\nItems: ${items
            .map((i) => i.name)
            .join(", ")}`,
        },
      ],
    })
    .then((completion) => completion.choices[0]?.message?.content?.trim() || FALLBACK_SUMMARY)
    .catch((error: unknown) => {
      logger.error("scoreNutrition: OpenRouter call failed", error);
      return FALLBACK_SUMMARY;
    });

  return withTimeout(call, TIMEOUT_MS, FALLBACK_SUMMARY, "scoreNutrition");
}
