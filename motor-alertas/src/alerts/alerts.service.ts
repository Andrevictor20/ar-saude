import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { Alert } from '../entities/alert.entity';
import { AlertsEventsService } from './alerts-events.service';
import { InterscityReading } from '../interscity/interscity-reader.service';
import { AlertSeverity, severityForAqi } from '../common/air-quality';

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
    const breached = aqi !== null && aqi >= this.threshold;

    if (breached) {
      const severity = severityForAqi(aqi) ?? 'atencao';
      if (active) {
        active.aqi = aqi as number;
        active.peakAqi = Math.max(active.peakAqi, aqi as number);
        active.level = reading.level;
        active.severity = severity;
        active.message = this.buildMessage(reading, severity);
        const saved = await this.repo.save(active);
        this.events.emit({ type: 'updated', alert: saved });
      } else {
        const alert = this.repo.create({
          neighborhoodId: reading.neighborhoodId,
          neighborhoodName: reading.neighborhoodName,
          resourceUuid: reading.resourceUuid,
          aqi: aqi as number,
          peakAqi: aqi as number,
          level: reading.level,
          severity,
          message: this.buildMessage(reading, severity),
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
    const where: FindOptionsWhere<Alert> = {};
    if (filters.status) where.status = filters.status;
    if (filters.neighborhoodId) where.neighborhoodId = filters.neighborhoodId;
    if (filters.severity) where.severity = filters.severity;

    return this.repo.find({
      where,
      order: { triggeredAt: 'DESC' },
      take: Math.min(Math.max(filters.limit ?? 100, 1), 1000),
    });
  }

  async findActive(): Promise<Alert[]> {
    return this.repo.find({
      where: { status: 'active' },
      order: { aqi: 'DESC' },
    });
  }

  async countActive(): Promise<number> {
    return this.repo.count({ where: { status: 'active' } });
  }

  private buildMessage(
    reading: InterscityReading,
    severity: AlertSeverity,
  ): string {
    const labels: Record<AlertSeverity, string> = {
      atencao: 'Atencao',
      alerta: 'Alerta',
      critico: 'Critico',
      emergencia: 'Emergencia',
    };
    return `${labels[severity]}: qualidade do ar ${reading.level} em ${reading.neighborhoodName} (AQI ${reading.aqi}).`;
  }
}
