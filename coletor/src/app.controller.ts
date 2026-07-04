import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service.js';
import { CollectorService } from './collector/collector.service.js';
import { CacheService } from './common/cache/cache.service.js';

/** Controller de healthcheck e observabilidade (fila + cache + motor de alertas). */
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly collectorService: CollectorService,
    private readonly cacheService: CacheService,
  ) {}

  /** GET / — Healthcheck. */
  @Get()
  getHealth(): { status: string; service: string; timestamp: string } {
    return this.appService.getHealth();
  }

  /** GET /stats — Estatísticas da fila e do cache. */
  @Get('stats')
  getStats(): {
    cycles: number;
    queue: ReturnType<CollectorService['getQueueStats']>;
    cache: ReturnType<CacheService['getStats']>;
  } {
    return {
      cycles: this.collectorService.getExecutionCount(),
      queue: this.collectorService.getQueueStats(),
      cache: this.cacheService.getStats(),
    };
  }

  @Post('collect')
  async triggerCollection() {
    const enqueued = await this.collectorService.enqueueAllLocations();
    return {
      message: `${enqueued} jobs enfileirados via webhook.`,
    };
  }
}
