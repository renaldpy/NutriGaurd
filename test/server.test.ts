import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.OPENAI_API_KEY ??= "test-key";
process.env.OPENROUTER_API_KEY ??= "test-key";
process.env.EXA_API_KEY ??= "test-key";

const { createServer } = await import("../src/server.js");
type AnalyzeCartDeps = Parameters<typeof createServer>[0];

function fakeDeps(): NonNullable<AnalyzeCartDeps> {
  const openai = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [{ name: "Peanut Butter", flagged: true, reason: "contains peanuts" }],
                  warnings: ["Cart contains peanuts"],
                }),
              },
            },
          ],
        }),
      },
    },
  } as unknown as NonNullable<AnalyzeCartDeps>["openai"];

  const openrouter = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: "Low in Vitamin D." } }] }) } },
  } as unknown as NonNullable<AnalyzeCartDeps>["openrouter"];

  const exa = {
    searchAndContents: async () => ({ results: [{ title: "Salmon", url: "https://example.com/salmon" }] }),
    answer: async () => ({
      answer: { items: [{ name: "Peanut Butter", containsAllergen: true, allergen: "peanuts" }] },
      citations: [{ url: "https://example.com/allergen-db" }],
    }),
  } as unknown as NonNullable<AnalyzeCartDeps>["exa"];

  return { openai, openrouter, exa, openrouterModel: "meta-llama/llama-3.1-8b-instruct" };
}

async function withTestServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(fakeDeps()).listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("POST /api/analyze-checkout returns the analyzeCart result for valid input", async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/analyze-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domText: "Cart: Peanut Butter x1", allergens: ["peanuts"] }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: { name: string }[]; nutritionSummary: string };
    assert.equal(body.items[0]?.name, "Peanut Butter");
    assert.equal(body.nutritionSummary, "Low in Vitamin D.");
  });
});

test("POST /api/analyze-checkout returns 400 for input missing both domText and receiptImage", async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/analyze-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allergens: [] }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
  });
});
