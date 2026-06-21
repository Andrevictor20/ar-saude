/** Retry com backoff exponencial e jitter. */

import { Logger } from '@nestjs/common';

const logger = new Logger('RetryUtil');

/** Executa uma função assíncrona com retry e backoff exponencial. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000,
  context: string = 'retryWithBackoff',
  shouldRetry?: (error: any) => boolean,
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
          `[${context}] Todas as ${maxRetries} tentativas falharam. Último erro: ${lastError.message}`,
        );
        throw lastError;
      }

      // Backoff exponencial com jitter (±25%)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.round(exponentialDelay + jitter);

      logger.warn(
        `[${context}] Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}. ` +
          `Retentando em ${delay}ms...`,
      );

      await sleep(delay);
    }
  }

  // Satisfaz o compilador TypeScript
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
