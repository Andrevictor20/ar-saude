import { Controller, Get, Post, Body } from '@nestjs/common';

import { AlertsService } from './alerts/alerts.service';
import { MonitorService } from './monitor/monitor.service';
import {
  InterscityReaderService,
  InterscityHealth,
} from './interscity/interscity-reader.service';

@Controller()
export class AppController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly monitorService: MonitorService,
    private readonly interscityReader: InterscityReaderService,
  ) {}

  @Get()
  async getHealth(): Promise<{
    status: string;
    service: string;
    aqiThreshold: number;
    activeAlerts: number;
    monitorCycles: number;
    interscityHealth: InterscityHealth;
    timestamp: string;
  }> {
    return {
      status: 'ok',
      service: 'ar-saude-motor-alertas',
      aqiThreshold: this.alertsService.getThreshold(),
      activeAlerts: await this.alertsService.countActive(),
      monitorCycles: this.monitorService.getCycleCount(),
      interscityHealth: this.interscityReader.getHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('interscity/health')
  checkInterscity(): Promise<InterscityHealth> {
    return this.interscityReader.checkHealth();
  }

  @Post('chaos/interscity-primary')
  async chaosInterscityPrimary(
    @Body() body: { down?: boolean },
  ): Promise<{ chaosPrimaryDown: boolean; interscity: InterscityHealth }> {
    const down = body?.down ?? true;
    const interscity = await this.interscityReader.setChaosPrimaryDown(down);
    return {
      chaosPrimaryDown: this.interscityReader.isChaosPrimaryDown(),
      interscity,
    };
  }
}
