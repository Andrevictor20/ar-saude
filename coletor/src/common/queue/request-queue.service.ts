import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/** Job enfileirado, com payload e contador de tentativas. */
interface QueueJob<T> {
  id: string;
  payload: T;
  attempts: number;
  enqueuedAt: number;
}

/** Estatísticas da fila para observabilidade. */
export interface QueueStats {
  pending: number;
  active: number;
  processed: number;
  failed: number;
  deadLetter: number;
  concurrency: number;
}

/** Opções de configuração da fila. */
export interface QueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  drainTimeoutMs?: number;
}

/**
 * Fila de requisições em memória com:
 *  - concorrência limitada (não dispara tudo de uma vez);
 *  - retry automático com backoff exponencial;
 *  - dead-letter para jobs que esgotaram as tentativas.
 *
 * Garante que, sob uma rajada de requisições, nenhuma seja perdida: elas
 * aguardam na fila e são processadas em ritmo controlado.
 */
@Injectable()
export class RequestQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RequestQueueService.name);

  private readonly pending: QueueJob<unknown>[] = [];
  private readonly deadLetter: QueueJob<unknown>[] = [];

  private worker?: (payload: unknown) => Promise<void>;

  private active = 0;
  private processed = 0;
  private failed = 0;
  private seq = 0;

  private concurrency = 5;
  private maxAttempts = 5;
  private retryDelayMs = 1000;

  /** Quando true, a fila para de iniciar novos jobs (drenagem para shutdown). */
  private draining = false;

  /** Tempo máximo de espera pela drenagem dos jobs ativos (ms). */
  private drainTimeoutMs = 10_000;

  /** Ajusta os parâmetros da fila. */
  configure(options: QueueOptions): void {
    if (options.concurrency !== undefined)
      this.concurrency = options.concurrency;
    if (options.maxAttempts !== undefined)
      this.maxAttempts = options.maxAttempts;
    if (options.retryDelayMs !== undefined)
      this.retryDelayMs = options.retryDelayMs;
    if (options.drainTimeoutMs !== undefined)
      this.drainTimeoutMs = options.drainTimeoutMs;
    this.logger.log(
      `Fila configurada → concorrência=${this.concurrency}, ` +
        `maxTentativas=${this.maxAttempts}, retryBase=${this.retryDelayMs}ms`,
    );
  }

  /** Define a função que processa cada job e inicia o consumo. */
  setWorker<T>(worker: (payload: T) => Promise<void>): void {
    this.worker = worker;
    this.drain();
  }

  /** Adiciona um job à fila e devolve o id gerado. */
  enqueue<T>(payload: T): string {
    const id = `job-${++this.seq}`;
    this.pending.push({ id, payload, attempts: 0, enqueuedAt: Date.now() });
    this.drain();
    return id;
  }

  /** Enfileira vários payloads de uma vez (útil para rajadas). */
  enqueueMany<T>(payloads: T[]): number {
    for (const payload of payloads) {
      this.enqueue(payload);
    }
    return payloads.length;
  }

  /** Estatísticas atuais da fila. */
  getStats(): QueueStats {
    return {
      pending: this.pending.length,
      active: this.active,
      processed: this.processed,
      failed: this.failed,
      deadLetter: this.deadLetter.length,
      concurrency: this.concurrency,
    };
  }

  /** Puxa jobs da fila respeitando o limite de concorrência. */
  private drain(): void {
    if (!this.worker || this.draining) return;

    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active++;
      void this.run(job);
    }
  }

  /**
   * Drenagem para shutdown gracioso: para de iniciar novos jobs e aguarda os
   * jobs em andamento terminarem (até `drainTimeoutMs`). Chamado pelo Nest via
   * enableShutdownHooks() no SIGTERM/SIGINT, evitando perder trabalho em voo.
   */
  async onModuleDestroy(): Promise<void> {
    this.draining = true;
    if (this.active === 0 && this.pending.length === 0) return;

    this.logger.log(
      `Drenando fila para shutdown — ativos=${this.active}, pendentes=${this.pending.length} ` +
        `(timeout ${this.drainTimeoutMs}ms)...`,
    );

    const deadline = Date.now() + this.drainTimeoutMs;
    while (this.active > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.active > 0) {
      this.logger.warn(
        `Shutdown com ${this.active} job(s) ainda ativos após o timeout de drenagem.`,
      );
    } else {
      this.logger.log(
        `Fila drenada. ${this.pending.length} job(s) pendentes não iniciados foram descartados.`,
      );
    }
  }

  /** Executa um job, com retry e dead-letter em caso de falha. */
  private async run(job: QueueJob<unknown>): Promise<void> {
    try {
      await this.worker!(job.payload);
      this.processed++;
      this.release();
    } catch (error) {
      job.attempts++;
      const message = error instanceof Error ? error.message : String(error);

      if (job.attempts < this.maxAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, job.attempts - 1);
        this.logger.warn(
          `[${job.id}] falhou (tentativa ${job.attempts}/${this.maxAttempts}): ${message}. ` +
            `Reenfileirando em ${delay}ms...`,
        );
        setTimeout(() => {
          this.pending.push(job);
          this.release();
        }, delay);
      } else {
        this.failed++;
        this.deadLetter.push(job);
        this.logger.error(
          `[${job.id}] descartado para dead-letter após ${job.attempts} tentativas: ${message}`,
        );
        this.release();
      }
    }
  }

  /** Libera um slot de concorrência e tenta puxar o próximo job. */
  private release(): void {
    this.active--;
    this.drain();
  }
}
