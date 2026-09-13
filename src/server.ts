import express, { type Express } from "express";
import cors from "cors";
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeExpressEndpoint } from "@copilotkit/runtime";
import { analyzeCart, type AnalyzeCartDeps, type AnalyzeCartInput } from "./analyzeCart.js";
import { logger } from "./logger.js";

const COPILOTKIT_MODEL = "gpt-4o-mini";

function buildCopilotRuntime(deps?: AnalyzeCartDeps) {
  return new CopilotRuntime({
    actions: [
      {
        name: "analyzeFamilyCart",
        description:
          "Analyze a family's grocery cart or checkout text for allergens, nutrition gaps, and food " +
          "alternatives. Use this whenever the user asks about allergens, ingredients, or vitamins in " +
          "their cart.",
        parameters: [
          { name: "domText", type: "string", description: "The checkout page or cart text to analyze", required: true },
          { name: "allergens", type: "string[]", description: "The family's known allergens", required: true },
          {
            name: "targetVitamins",
            type: "string[]",
            description: "Target vitamins or nutrition goals",
            required: false,
          },
        ],
        handler: async (args: {
          domText: string;
          allergens: string[];
          targetVitamins?: string[];
        }) => {
          const input: AnalyzeCartInput = args;
          const result = deps ? await analyzeCart(input, deps) : await analyzeCart(input);
          return JSON.stringify(result);
        },
      },
    ],
  });
}

export function createServer(deps?: AnalyzeCartDeps): Express {
  const app = express();
  app.use(cors());

  app.post("/api/analyze-checkout", express.json({ limit: "10mb" }), async (req, res) => {
    try {
      const result = deps ? await analyzeCart(req.body, deps) : await analyzeCart(req.body);
      res.json(result);
    } catch (error: unknown) {
      logger.error("POST /api/analyze-checkout failed", error);
      res.status(400).json({ error: "Unable to analyze cart. Check the request shape and try again." });
    }
  });

  // CopilotKit's own Express integration reads the raw request body itself, so it
  // must not sit behind the global express.json() parser used by the route above.
  // app.all (not app.use) — app.use mounts as a sub-app and rewrites req.url to be
  // relative to the mount point, but CopilotKit's internal router matches against
  // the full original path.
  app.all(
    "/api/copilotkit",
    copilotRuntimeNodeExpressEndpoint({
      runtime: buildCopilotRuntime(deps),
      serviceAdapter: new OpenAIAdapter({ model: COPILOTKIT_MODEL }),
      endpoint: "/api/copilotkit",
    })
  );

  return app;
}
