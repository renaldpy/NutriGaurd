import { test } from "node:test";
import assert from "node:assert/strict";
import type { Exa } from "exa-js";
import { searchAlternatives } from "../src/searchAlternatives.js";

function fakeExa(byQuery: (query: string) => { results: { title: string; url: string }[] }): Exa {
  return {
    searchAndContents: async (query: string) => byQuery(query),
  } as unknown as Exa;
}

function fakeExaThatThrows(): Exa {
  return {
    searchAndContents: async () => {
      throw new Error("simulated Exa failure");
    },
  } as unknown as Exa;
}

test("searchAlternatives runs one query per allergen and merges results", async () => {
  const exa = fakeExa((query) => ({
    results: [{ title: `result for: ${query}`, url: `https://example.com/${encodeURIComponent(query)}` }],
  }));

  const result = await searchAlternatives(exa, ["peanuts", "shellfish"], ["Vitamin D"]);

  assert.equal(result.length, 2);
  assert.ok(result.some((r) => r.title.includes("peanuts")));
  assert.ok(result.some((r) => r.title.includes("shellfish")));
});

test("searchAlternatives caps allergen fan-out at 3 queries", async () => {
  const queried: string[] = [];
  const exa = fakeExa((query) => {
    queried.push(query);
    return { results: [{ title: query, url: `https://example.com/${queried.length}` }] };
  });

  await searchAlternatives(exa, ["a", "b", "c", "d", "e"], []);

  assert.equal(queried.length, 3);
});

test("searchAlternatives dedupes identical URLs across allergen queries", async () => {
  const exa = fakeExa(() => ({
    results: [{ title: "Same result", url: "https://example.com/shared" }],
  }));

  const result = await searchAlternatives(exa, ["peanuts", "shellfish"], []);

  assert.equal(result.length, 1);
});

test("searchAlternatives falls back per-allergen when a query throws", async () => {
  const exa = fakeExaThatThrows();

  const result = await searchAlternatives(exa, ["peanuts"], ["Vitamin D"]);

  assert.equal(result.length, 1);
  assert.ok(result[0]?.title.includes("peanuts"));
});

test("searchAlternatives handles an empty allergen list with a single generic query", async () => {
  const exa = fakeExa(() => ({
    results: [{ title: "General nutrition tip", url: "https://example.com/general" }],
  }));

  const result = await searchAlternatives(exa, [], ["Vitamin D"]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "General nutrition tip");
});
