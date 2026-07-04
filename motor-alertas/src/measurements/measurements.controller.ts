import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Post,
  Body,
  Logger,
} from "@nestjs/common";

import { DashboardStats, MeasurementsService } from "./measurements.service";
import { Measurement } from "../entities/measurement.entity";
import { IngestMeasurementDto } from "./dto/ingest-measurement.dto";
import { AlertsService } from "../alerts/alerts.service";

@Controller("measurements")
export class MeasurementsController {
  private readonly logger = new Logger(MeasurementsController.name);

  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly alertsService: AlertsService,
  ) {}

  @Post("ingest")
  async ingest(@Body() dto: IngestMeasurementDto): Promise<void> {
    try {
      await this.measurementsService.saveReading(dto);
      await this.alertsService.evaluate(dto);
      this.logger.log(`Medicao ingerida e avaliada: ${dto.locationName} (AQI ${dto.aqi})`);
    } catch (error) {
      this.logger.error(`Erro ao ingerir medicao: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  @Get("latest")
  findLatest(): Promise<Measurement[]> {
    return this.measurementsService.findLatestPerLocation();
  }

  @Get("stats")
  getStats(): Promise<DashboardStats> {
    return this.measurementsService.getStats();
  }

  @Get("history")
  findHistory(
    @Query("locationId") locationId: string,
    @Query("limit") limit?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.findHistory(
      locationId,
      limit ? Number(limit) : 100,
    );
  }

  @Get("export")
  exportData(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.exportData(startDate, endDate);
  }

  @Get("latest/:locationId")
  async findLatestForLocation(
    @Param("locationId") locationId: string,
  ): Promise<Measurement> {
    const measurement =
      await this.measurementsService.findLatestForLocation(locationId);
    if (!measurement) {
      throw new NotFoundException(
        `Nenhuma medicao encontrada para a localidade ${locationId}`,
      );
    }
    return measurement;
  }
}
