import { test } from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { scoreNutrition } from "../src/scoreNutrition.js";

function fakeOpenRouter(content: string | undefined): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  } as unknown as OpenAI;
}

function fakeOpenRouterThatThrows(): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => {
          throw new Error("simulated OpenRouter failure");
        },
      },
    },
  } as unknown as OpenAI;
}

test("scoreNutrition returns the trimmed model response on success", async () => {
  const openrouter = fakeOpenRouter("  Low in Vitamin D.  ");

  const result = await scoreNutrition(openrouter, "meta-llama/llama-3.1-8b-instruct", [], ["Vitamin D"]);

  assert.equal(result, "Low in Vitamin D.");
});

test("scoreNutrition falls back to a canned summary when content is empty", async () => {
  const openrouter = fakeOpenRouter(undefined);

  const result = await scoreNutrition(openrouter, "meta-llama/llama-3.1-8b-instruct", [], []);

  assert.equal(result, "Nutrition scoring unavailable right now.");
});

test("scoreNutrition falls back to a canned summary when the API call throws", async () => {
  const openrouter = fakeOpenRouterThatThrows();

  const result = await scoreNutrition(openrouter, "meta-llama/llama-3.1-8b-instruct", [], []);

  assert.equal(result, "Nutrition scoring unavailable right now.");
});
