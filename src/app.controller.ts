import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

/** Controller de healthcheck. */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET / — Healthcheck. */
  @Get()
  getHealth(): { status: string; service: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
