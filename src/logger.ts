function format(level: string, context: string, error?: unknown): string {
  const message = error instanceof Error ? error.message : error !== undefined ? String(error) : "";
  return `[${level}] ${context}${message ? `: ${message}` : ""}`;
}

export const logger = {
  info(context: string): void {
    process.stdout.write(`${format("info", context)}\n`);
  },
  warn(context: string, error?: unknown): void {
    process.stderr.write(`${format("warn", context, error)}\n`);
  },
  error(context: string, error?: unknown): void {
    process.stderr.write(`${format("error", context, error)}\n`);
  },
};
