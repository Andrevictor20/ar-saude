import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

/**
 * Controller raiz — fornece endpoints de healthcheck
 * para monitoramento em ambientes containerizados.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   * Healthcheck simples retornando status do microsserviço.
   */
  @Get()
  getHealth(): { status: string; service: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
