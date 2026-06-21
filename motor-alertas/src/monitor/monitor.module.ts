import { Module } from "@nestjs/common";

import { MonitorService } from "./monitor.service";
import { InterscityModule } from "../interscity/interscity.module";
import { MeasurementsModule } from "../measurements/measurements.module";
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [InterscityModule, MeasurementsModule, AlertsModule],
  providers: [MonitorService],
  exports: [MonitorService],
})
export class MonitorModule {}
