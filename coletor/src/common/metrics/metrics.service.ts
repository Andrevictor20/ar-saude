import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

import { QueueStats } from '../queue/request-queue.service.js';
import { CacheStats } from '../cache/cache.service.js';

/** Saúde do InterSCity no formato consumido pelas métricas. */
export interface InterscityMetricSnapshot {
  active: string;
  primaryUp: boolean;
  fallbackUp: boolean;
}

/**
 * Registro central de métricas Prometheus do Coletor.
 *
 * - Counters (eventos cumulativos): coletas, medições enviadas/falhas, failover.
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
    help: 'Total de medições enviadas com sucesso ao InterSCity.',
  });
  private readonly measurementsFailedTotal = new client.Counter({
    name: 'arsaude_measurements_failed_total',
    help: 'Total de medições que falharam ao enviar (após retries).',
  });
  private readonly interscityFailoverTotal = new client.Counter({
    name: 'arsaude_interscity_failover_total',
    help: 'Total de trocas de endpoint ativo do InterSCity (failover).',
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
  private readonly interscityPrimaryUp = new client.Gauge({
    name: 'arsaude_interscity_primary_up',
    help: 'Primário do InterSCity no ar (1) ou fora (0).',
  });
  private readonly interscityFallbackUp = new client.Gauge({
    name: 'arsaude_interscity_fallback_up',
    help: 'Fallback do InterSCity no ar (1) ou fora (0).',
  });
  private readonly interscityActive = new client.Gauge({
    name: 'arsaude_interscity_active_endpoint',
    help: 'Endpoint ativo do InterSCity (1 = aquele rótulo está ativo).',
    labelNames: ['endpoint'] as const,
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'ar-saude-coletor' });
    client.collectDefaultMetrics({ register: this.registry });
    this.registry.registerMetric(this.collectionsTotal);
    this.registry.registerMetric(this.measurementsSentTotal);
    this.registry.registerMetric(this.measurementsFailedTotal);
    this.registry.registerMetric(this.interscityFailoverTotal);
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
      this.interscityPrimaryUp,
      this.interscityFallbackUp,
      this.interscityActive,
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

  /** Registra um failover de endpoint do InterSCity. */
  incFailover(): void {
    this.interscityFailoverTotal.inc();
  }

  /** Amostra fila, cache e InterSCity no instante do scrape. */
  updateRuntimeGauges(
    queue: QueueStats,
    cache: CacheStats,
    interscity: InterscityMetricSnapshot,
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

    this.interscityPrimaryUp.set(interscity.primaryUp ? 1 : 0);
    this.interscityFallbackUp.set(interscity.fallbackUp ? 1 : 0);
    this.interscityActive.set(
      { endpoint: 'primary' },
      interscity.active === 'primary' ? 1 : 0,
    );
    this.interscityActive.set(
      { endpoint: 'fallback' },
      interscity.active === 'fallback' ? 1 : 0,
    );
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
