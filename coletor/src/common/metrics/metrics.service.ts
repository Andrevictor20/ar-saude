import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

import { QueueStats } from '../queue/request-queue.service.js';
import { CacheStats } from '../cache/cache.service.js';

/**
 * Registro central de métricas Prometheus do Coletor.
 *
 * - Counters (eventos cumulativos): coletas, medições enviadas/falhas.
 * - Gauges (estado instantâneo): fila e cache são amostrados no momento do
 *   scrape (`updateRuntimeGauges`), evitando dependência circular entre o
 *   MetricsService e os serviços que ele observa.
 */
@Injectable()
export class MetricsService {
  readonly registry = new client.Registry();

  // ── Counters ──────────────────────────────────────────────────────────
  private readonly collectionsTotal = new client.Counter({
    name: 'arsaude_collections_total',
    help: 'Total de ciclos de coleta enfileirados (cron + manual).',
  });
  private readonly measurementsSentTotal = new client.Counter({
    name: 'arsaude_measurements_sent_total',
    help: 'Total de medições enviadas com sucesso ao Motor de Alertas.',
  });
  private readonly measurementsFailedTotal = new client.Counter({
    name: 'arsaude_measurements_failed_total',
    help: 'Total de medições que falharam ao enviar (após retries).',
  });
  // ── Gauges (amostrados no scrape) ───────────────────────────────────────
  private readonly queuePending = new client.Gauge({
    name: 'arsaude_queue_pending',
    help: 'Jobs aguardando na fila.',
  });
  private readonly queueActive = new client.Gauge({
    name: 'arsaude_queue_active',
    help: 'Jobs em processamento.',
  });
  private readonly queueProcessed = new client.Gauge({
    name: 'arsaude_queue_processed',
    help: 'Jobs processados com sucesso (acumulado da fila).',
  });
  private readonly queueFailed = new client.Gauge({
    name: 'arsaude_queue_failed',
    help: 'Jobs que esgotaram tentativas (acumulado da fila).',
  });
  private readonly queueDeadLetter = new client.Gauge({
    name: 'arsaude_queue_dead_letter',
    help: 'Jobs atualmente na dead-letter.',
  });
  private readonly queueConcurrency = new client.Gauge({
    name: 'arsaude_queue_concurrency',
    help: 'Limite de concorrência configurado na fila.',
  });
  private readonly cacheSize = new client.Gauge({
    name: 'arsaude_cache_size',
    help: 'Número de entradas vivas no cache.',
  });
  private readonly cacheHits = new client.Gauge({
    name: 'arsaude_cache_hits',
    help: 'Acertos de cache (acumulado).',
  });
  private readonly cacheMisses = new client.Gauge({
    name: 'arsaude_cache_misses',
    help: 'Faltas de cache (acumulado).',
  });
  private readonly cacheHitRate = new client.Gauge({
    name: 'arsaude_cache_hit_rate',
    help: 'Taxa de acerto do cache (0..1).',
  });
  constructor() {
    this.registry.setDefaultLabels({ service: 'ar-saude-coletor' });
    client.collectDefaultMetrics({ register: this.registry });
    this.registry.registerMetric(this.collectionsTotal);
    this.registry.registerMetric(this.measurementsSentTotal);
    this.registry.registerMetric(this.measurementsFailedTotal);
    for (const gauge of [
      this.queuePending,
      this.queueActive,
      this.queueProcessed,
      this.queueFailed,
      this.queueDeadLetter,
      this.queueConcurrency,
      this.cacheSize,
      this.cacheHits,
      this.cacheMisses,
      this.cacheHitRate,
    ]) {
      this.registry.registerMetric(gauge);
    }
  }

  /** Incrementa o contador de ciclos de coleta. */
  incCollections(): void {
    this.collectionsTotal.inc();
  }

  /** Registra uma medição enviada com sucesso. */
  incMeasurementSent(): void {
    this.measurementsSentTotal.inc();
  }

  /** Registra uma medição que falhou. */
  incMeasurementFailed(): void {
    this.measurementsFailedTotal.inc();
  }

  /** Amostra fila e cache no instante do scrape. */
  updateRuntimeGauges(
    queue: QueueStats,
    cache: CacheStats,
  ): void {
    this.queuePending.set(queue.pending);
    this.queueActive.set(queue.active);
    this.queueProcessed.set(queue.processed);
    this.queueFailed.set(queue.failed);
    this.queueDeadLetter.set(queue.deadLetter);
    this.queueConcurrency.set(queue.concurrency);

    this.cacheSize.set(cache.size);
    this.cacheHits.set(cache.hits);
    this.cacheMisses.set(cache.misses);
    const total = cache.hits + cache.misses;
    this.cacheHitRate.set(total === 0 ? 0 : cache.hits / total);
  }

  /** Texto no formato de exposição do Prometheus. */
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type correto para o endpoint /metrics. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
