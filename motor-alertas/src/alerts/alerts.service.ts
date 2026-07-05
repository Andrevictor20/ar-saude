import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository, In } from "typeorm";

import { LocationsService } from "../locations/locations.service";

import { Alert } from "../entities/alert.entity";
import { AlertsEventsService } from "./alerts-events.service";
import { IngestMeasurementDto } from "../measurements/dto/ingest-measurement.dto";
import { AlertSeverity, severityForAqi } from "../common/air-quality";

const POLLUTANT_THRESHOLDS = {
  pm2_5: 15,
  pm10: 45,
  no2: 25,
  ozone: 100,
  so2: 40,
  co: 4000,
};

export interface AlertFilters {
  status?: "active" | "resolved";
  locationId?: string;
  severity?: AlertSeverity;
  limit?: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly threshold: number;

  constructor(
    @InjectRepository(Alert)
    private readonly repo: Repository<Alert>,
    private readonly events: AlertsEventsService,
    private readonly configService: ConfigService,
    private readonly locationsService: LocationsService,
  ) {
    this.threshold = Number(this.configService.get("ALERT_AQI_THRESHOLD", 61));
  }

  getThreshold(): number {
    return this.threshold;
  }

  async evaluate(reading: IngestMeasurementDto): Promise<void> {
    const active = await this.repo.findOne({
      where: { locationId: reading.locationId, status: "active" },
    });

    const aqi = reading.aqi;
    const breachedAqi = aqi !== null && aqi >= this.threshold;
    const breachedPm25 =
      reading.pm2_5 !== null && reading.pm2_5 > POLLUTANT_THRESHOLDS.pm2_5;
    const breachedPm10 =
      reading.pm10 !== null && reading.pm10 > POLLUTANT_THRESHOLDS.pm10;
    const breachedNo2 =
      reading.no2 !== null && reading.no2 > POLLUTANT_THRESHOLDS.no2;
    const breachedOzone =
      reading.ozone !== null && reading.ozone > POLLUTANT_THRESHOLDS.ozone;
    const breachedSo2 =
      reading.so2 !== null && reading.so2 > POLLUTANT_THRESHOLDS.so2;
    const breachedCo =
      reading.co !== null && reading.co > POLLUTANT_THRESHOLDS.co;

    const breached =
      breachedAqi ||
      breachedPm25 ||
      breachedPm10 ||
      breachedNo2 ||
      breachedOzone ||
      breachedSo2 ||
      breachedCo;

    if (breached) {
      const triggeredBy: string[] = [];
      if (breachedAqi) triggeredBy.push(`AQI`);
      if (breachedPm25) triggeredBy.push(`PM2.5 (${reading.pm2_5} µg/m³)`);
      if (breachedPm10) triggeredBy.push(`PM10 (${reading.pm10} µg/m³)`);
      if (breachedNo2) triggeredBy.push(`NO2 (${reading.no2} µg/m³)`);
      if (breachedOzone) triggeredBy.push(`O3 (${reading.ozone} µg/m³)`);
      if (breachedSo2) triggeredBy.push(`SO2 (${reading.so2} µg/m³)`);
      if (breachedCo) triggeredBy.push(`CO (${reading.co} µg/m³)`);

      const severity = severityForAqi(aqi) ?? "atencao";
      const safeAqi = aqi ?? 0;

      if (active) {
        active.aqi = safeAqi;
        active.peakAqi = Math.max(active.peakAqi, safeAqi);
        active.level = reading.level;
        active.severity = severity;
        active.message = this.buildMessage(reading, severity, triggeredBy);
        active.triggeredBy = triggeredBy;
        const saved = await this.repo.save(active);
        this.events.emit({ type: "updated", alert: saved });
      } else {
        const alert = this.repo.create({
          locationId: reading.locationId,
          locationName: reading.locationName,
          aqi: safeAqi,
          peakAqi: safeAqi,
          level: reading.level,
          severity,
          message: this.buildMessage(reading, severity, triggeredBy),
          triggeredBy,
          status: "active",
          latitude: reading.latitude,
          longitude: reading.longitude,
          resolvedAt: null,
        });
        const saved = await this.repo.save(alert);
        this.logger.warn(
          `Alerta gerado: ${saved.locationName} AQI ${saved.aqi} (${saved.severity})`,
        );
        this.events.emit({ type: "created", alert: saved });
      }
    } else if (active) {
      active.status = "resolved";
      active.resolvedAt = new Date();
      const saved = await this.repo.save(active);
      this.logger.log(
        `Alerta resolvido: ${saved.locationName} (AQI atual ${aqi ?? "indisponivel"})`,
      );
      this.events.emit({ type: "resolved", alert: saved });
    }
  }

