import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service.js';
import { CacheService } from '../cache/cache.service.js';
import { CollectorService } from '../../collector/collector.service.js';
import { InterscityService } from '../../interscity/interscity.service.js';

/** Expõe as métricas do Coletor no formato Prometheus. */
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly cache: CacheService,
    private readonly collector: CollectorService,
    private readonly interscity: InterscityService,
  ) {}

  /** GET /metrics — formato de exposição do Prometheus. */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    this.metrics.updateRuntimeGauges(
      this.collector.getQueueStats(),
      this.cache.getStats(),
      this.interscity.getHealth(),
    );
    return this.metrics.getMetrics();
  }
}
