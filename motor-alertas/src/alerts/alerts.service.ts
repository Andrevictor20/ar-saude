import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository, In } from 'typeorm';

import { SAO_LUIS_NEIGHBORHOODS } from '../common/constants/neighborhoods';

import { Alert } from '../entities/alert.entity';
import { AlertsEventsService } from './alerts-events.service';
import { InterscityReading } from '../interscity/interscity-reader.service';
import { AlertSeverity, severityForAqi } from '../common/air-quality';

const POLLUTANT_THRESHOLDS = {
  pm2_5: 15,
  pm10: 45,
  no2: 25,
  ozone: 100,
  so2: 40,
  co: 4000,
};

export interface AlertFilters {
  status?: 'active' | 'resolved';
  neighborhoodId?: string;
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
  ) {
    this.threshold = Number(
      this.configService.get('ALERT_AQI_THRESHOLD', 61),
    );
  }

  getThreshold(): number {
    return this.threshold;
  }

  async evaluate(reading: InterscityReading): Promise<void> {
    const active = await this.repo.findOne({
      where: { neighborhoodId: reading.neighborhoodId, status: 'active' },
    });

    const aqi = reading.aqi;
    const breachedAqi = aqi !== null && aqi >= this.threshold;
    const breachedPm25 = reading.pm2_5 !== null && reading.pm2_5 > POLLUTANT_THRESHOLDS.pm2_5;
    const breachedPm10 = reading.pm10 !== null && reading.pm10 > POLLUTANT_THRESHOLDS.pm10;
    const breachedNo2 = reading.no2 !== null && reading.no2 > POLLUTANT_THRESHOLDS.no2;
    const breachedOzone = reading.ozone !== null && reading.ozone > POLLUTANT_THRESHOLDS.ozone;
    const breachedSo2 = reading.so2 !== null && reading.so2 > POLLUTANT_THRESHOLDS.so2;
    const breachedCo = reading.co !== null && reading.co > POLLUTANT_THRESHOLDS.co;

    const breached = breachedAqi || breachedPm25 || breachedPm10 || breachedNo2 || breachedOzone || breachedSo2 || breachedCo;

    if (breached) {
      const triggeredBy: string[] = [];
      if (breachedAqi) triggeredBy.push(`AQI`);
      if (breachedPm25) triggeredBy.push(`PM2.5 (${reading.pm2_5} µg/m³)`);
      if (breachedPm10) triggeredBy.push(`PM10 (${reading.pm10} µg/m³)`);
      if (breachedNo2) triggeredBy.push(`NO2 (${reading.no2} µg/m³)`);
      if (breachedOzone) triggeredBy.push(`O3 (${reading.ozone} µg/m³)`);
      if (breachedSo2) triggeredBy.push(`SO2 (${reading.so2} µg/m³)`);
      if (breachedCo) triggeredBy.push(`CO (${reading.co} µg/m³)`);

      const severity = severityForAqi(aqi) ?? 'atencao';
      const safeAqi = aqi ?? 0;

      if (active) {
        active.aqi = safeAqi;
        active.peakAqi = Math.max(active.peakAqi, safeAqi);
        active.level = reading.level;
        active.severity = severity;
        active.message = this.buildMessage(reading, severity, triggeredBy);
        active.triggeredBy = triggeredBy;
        const saved = await this.repo.save(active);
        this.events.emit({ type: 'updated', alert: saved });
      } else {
        const alert = this.repo.create({
          neighborhoodId: reading.neighborhoodId,
          neighborhoodName: reading.neighborhoodName,
          resourceUuid: reading.resourceUuid,
          aqi: safeAqi,
          peakAqi: safeAqi,
          level: reading.level,
          severity,
          message: this.buildMessage(reading, severity, triggeredBy),
          triggeredBy,
          status: 'active',
          latitude: reading.latitude,
          longitude: reading.longitude,
          resolvedAt: null,
        });
        const saved = await this.repo.save(alert);
        this.logger.warn(
          `Alerta gerado: ${saved.neighborhoodName} AQI ${saved.aqi} (${saved.severity})`,
        );
        this.events.emit({ type: 'created', alert: saved });
      }
    } else if (active) {
      active.status = 'resolved';
      active.resolvedAt = new Date();
      const saved = await this.repo.save(active);
      this.logger.log(
        `Alerta resolvido: ${saved.neighborhoodName} (AQI atual ${aqi ?? 'indisponivel'})`,
      );
      this.events.emit({ type: 'resolved', alert: saved });
    }
  }

  async findAll(filters: AlertFilters = {}): Promise<Alert[]> {
    const validIds = SAO_LUIS_NEIGHBORHOODS.map(n => n.id);
    const where: FindOptionsWhere<Alert> = { neighborhoodId: In(validIds) };
    if (filters.status) where.status = filters.status;
    if (filters.neighborhoodId && validIds.includes(filters.neighborhoodId)) {
       where.neighborhoodId = filters.neighborhoodId;
    }
    if (filters.severity) where.severity = filters.severity;

    return this.repo.find({
      where,
      order: { triggeredAt: 'DESC' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 1000),
    });
  }

  async findActive(): Promise<Alert[]> {
    const validIds = SAO_LUIS_NEIGHBORHOODS.map(n => n.id);
    return this.repo.find({
      where: { status: 'active', neighborhoodId: In(validIds) },
      order: { aqi: 'DESC' },
    });
  }

  async countActive(): Promise<number> {
    const validIds = SAO_LUIS_NEIGHBORHOODS.map(n => n.id);
    return this.repo.count({ where: { status: 'active', neighborhoodId: In(validIds) } });
  }

  private buildMessage(
    reading: InterscityReading,
    severity: AlertSeverity,
    triggeredBy?: string[],
  ): string {
    const labels: Record<AlertSeverity, string> = {
      atencao: 'Atencao',
      alerta: 'Alerta',
      critico: 'Critico',
      emergencia: 'Emergencia',
    };
    const baseMessage = `${labels[severity]}: qualidade do ar ${reading.level} em ${reading.neighborhoodName}`;
    const aqiMsg = reading.aqi !== null ? `(AQI ${reading.aqi})` : '(AQI Indisponivel)';

    if (triggeredBy && triggeredBy.length > 0) {
      const specificCauses = triggeredBy.filter(c => c !== 'AQI');
      if (specificCauses.length > 0) {
        return `${baseMessage}. Níveis críticos detectados para: ${specificCauses.join(', ')}. ${aqiMsg}.`;
      }
    }

    return `${baseMessage} ${aqiMsg}.`;
  }
}
