# family-cart-ai

Member 3 module for the family dietary/allergy checkout agent — OpenAI, OpenRouter, and Exa.

Built By:

Github: renaldpy.

Github: saadsgit.

Github: imranux-ui.

Github: XStoryShiftX.

## Setup

```bash
npm install
cp .env.example .env   # fill in OPENAI_API_KEY, OPENROUTER_API_KEY, EXA_API_KEY
```

## Usage

```ts
import { analyzeCart } from "./dist/analyzeCart.js";

const result = await analyzeCart({
  domText: "Cart: Jif Peanut Butter x1, Oat Milk x2",
  // or: receiptImage: { base64: "<base64>", mimeType: "image/jpeg" },
  allergens: ["peanuts"],
  targetVitamins: ["Vitamin D"],
});
```

Provide exactly one of `domText` (checkout page text) or `receiptImage` (a photographed
receipt, parsed via GPT-4o Vision). Input is validated with Zod (`src/validateInput.ts`) —
`analyzeCart` throws a descriptive error if neither is given, or if the shape is wrong.

`analyzeCart` also accepts an optional second `deps` argument (`{ openai, openrouter, exa,
openrouterModel }`) for injecting fake clients in tests; real singletons are used by default.

## Pipeline

1. **OpenAI (`gpt-4o-mini`)** — extracts cart items and flags allergens. Uses a strict
   `json_schema` response format (see `src/cartSchema.ts`), so the shape is guaranteed,
   not just "valid JSON".
2. **OpenRouter** — scores the cart against target vitamins/macros with a cheap fast
   model (`OPENROUTER_MODEL`, default `meta-llama/llama-3.1-8b-instruct`).
3. **Exa (`/search`)** — runs one search per flagged allergen (capped at 3) for alternative
   food sources, deduped and capped at 6 total results.
4. **Exa (`/answer`)** — `src/checkAllergensWithExa.ts` fact-checks the flagged items against
   real, citation-backed sources using Exa's grounded answer endpoint with `outputSchema` +
   `systemPrompt`, rather than trusting GPT-4o-mini's allergen call alone. `/answer` was
   chosen over `/search` + `outputSchema` here because this is a direct fact-lookup question
   ("does X commonly contain Y, per real sources") that Exa can retrieve *and* answer in one
   call — see [exa-labs/agent-skills: build-with-exa](https://github.com/exa-labs/agent-skills)
   for the endpoint-selection rationale.

## Reliability

- Every external call (OpenAI, OpenRouter, each Exa query) is wrapped in a timeout
  (`src/withTimeout.ts` — 8s for OpenAI/OpenRouter, 5s per Exa query) so a hang never
  blocks the whole pipeline.
- Every failure is logged via `src/logger.ts` (stderr, not swallowed) before falling
  back to canned output, so real bugs are visible instead of silently masked.
- `src/env.ts` asserts `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and `EXA_API_KEY` are set
  the moment `analyzeCart.ts` is imported, rather than failing lazily on first call.

## Scripts

- `npm run build` — compile to `dist/`
- `npm run typecheck` — typecheck `src/` and `test/` together
- `npm run smoke` — run a real end-to-end call against all three APIs and print the result
- `npm run server` — start the HTTP bridge on `PORT` (default `4000`)
- `npm test` — unit tests (28 tests across extraction, scoring, search, allergen
  verification, validation, the HTTP server, and the end-to-end `analyzeCart` flow, all
  with mocked clients — no API keys required)

## CopilotKit Chat (`POST /api/copilotkit`)

`src/server.ts` also exposes a CopilotKit runtime endpoint so the extension popup's chat
(`extension-popup/`) can converse about the cart, not just render a static scan result.
One action, `analyzeFamilyCart`, wraps `analyzeCart` — the model calls it with `domText`
(synthesized from the conversation), `allergens`, and optional `targetVitamins`.

**Gotcha if you touch this route**: it's mounted with `app.all(...)`, not `app.use(...)`.
Express's `app.use(path, handler)` mounts as a sub-app and rewrites `req.url` to be
relative to the mount point (stripping `/api/copilotkit` down to `/`); CopilotKit's
internal router matches requests against the *full* original path, so `app.use` here
silently 404s every request. `app.all` registers a route handler instead, which leaves
`req.url` untouched.

It's also intentionally *not* behind the global `express.json()` parser (that's scoped to
`/api/analyze-checkout` only) — CopilotKit's Express integration reads the raw request
body stream itself.

## Browser Extension (`extension-popup/`)

`analyzeCart` holds real API keys, so it can never run inside the extension directly —
it's only reachable through the local HTTP server (`src/server.ts`).

The extension has four pieces, all built together by Vite into `extension-popup/dist/`:

```
                     ┌─────────────────────┐
  content.js    ───▶ │ chrome.storage.local │  (family profile: allergens, targetVitamins)
  (profile UI)       └─────────────────────┘
                                │
  content-scanner.js ──reads──┘
  (scan button / receipt upload)
        │
        │ chrome.runtime.sendMessage({ type: "ANALYZE_CART", payload })
        ▼
  background.js (service worker, has host_permissions for localhost:4000)
        │ fetch POST /api/analyze-checkout
        ▼
  src/server.ts  ──▶  analyzeCart()  ──▶  OpenAI / OpenRouter / Exa

  popup (index.html, React + CopilotChat) ──▶ POST /api/copilotkit ──▶ analyzeFamilyCart action
```

The `/api/analyze-checkout` fetch is done from the background service worker rather than
directly from the content script — a content script's fetch is scoped to the current
page's own origin for CORS purposes (which varies per site), while the background worker
is a privileged extension context covered by `host_permissions` in `manifest.json`. The
popup's CopilotKit chat calls `/api/copilotkit` directly (a privileged extension context
itself), so it doesn't need the background relay.

**Run it:**
1. `npm run server` (from this directory — keep it running)
2. `cd extension-popup && npm install && npm run build`
3. Load `extension-popup/dist` as an unpacked extension in Chrome (`chrome://extensions` →
   Developer mode → Load unpacked)
4. On any page: click **🥗 NutriGuard Setup**, tag a family member's allergens/vitamin
   goals, **Save Profile & Sync**
5. Click **🔍 Scan** → **Scan Checkout Page** (reads the current page's text) or
   **Upload Receipt Photo** (sends a photo through GPT-4o Vision) — results render in the
   scan panel: warnings, Exa-verified allergen sources, nutrition summary, and food
   alternatives
6. Click the extension icon to open the popup and chat about the cart via CopilotKit
