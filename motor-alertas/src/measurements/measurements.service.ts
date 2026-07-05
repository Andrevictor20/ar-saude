import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Measurement } from "../entities/measurement.entity";
import { IngestMeasurementDto } from "./dto/ingest-measurement.dto";
import { LocationsService } from "../locations/locations.service";

export interface LevelDistribution {
  level: string;
  count: number;
}

export interface RankingEntry {
  locationName: string;
  state: string;
  value: number;
}

export interface RankingResult {
  index: string;
  period: string;
  worst: RankingEntry[];
  best: RankingEntry[];
}

export interface DashboardStats {
  monitoredLocations: number;
  totalMeasurements: number;
  averageAqi: number | null;
  worst: { locationName: string; aqi: number; level: string } | null;
  best: { locationName: string; aqi: number; level: string } | null;
  distribution: LevelDistribution[];
  updatedAt: string;
}

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
    @InjectRepository(Measurement)
    private readonly repo: Repository<Measurement>,
    private readonly locationsService: LocationsService,
  ) {}

  async saveReading(reading: IngestMeasurementDto): Promise<Measurement | null> {
    const measuredAtDate = new Date(reading.timestamp);
    const exists = await this.repo.findOne({
      where: {
        locationId: reading.locationId,
        measuredAt: measuredAtDate,
      },
    });

    if (exists) {
      return null;
    }

    const measurement = this.repo.create({
      locationId: reading.locationId,
      locationName: reading.locationName,
      aqi: reading.aqi,
      level: reading.level,
      pm10: reading.pm10,
      pm2_5: reading.pm2_5,
      no2: reading.no2,
      ozone: reading.ozone,
      co: reading.co,
      so2: reading.so2,
      nh3: reading.nh3,
      no: reading.no,
      latitude: reading.latitude,
      longitude: reading.longitude,
      measuredAt: measuredAtDate,
    });

    return this.repo.save(measurement);
  }

  async findHistory(
    locationId: string,
    limit = 100,
  ): Promise<Measurement[]> {
    return this.repo.find({
      where: { locationId },
      order: { measuredAt: "DESC" },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  }

  async exportData(
    startDate?: string,
    endDate?: string,
  ): Promise<Measurement[]> {
    const qb = this.repo
      .createQueryBuilder("m")
      .orderBy("m.measuredAt", "DESC")
      .addOrderBy("m.locationId", "ASC");

    if (startDate) {
      qb.andWhere("m.measuredAt >= :startDate", {
        startDate: new Date(startDate).toISOString(),
      });
    }
    if (endDate) {
      qb.andWhere("m.measuredAt <= :endDate", {
        endDate: new Date(endDate + "T23:59:59Z").toISOString(),
      });
    }

    return qb.getMany();
  }

  async findLatestPerLocation(): Promise<any[]> {
    const locations = await this.locationsService.getAllLocations();
    const validIds = locations.map((n) => n.id);
    const measurements = await this.repo
      .createQueryBuilder("m")
      .where("m.locationId IN (:...validIds)", { validIds })
      .distinctOn(["m.locationId"])
      .orderBy("m.locationId", "ASC")
      .addOrderBy("m.measuredAt", "DESC")
      .getMany();

    const locationMap = new Map(locations.map((loc) => [loc.id, loc.state]));
    return measurements.map((m) => ({
      ...m,
      state: locationMap.get(m.locationId) || "BR",
    }));
  }

  async findLatestForLocation(
    locationId: string,
  ): Promise<Measurement | null> {
    return this.repo.findOne({
      where: { locationId },
      order: { measuredAt: "DESC" },
    });
  }

  async getStats(): Promise<DashboardStats> {
    const latest = await this.findLatestPerLocation();
    const withAqi = latest.filter(
      (m): m is Measurement & { aqi: number } => typeof m.aqi === "number",
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
          locationName: sorted[0].locationName,
          aqi: sorted[0].aqi,
          level: sorted[0].level,
        }
      : null;
    const best = sorted[sorted.length - 1]
      ? {
          locationName: sorted[sorted.length - 1].locationName,
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
      monitoredLocations: latest.length,
      totalMeasurements,
      averageAqi,
      worst,
      best,
      distribution,
      updatedAt: new Date().toISOString(),
    };
  }

  async getRanking(
    index: string,
    period: string,
  ): Promise<RankingResult> {
    const validIndexes = ['aqi', 'pm2_5', 'pm10', 'no2', 'ozone', 'co', 'so2', 'nh3', 'no'];
    const col = validIndexes.includes(index) ? index : 'aqi';

    // Calculate start date based on period
    const now = new Date();
    let startDate: Date | null = null;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '180d':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 'all'
        startDate = null;
    }

    const qb = this.repo
      .createQueryBuilder('m')
      .select('m.locationId', 'locationId')
      .addSelect('m.locationName', 'locationName')
      .addSelect(`AVG(m.${col})`, 'avgValue')
      .addSelect('l.state', 'state')
      .leftJoin('locations', 'l', 'l.id = m.locationId')
      .where(`m.${col} IS NOT NULL`)
      .groupBy('m.locationId')
      .addGroupBy('m.locationName')
      .addGroupBy('l.state');

    if (startDate) {
      qb.andWhere('m.measuredAt >= :startDate', {
        startDate: startDate.toISOString(),
      });
    }

    const rawWorst = await qb
      .clone()
      .orderBy('"avgValue"', 'DESC')
      .limit(5)
      .getRawMany();

    const rawBest = await qb
      .clone()
      .orderBy('"avgValue"', 'ASC')
      .limit(5)
      .getRawMany();

    const mapEntry = (row: any): RankingEntry => ({
      locationName: row.locationName || 'Desconhecido',
      state: row.state || '-',
      value: row.avgValue != null ? Math.round(parseFloat(row.avgValue) * 10) / 10 : 0,
    });

    return {
      index: col,
      period,
      worst: rawWorst.map(mapEntry),
      best: rawBest.map(mapEntry),
    };
  }

  @Cron("0 3 * * *") // Runs every day at 03:00 AM
  async cleanupOldMeasurements(): Promise<void> {
    const retentionDays = 30;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

    this.logger.log(`Starting cleanup of measurements older than ${retentionDays} days (${thresholdDate.toISOString()})`);
    
    try {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .where("measuredAt < :thresholdDate", { thresholdDate })
        .execute();
      
      this.logger.log(`Cleanup finished. Deleted ${result.affected} old measurements.`);
    } catch (error) {
      this.logger.error(`Error cleaning up old measurements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
