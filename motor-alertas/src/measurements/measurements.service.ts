import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Measurement } from '../entities/measurement.entity';
import { InterscityReading } from '../interscity/interscity-reader.service';

export interface LevelDistribution {
  level: string;
  count: number;
}

export interface DashboardStats {
  monitoredNeighborhoods: number;
  totalMeasurements: number;
  averageAqi: number | null;
  worst: { neighborhoodName: string; aqi: number; level: string } | null;
  best: { neighborhoodName: string; aqi: number; level: string } | null;
  distribution: LevelDistribution[];
  updatedAt: string;
}

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
    @InjectRepository(Measurement)
    private readonly repo: Repository<Measurement>,
  ) {}

  async saveReading(reading: InterscityReading): Promise<Measurement | null> {
    const exists = await this.repo.findOne({
      where: {
        resourceUuid: reading.resourceUuid,
        measuredAt: reading.measuredAt,
      },
    });

    if (exists) {
      return null;
    }

    const measurement = this.repo.create({
      neighborhoodId: reading.neighborhoodId,
      neighborhoodName: reading.neighborhoodName,
      resourceUuid: reading.resourceUuid,
      aqi: reading.aqi,
      level: reading.level,
      pm10: reading.pm10,
      pm2_5: reading.pm2_5,
      no2: reading.no2,
      ozone: reading.ozone,
      latitude: reading.latitude,
      longitude: reading.longitude,
      measuredAt: reading.measuredAt,
    });

    return this.repo.save(measurement);
  }

  async findHistory(
    neighborhoodId: string,
    limit = 100,
  ): Promise<Measurement[]> {
    return this.repo.find({
      where: { neighborhoodId },
      order: { measuredAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  }

  async findLatestPerNeighborhood(): Promise<Measurement[]> {
    return this.repo
      .createQueryBuilder('m')
      .distinctOn(['m.neighborhoodId'])
      .orderBy('m.neighborhoodId', 'ASC')
      .addOrderBy('m.measuredAt', 'DESC')
      .getMany();
  }

  async findLatestForNeighborhood(
    neighborhoodId: string,
  ): Promise<Measurement | null> {
    return this.repo.findOne({
      where: { neighborhoodId },
      order: { measuredAt: 'DESC' },
    });
  }

  async getStats(): Promise<DashboardStats> {
    const latest = await this.findLatestPerNeighborhood();
    const withAqi = latest.filter(
      (m): m is Measurement & { aqi: number } => typeof m.aqi === 'number',
    );

    const averageAqi =
      withAqi.length > 0
        ? Math.round(
            withAqi.reduce((sum, m) => sum + m.aqi, 0) / withAqi.length,
          )
        : null;

    const sorted = [...withAqi].sort((a, b) => b.aqi - a.aqi);
    const worst = sorted[0]
      ? {
          neighborhoodName: sorted[0].neighborhoodName,
          aqi: sorted[0].aqi,
          level: sorted[0].level,
        }
      : null;
    const best = sorted[sorted.length - 1]
      ? {
          neighborhoodName: sorted[sorted.length - 1].neighborhoodName,
          aqi: sorted[sorted.length - 1].aqi,
          level: sorted[sorted.length - 1].level,
        }
      : null;

    const distributionMap = new Map<string, number>();
    for (const m of latest) {
      distributionMap.set(m.level, (distributionMap.get(m.level) ?? 0) + 1);
    }
    const distribution: LevelDistribution[] = Array.from(
      distributionMap.entries(),
    ).map(([level, count]) => ({ level, count }));

    const totalMeasurements = await this.repo.count();

    return {
      monitoredNeighborhoods: latest.length,
      totalMeasurements,
      averageAqi,
      worst,
      best,
      distribution,
      updatedAt: new Date().toISOString(),
    };
  }
}
