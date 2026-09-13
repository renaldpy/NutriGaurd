import { test } from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { extractAllergens, extractAllergensFromReceiptImage } from "../src/extractAllergens.js";

function fakeOpenAI(response: unknown): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => response,
      },
    },
  } as unknown as OpenAI;
}

function fakeOpenAIThatThrows(): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => {
          throw new Error("simulated API failure");
        },
      },
    },
  } as unknown as OpenAI;
}

test("extractAllergens returns parsed items and warnings on a well-formed response", async () => {
  const openai = fakeOpenAI({
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
  });

  const result = await extractAllergens(openai, "Cart: Peanut Butter x1", ["peanuts"]);

  assert.deepEqual(result.items, [{ name: "Peanut Butter", flagged: true, reason: "contains peanuts" }]);
  assert.deepEqual(result.warnings, ["Cart contains peanuts"]);
});

test("extractAllergens converts a null reason to undefined", async () => {
  const openai = fakeOpenAI({
    choices: [
      {
        message: {
          content: JSON.stringify({
            items: [{ name: "Oat Milk", flagged: false, reason: null }],
            warnings: [],
          }),
        },
      },
    ],
  });

  const result = await extractAllergens(openai, "Cart: Oat Milk x1", []);

  assert.equal(result.items[0]?.reason, undefined);
});

test("extractAllergens falls back when the response has no content", async () => {
  const openai = fakeOpenAI({ choices: [{ message: {} }] });

  const result = await extractAllergens(openai, "Cart: mystery item", []);

  assert.equal(result.items[0]?.name, "Unable to parse cart");
});

test("extractAllergens falls back when the API call throws", async () => {
  const openai = fakeOpenAIThatThrows();

  const result = await extractAllergens(openai, "Cart: anything", ["peanuts"]);

  assert.equal(result.items[0]?.name, "Unable to parse cart");
  assert.equal(result.warnings.length > 0, true);
});

test("extractAllergensFromReceiptImage sends an image_url content part and parses the result", async () => {
  let capturedMessages: unknown;
  const openai = {
    chat: {
      completions: {
        create: async (params: { messages: unknown }) => {
          capturedMessages = params.messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({ items: [{ name: "Bread", flagged: false, reason: null }], warnings: [] }),
                },
              },
            ],
          };
        },
      },
    },
  } as unknown as OpenAI;

  const result = await extractAllergensFromReceiptImage(
    openai,
    { base64: "ZmFrZQ==", mimeType: "image/jpeg" },
    ["peanuts"]
  );

  assert.equal(result.items[0]?.name, "Bread");
  const userMessage = (capturedMessages as { role: string; content: unknown }[]).find((m) => m.role === "user");
  const imagePart = (userMessage?.content as { type: string; image_url?: { url: string } }[]).find(
    (part) => part.type === "image_url"
  );
  assert.equal(imagePart?.image_url?.url, "data:image/jpeg;base64,ZmFrZQ==");
});
