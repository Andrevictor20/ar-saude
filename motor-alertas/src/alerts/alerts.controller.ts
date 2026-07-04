import { Controller, Get, Query, Sse } from "@nestjs/common";
import { Observable, map } from "rxjs";

import { AlertsService } from "./alerts.service";
import { AlertsEventsService } from "./alerts-events.service";
import { Alert } from "../entities/alert.entity";
import { AlertSeverity } from "../common/air-quality";

interface SseMessage {
  data: string;
  type?: string;
}

import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("alerts")
@Controller("alerts")
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly events: AlertsEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Listar alertas (com filtros)" })
  findAll(
    @Query("status") status?: "active" | "resolved",
    @Query("locationId") locationId?: string,
    @Query("severity") severity?: AlertSeverity,
    @Query("limit") limit?: string,
  ): Promise<Alert[]> {
    return this.alertsService.findAll({
      status,
      locationId,
      severity,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("active")
  @ApiOperation({ summary: "Listar apenas alertas ativos" })
  findActive(): Promise<Alert[]> {
    return this.alertsService.findActive();
  }

  @Sse("stream")
  @ApiOperation({ summary: "Stream Server-Sent Events de alertas" })
  stream(): Observable<SseMessage> {
    return this.events.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
      })),
    );
  }
}
