import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache/cache.service.js';
import { RequestQueueService } from './queue/request-queue.service.js';
import { MetricsService } from './metrics/metrics.service.js';

/**
 * Módulo global de infraestrutura compartilhada.
 *
 * Disponibiliza o cache em memória, a fila de requisições e o registro de
 * métricas Prometheus para qualquer módulo da aplicação sem re-importação.
 */
@Global()
@Module({
  providers: [CacheService, RequestQueueService, MetricsService],
  exports: [CacheService, RequestQueueService, MetricsService],
})
export class CommonModule {}
