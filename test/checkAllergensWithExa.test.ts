import { test } from "node:test";
import assert from "node:assert/strict";
import type { Exa } from "exa-js";
import { checkAllergensWithExa } from "../src/checkAllergensWithExa.js";

function fakeExa(answer: unknown, citations: { url: string }[] = []): Exa {
  return {
    answer: async () => ({ answer, citations, requestId: "test" }),
  } as unknown as Exa;
}

function fakeExaThatThrows(): Exa {
  return {
    answer: async () => {
      throw new Error("simulated Exa answer failure");
    },
  } as unknown as Exa;
}

test("checkAllergensWithExa returns verified items and batch-level citations on success", async () => {
  const exa = fakeExa(
    {
      items: [
        { name: "Peanut Butter", containsAllergen: true, allergen: "peanuts" },
        { name: "Salmon Fillet", containsAllergen: false, allergen: null },
      ],
    },
    [{ url: "https://example.com/allergen-db" }, { url: "https://example.com/salmon-facts" }]
  );

  const result = await checkAllergensWithExa(exa, ["Peanut Butter", "Salmon Fillet"], ["peanuts"]);

  assert.deepEqual(result.items, [
    { name: "Peanut Butter", containsAllergen: true, allergen: "peanuts" },
    { name: "Salmon Fillet", containsAllergen: false, allergen: null },
  ]);
  assert.deepEqual(result.citations, ["https://example.com/allergen-db", "https://example.com/salmon-facts"]);
});

test("checkAllergensWithExa falls back to unverified (false/null) items when the answer is not an object", async () => {
  const exa = fakeExa("I'm not sure, sorry.");

  const result = await checkAllergensWithExa(exa, ["Mystery Item"], ["peanuts"]);

  assert.deepEqual(result, { items: [{ name: "Mystery Item", containsAllergen: false, allergen: null }], citations: [] });
});

test("checkAllergensWithExa falls back when the API call throws", async () => {
  const exa = fakeExaThatThrows();

  const result = await checkAllergensWithExa(exa, ["Peanut Butter"], ["peanuts"]);

  assert.deepEqual(result, { items: [{ name: "Peanut Butter", containsAllergen: false, allergen: null }], citations: [] });
});

test("checkAllergensWithExa returns an empty result when there are no items or no allergens", async () => {
  const exa = fakeExa({ items: [] });

  assert.deepEqual(await checkAllergensWithExa(exa, [], ["peanuts"]), { items: [], citations: [] });
  assert.deepEqual(await checkAllergensWithExa(exa, ["Bread"], []), { items: [], citations: [] });
});
