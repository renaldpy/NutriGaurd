const REQUIRED_ENV_VARS = ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "EXA_API_KEY"] as const;

export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

assertRequiredEnv();
