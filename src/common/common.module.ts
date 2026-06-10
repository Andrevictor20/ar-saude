import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache/cache.service.js';
import { RequestQueueService } from './queue/request-queue.service.js';

/**
 * Módulo global de infraestrutura compartilhada.
 *
 * Disponibiliza o cache em memória e a fila de requisições para qualquer
 * módulo da aplicação sem necessidade de re-importação.
 */
@Global()
@Module({
  providers: [CacheService, RequestQueueService],
  exports: [CacheService, RequestQueueService],
})
export class CommonModule {}
