import { z } from "zod";
import type { AnalyzeCartInput } from "./types.js";

const receiptImageSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1),
});

const analyzeCartInputSchema = z
  .object({
    domText: z.string().min(1).optional(),
    receiptImage: receiptImageSchema.optional(),
    allergens: z.array(z.string()),
    targetVitamins: z.array(z.string()).optional(),
  })
  .refine((value) => Boolean(value.domText) || Boolean(value.receiptImage), {
    message: "analyzeCart requires either domText or receiptImage",
  });

export function parseAnalyzeCartInput(input: unknown): AnalyzeCartInput {
  const result = analyzeCartInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid analyzeCart input: ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
}