  async findAll(filters: AlertFilters = {}): Promise<Alert[]> {
    const locations = await this.locationsService.getAllLocations();
    const validIds = locations.map((n) => n.id);
    const where: FindOptionsWhere<Alert> = { locationId: In(validIds) };
    if (filters.status) where.status = filters.status;
    if (filters.locationId && validIds.includes(filters.locationId)) {
      where.locationId = filters.locationId;
    }
    if (filters.severity) where.severity = filters.severity;

    const alerts = await this.repo.find({
      where,
      order: { triggeredAt: "DESC" },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 1000),
    });

    const locationMap = new Map(locations.map((loc) => [loc.id, loc.state]));
    return alerts.map((a) => ({
      ...a,
      state: locationMap.get(a.locationId) || "BR",
    })) as any;
  }

  async findActive(): Promise<Alert[]> {
    const locations = await this.locationsService.getAllLocations();
    const validIds = locations.map((n) => n.id);
    const alerts = await this.repo.find({
      where: { status: "active", locationId: In(validIds) },
      order: { aqi: "DESC" },
    });

    const locationMap = new Map(locations.map((loc) => [loc.id, loc.state]));
    return alerts.map((a) => ({
      ...a,
      state: locationMap.get(a.locationId) || "BR",
    })) as any;
  }

  async countActive(): Promise<number> {
    const locations = await this.locationsService.getAllLocations();
    const validIds = locations.map((n) => n.id);
    return this.repo.count({
      where: { status: "active", locationId: In(validIds) },
    });
  }

  private buildMessage(
    reading: IngestMeasurementDto,
    severity: AlertSeverity,
    triggeredBy?: string[],
  ): string {
    const labels: Record<AlertSeverity, string> = {
      atencao: "Atencao",
      alerta: "Alerta",
      critico: "Critico",
      emergencia: "Emergencia",
    };
    const baseMessage = `${labels[severity]}: qualidade do ar ${reading.level} em ${reading.locationName}`;
    const aqiMsg =
      reading.aqi !== null ? `(AQI ${reading.aqi})` : "(AQI Indisponivel)";

    if (triggeredBy && triggeredBy.length > 0) {
      const specificCauses = triggeredBy.filter((c) => c !== "AQI");
      if (specificCauses.length > 0) {
        return `${baseMessage}. Níveis críticos detectados para: ${specificCauses.join(", ")}. ${aqiMsg}.`;
      }
    }

    return `${baseMessage} ${aqiMsg}.`;
  }

  @Cron("30 3 * * *") // Runs every day at 03:30 AM
  async cleanupOldAlerts(): Promise<void> {
    const retentionDays = 30;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - retentionDays);

    this.logger.log(`Starting cleanup of resolved alerts older than ${retentionDays} days (${thresholdDate.toISOString()})`);
    
    try {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .where("status = :status", { status: "resolved" })
        .andWhere("resolvedAt < :thresholdDate", { thresholdDate })
        .execute();
      
      this.logger.log(`Cleanup finished. Deleted ${result.affected} old resolved alerts.`);
    } catch (error) {
      this.logger.error(`Error cleaning up old alerts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
