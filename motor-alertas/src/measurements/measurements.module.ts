import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Measurement } from "../entities/measurement.entity";
import { MeasurementsService } from "./measurements.service";
import { MeasurementsController } from "./measurements.controller";
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [TypeOrmModule.forFeature([Measurement]), AlertsModule],
  providers: [MeasurementsService],
  controllers: [MeasurementsController],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
