import { Controller, Get } from '@nestjs/common';

import { AlertsService } from './alerts/alerts.service';
import { MonitorService } from './monitor/monitor.service';

@Controller()
export class AppController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly monitorService: MonitorService,
  ) {}

  @Get()
  async getHealth(): Promise<{
    status: string;
    service: string;
    aqiThreshold: number;
    activeAlerts: number;
    monitorCycles: number;
    timestamp: string;
  }> {
    return {
      status: 'ok',
      service: 'ar-saude-motor-alertas',
      aqiThreshold: this.alertsService.getThreshold(),
      activeAlerts: await this.alertsService.countActive(),
      monitorCycles: this.monitorService.getCycleCount(),
      timestamp: new Date().toISOString(),
    };
  }
}
