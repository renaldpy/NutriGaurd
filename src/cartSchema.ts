export const CART_ANALYSIS_SCHEMA = {
  name: "cart_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            flagged: { type: "boolean" },
            reason: { type: ["string", "null"] },
          },
          required: ["name", "flagged", "reason"],
          additionalProperties: false,
        },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["items", "warnings"],
    additionalProperties: false,
  },
} as const;

export const CART_ANALYSIS_SYSTEM_PROMPT =
  "You extract grocery cart items from the given input and flag any that contain the " +
  "family's known allergens. Set reason to null when an item is not flagged.";
