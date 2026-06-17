import { Controller, Get, Header } from '@nestjs/common';

import { MetricsService } from './metrics.service';
import { AlertsService } from '../alerts/alerts.service';

/** Expõe as métricas do Motor de Alertas no formato Prometheus. */
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alerts: AlertsService,
  ) {}

  /** GET /metrics — formato de exposição do Prometheus. */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    this.metrics.updateRuntimeGauges({
      activeAlerts: await this.alerts.countActive(),
      aqiThreshold: this.alerts.getThreshold(),
    });
    return this.metrics.getMetrics();
  }
}
