import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { CART_ANALYSIS_SCHEMA, CART_ANALYSIS_SYSTEM_PROMPT } from "./cartSchema.js";
import { logger } from "./logger.js";
import { withTimeout } from "./withTimeout.js";
import type { CartItem } from "./types.js";

const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 8000;

const FALLBACK: { items: CartItem[]; warnings: string[] } = {
  items: [{ name: "Unable to parse cart", flagged: false }],
  warnings: ["Extraction unavailable — showing fallback data."],
};

type RawCartAnalysis = {
  items?: { name: string; flagged: boolean; reason: string | null }[];
  warnings?: string[];
};

function toResult(raw: RawCartAnalysis): { items: CartItem[]; warnings: string[] } {
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => ({
        name: item.name,
        flagged: item.flagged,
        reason: item.reason ?? undefined,
      }))
    : FALLBACK.items;

  return {
    items,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

async function runExtraction(
  openai: OpenAI,
  allergens: string[],
  content: string | ChatCompletionContentPart[]
): Promise<{ items: CartItem[]; warnings: string[] }> {
  const call = openai.chat.completions
    .create({
      model: MODEL,
      response_format: { type: "json_schema", json_schema: CART_ANALYSIS_SCHEMA },
      messages: [
        {
          role: "system",
          content: `${CART_ANALYSIS_SYSTEM_PROMPT}\n\nFamily allergens: ${allergens.join(", ") || "none"}`,
        },
        { role: "user", content },
      ],
    })
    .then((completion) => {
      const raw = completion.choices[0]?.message?.content;
      if (!raw) return FALLBACK;
      return toResult(JSON.parse(raw) as RawCartAnalysis);
    })
    .catch((error: unknown) => {
      logger.error("extractAllergens: OpenAI call failed", error);
      return FALLBACK;
    });

  return withTimeout(call, TIMEOUT_MS, FALLBACK, "extractAllergens");
}

export function extractAllergens(
  openai: OpenAI,
  domText: string,
  allergens: string[]
): Promise<{ items: CartItem[]; warnings: string[] }> {
  return runExtraction(openai, allergens, `Checkout page text:\n${domText.slice(0, 5000)}`);
}

export function extractAllergensFromReceiptImage(
  openai: OpenAI,
  receiptImage: { base64: string; mimeType: string },
  allergens: string[]
): Promise<{ items: CartItem[]; warnings: string[] }> {
  const content: ChatCompletionContentPart[] = [
    { type: "text", text: "Extract the grocery items visible in this receipt photo." },
    {
      type: "image_url",
      image_url: { url: `data:${receiptImage.mimeType};base64,${receiptImage.base64}` },
    },
  ];

  return runExtraction(openai, allergens, content);
}
