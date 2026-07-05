import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Post,
  Body,
  Logger,
  UseGuards,
} from "@nestjs/common";

import { DashboardStats, MeasurementsService, RankingResult } from "./measurements.service";
import { Measurement } from "../entities/measurement.entity";
import { AlertsService } from "../alerts/alerts.service";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { ApiTags, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { IngestMeasurementDto } from "./dto/ingest-measurement.dto";

@ApiTags("measurements")
@Controller("measurements")
export class MeasurementsController {
  private readonly logger = new Logger(MeasurementsController.name);

  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly alertsService: AlertsService,
  ) {}

  @Post("ingest")
  @UseGuards(ApiKeyGuard)
  @ApiSecurity("api-key")
  @ApiOperation({ summary: "Ingerir nova medição de qualidade do ar" })
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
  @ApiOperation({ summary: "Obter a última medição de cada localidade" })
  findLatest(): Promise<Measurement[]> {
    return this.measurementsService.findLatestPerLocation();
  }

  @Get("stats")
  @ApiOperation({ summary: "Obter estatísticas do painel" })
  getStats(): Promise<DashboardStats> {
    return this.measurementsService.getStats();
  }

  @Get("history")
  @ApiOperation({ summary: "Obter histórico de medições de uma localidade" })
  findHistory(
    @Query("locationId") locationId: string,
    @Query("limit") limit?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.findHistory(
      locationId,
      limit ? Number(limit) : 100,
    );
  }

  @Get("ranking")
  @ApiOperation({ summary: "Obter ranking top 5 melhores/piores por índice e período" })
  getRanking(
    @Query("index") index: string = "aqi",
    @Query("period") period: string = "30d",
  ): Promise<RankingResult> {
    return this.measurementsService.getRanking(index, period);
  }

  @Get("export")
  @ApiOperation({ summary: "Exportar dados filtrados por data" })
  exportData(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.exportData(startDate, endDate);
  }

  @Get("latest/:locationId")
  @ApiOperation({ summary: "Obter a última medição de uma localidade específica" })
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
