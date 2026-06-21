import { Logger } from "@nestjs/common";

const logger = new Logger("RetryUtil");

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 1000,
  context = "retryWithBackoff",
  shouldRetry?: (error: unknown) => boolean,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        logger.error(
          `[${context}] Todas as ${maxRetries} tentativas falharam. Ultimo erro: ${lastError.message}`,
        );
        throw lastError;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.round(exponentialDelay + jitter);

      logger.warn(
        `[${context}] Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}. Retentando em ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
