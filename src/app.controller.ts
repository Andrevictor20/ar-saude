import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service.js';
import { CollectorService } from './collector/collector.service.js';
import { CacheService } from './common/cache/cache.service.js';
import { InterscityService } from './interscity/interscity.service.js';

/** Controller de healthcheck e observabilidade (fila + cache + InterSCity). */
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly collectorService: CollectorService,
    private readonly cacheService: CacheService,
    private readonly interscityService: InterscityService,
  ) {}

  /** GET / — Healthcheck. */
  @Get()
  getHealth(): { status: string; service: string; timestamp: string } {
    return this.appService.getHealth();
  }

  /** GET /stats — Estatísticas da fila, do cache e do InterSCity. */
  @Get('stats')
  getStats(): {
    cycles: number;
    queue: ReturnType<CollectorService['getQueueStats']>;
    cache: ReturnType<CacheService['getStats']>;
    interscity: ReturnType<InterscityService['getHealth']>;
  } {
    return {
      cycles: this.collectorService.getExecutionCount(),
      queue: this.collectorService.getQueueStats(),
      cache: this.cacheService.getStats(),
      interscity: this.interscityService.getHealth(),
    };
  }

  /** GET /interscity/health — Dispara um healthcheck ao vivo do primário + fallback. */
  @Get('interscity/health')
  checkInterscity(): Promise<ReturnType<InterscityService['getHealth']>> {
    return this.interscityService.checkHealth();
  }

  /** POST /collect — Enfileira manualmente a coleta de todos os bairros (teste de carga). */
  @Post('collect')
  triggerCollect(): {
    enqueued: number;
    queue: ReturnType<CollectorService['getQueueStats']>;
  } {
    const enqueued = this.collectorService.enqueueAllNeighborhoods();
    return { enqueued, queue: this.collectorService.getQueueStats() };
  }
}
