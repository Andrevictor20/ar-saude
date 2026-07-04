import { Controller, Get, Post, Body } from "@nestjs/common";

import { AlertsService } from "./alerts/alerts.service";

@Controller()
export class AppController {
  constructor(
    private readonly alertsService: AlertsService,
  ) {}

  @Get()
  async getHealth(): Promise<{
    status: string;
    service: string;
    aqiThreshold: number;
    activeAlerts: number;
    timestamp: string;
  }> {
    return {
      status: "ok",
      service: "ar-saude-motor-alertas",
      aqiThreshold: this.alertsService.getThreshold(),
      activeAlerts: await this.alertsService.countActive(),
      timestamp: new Date().toISOString(),
    };
  }
}
