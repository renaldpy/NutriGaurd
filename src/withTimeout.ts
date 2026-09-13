import { logger } from "./logger.js";

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, context: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      logger.warn(`${context} timed out after ${ms}ms`);
      resolve(fallback);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
