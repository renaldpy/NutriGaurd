import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnalyzeCartInput } from "../src/validateInput.js";

test("parseAnalyzeCartInput accepts valid domText input", () => {
  const result = parseAnalyzeCartInput({ domText: "Cart: item", allergens: ["peanuts"] });
  assert.equal(result.domText, "Cart: item");
});

test("parseAnalyzeCartInput accepts valid receiptImage input", () => {
  const result = parseAnalyzeCartInput({
    receiptImage: { base64: "ZmFrZQ==", mimeType: "image/jpeg" },
    allergens: [],
  });
  assert.equal(result.receiptImage?.mimeType, "image/jpeg");
});

test("parseAnalyzeCartInput rejects input with neither domText nor receiptImage", () => {
  assert.throws(() => parseAnalyzeCartInput({ allergens: [] }), /requires either domText or receiptImage/);
});

test("parseAnalyzeCartInput rejects a non-array allergens field", () => {
  assert.throws(() => parseAnalyzeCartInput({ domText: "Cart: item", allergens: "peanuts" }));
});

test("parseAnalyzeCartInput rejects an empty domText string", () => {
  assert.throws(() => parseAnalyzeCartInput({ domText: "", allergens: [] }));
});

test("parseAnalyzeCartInput rejects completely malformed input", () => {
  assert.throws(() => parseAnalyzeCartInput("not an object"));
  assert.throws(() => parseAnalyzeCartInput(null));
  assert.throws(() => parseAnalyzeCartInput(undefined));
});
