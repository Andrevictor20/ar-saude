import { Global, Module } from "@nestjs/common";

import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { AlertsModule } from "../alerts/alerts.module";

/**
 * Módulo global de métricas. Disponibiliza o MetricsService para qualquer
 * serviço (monitor, eventos de alerta) e expõe o endpoint /metrics.
 */
@Global()
@Module({
  imports: [AlertsModule],
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
