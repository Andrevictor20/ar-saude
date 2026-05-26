/**
 * =====================================================
 * Utilitário de Retry com Backoff Exponencial
 * =====================================================
 *
 * Implementa uma estratégia de retry genérica que pode ser
 * usada em qualquer chamada de rede (Open-Meteo, InterSCity).
 *
 * O backoff exponencial aumenta o intervalo entre tentativas
 * progressivamente: 1s → 2s → 4s → 8s → 16s (com jitter),
 * reduzindo a pressão sobre APIs públicas com rate limiting.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('RetryUtil');

/**
 * Executa uma função assíncrona com retry e backoff exponencial.
 *
 * @param fn       - Função assíncrona a ser executada.
 * @param maxRetries   - Número máximo de tentativas (padrão: 5).
 * @param baseDelayMs  - Delay base em milissegundos (padrão: 1000).
 * @param context      - Contexto textual para logging (ex.: "OpenMeteo.fetchAirQuality").
 * @returns O resultado da função fn quando bem-sucedida.
 * @throws O último erro após esgotar todas as tentativas.
 */
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

      // Backoff exponencial com jitter aleatório (±25%)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1); // -25% a +25%
      const delay = Math.round(exponentialDelay + jitter);

      logger.warn(
        `[${context}] Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}. ` +
          `Retentando em ${delay}ms...`,
      );

      await sleep(delay);
    }
  }

  // Inalcançável, mas satisfaz o compilador TypeScript
  throw lastError;
}

/**
 * Pausa a execução por um período determinado.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
