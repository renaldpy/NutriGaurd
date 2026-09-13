import { test } from "node:test";
import assert from "node:assert/strict";
import type { AnalyzeCartDeps } from "../src/analyzeCart.js";

process.env.OPENAI_API_KEY ??= "test-key";
process.env.OPENROUTER_API_KEY ??= "test-key";
process.env.EXA_API_KEY ??= "test-key";

const { analyzeCart } = await import("../src/analyzeCart.js");

function buildDeps(overrides: { extractionContent?: string; nutritionContent?: string; exaResults?: unknown[] }): AnalyzeCartDeps {
  const extractionContent =
    overrides.extractionContent ??
    JSON.stringify({
      items: [{ name: "Peanut Butter", flagged: true, reason: "contains peanuts" }],
      warnings: ["Cart contains peanuts"],
    });

  const openai = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: extractionContent } }] }) } },
  } as unknown as AnalyzeCartDeps["openai"];

  const openrouter = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: overrides.nutritionContent ?? "Low in Vitamin D." } }] }),
      },
    },
  } as unknown as AnalyzeCartDeps["openrouter"];

  const exa = {
    searchAndContents: async () => ({
      results: overrides.exaResults ?? [{ title: "Salmon", url: "https://example.com/salmon" }],
    }),
    answer: async () => ({
      answer: { items: [{ name: "Peanut Butter", containsAllergen: true, allergen: "peanuts" }] },
      citations: [{ url: "https://example.com/allergen-db" }],
    }),
  } as unknown as AnalyzeCartDeps["exa"];

  return { openai, openrouter, exa, openrouterModel: "meta-llama/llama-3.1-8b-instruct" };
}

test("analyzeCart merges extraction, nutrition, and recommendation results", async () => {
  const deps = buildDeps({});

  const result = await analyzeCart({ domText: "Cart: Peanut Butter x1", allergens: ["peanuts"] }, deps);

  assert.deepEqual(result.items, [{ name: "Peanut Butter", flagged: true, reason: "contains peanuts" }]);
  assert.deepEqual(result.warnings, ["Cart contains peanuts"]);
  assert.equal(result.nutritionSummary, "Low in Vitamin D.");
  assert.equal(result.recommendations[0]?.url, "https://example.com/salmon");
  assert.deepEqual(result.allergenVerification.items, [
    { name: "Peanut Butter", containsAllergen: true, allergen: "peanuts" },
  ]);
  assert.deepEqual(result.allergenVerification.citations, ["https://example.com/allergen-db"]);
});

test("analyzeCart rejects input with neither domText nor receiptImage", async () => {
  const deps = buildDeps({});

  await assert.rejects(() => analyzeCart({ allergens: [] }, deps), /requires either domText or receiptImage/);
});

test("analyzeCart routes to the receipt-image extraction path when domText is absent", async () => {
  let sawImageContent = false;
  const imageAwareOpenAI = {
    chat: {
      completions: {
        create: async (params: { messages: { role: string; content: unknown }[] }) => {
          const userMessage = params.messages.find((m) => m.role === "user");
          sawImageContent = Array.isArray(userMessage?.content) &&
            (userMessage!.content as { type: string }[]).some((part) => part.type === "image_url");
          return {
            choices: [{ message: { content: JSON.stringify({ items: [], warnings: [] }) } }],
          };
        },
      },
    },
  } as unknown as AnalyzeCartDeps["openai"];
  const deps = { ...buildDeps({}), openai: imageAwareOpenAI };

  await analyzeCart({ receiptImage: { base64: "ZmFrZQ==", mimeType: "image/jpeg" }, allergens: [] }, deps);

  assert.equal(sawImageContent, true);
});
