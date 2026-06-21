import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';

import {
  DashboardStats,
  MeasurementsService,
} from './measurements.service';
import { Measurement } from '../entities/measurement.entity';

@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get('latest')
  findLatest(): Promise<Measurement[]> {
    return this.measurementsService.findLatestPerNeighborhood();
  }

  @Get('stats')
  getStats(): Promise<DashboardStats> {
    return this.measurementsService.getStats();
  }

  @Get('history')
  findHistory(
    @Query('neighborhoodId') neighborhoodId: string,
    @Query('limit') limit?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.findHistory(
      neighborhoodId,
      limit ? Number(limit) : 100,
    );
  }

  @Get('export')
  exportData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Measurement[]> {
    return this.measurementsService.exportData(startDate, endDate);
  }

  @Get('latest/:neighborhoodId')
  async findLatestForNeighborhood(
    @Param('neighborhoodId') neighborhoodId: string,
  ): Promise<Measurement> {
    const measurement =
      await this.measurementsService.findLatestForNeighborhood(neighborhoodId);
    if (!measurement) {
      throw new NotFoundException(
        `Nenhuma medicao encontrada para o bairro ${neighborhoodId}`,
      );
    }
    return measurement;
  }
}
