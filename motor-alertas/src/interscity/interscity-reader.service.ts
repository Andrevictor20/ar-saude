import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

import { retryWithBackoff } from '../common/retry';
import {
  AirQualityLevel,
  classifyAqi,
  slugify,
} from '../common/air-quality';
import { SAO_LUIS_NEIGHBORHOODS } from '../common/constants/neighborhoods';

export interface InterscityEndpoint {
  name: string;
  catalogUrl: string;
  collectorUrl: string;
}

export interface InterscityHealth {
  active: string;
  primaryUp: boolean;
  fallbackUp: boolean;
  lastCheckedAt: string | null;
}

export interface InterscityResource {
  resourceUuid: string;
  neighborhoodId: string;
  neighborhoodName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface InterscityReading {
  resourceUuid: string;
  neighborhoodId: string;
  neighborhoodName: string;
  latitude: number | null;
  longitude: number | null;
  aqi: number | null;
  level: AirQualityLevel;
  pm10: number | null;
  pm2_5: number | null;
  no2: number | null;
  ozone: number | null;
  co: number | null;
  so2: number | null;
  nh3: number | null;
  no: number | null;
  measuredAt: Date;
}

const RESOURCE_DESCRIPTION_PREFIX = 'Monitoramento Ar-Saude - Bairro: ';

interface SeriesEntry {
  value: unknown;
  date?: string;
  timestamp?: string;
}

@Injectable()
export class InterscityReaderService implements OnModuleInit {
  private readonly logger = new Logger(InterscityReaderService.name);

  private readonly primaryEndpoint: InterscityEndpoint;
  private readonly fallbackEndpoint: InterscityEndpoint;
  private activeEndpoint: InterscityEndpoint;

  private health: InterscityHealth = {
    active: '',
    primaryUp: false,
    fallbackUp: false,
    lastCheckedAt: null,
  };

  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly catalogPageSize: number;
  private readonly healthTimeoutMs: number;
  private readonly firstHealthTimeoutMs: number;

  private firstCheckDone = false;
  private chaosPrimaryDown = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.primaryEndpoint = {
      name: 'primary',
      catalogUrl: this.configService.get<string>(
        'INTERSCITY_CATALOG_URL',
        'https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog',
      ),
      collectorUrl: this.configService.get<string>(
        'INTERSCITY_COLLECTOR_URL',
        'https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/collector',
      ),
    };

    this.fallbackEndpoint = {
      name: 'fallback',
      catalogUrl: this.configService.get<string>(
        'INTERSCITY_CATALOG_URL_FALLBACK',
        'https://interscity.rasppi.cloud/catalog',
      ),
      collectorUrl: this.configService.get<string>(
        'INTERSCITY_COLLECTOR_URL_FALLBACK',
        'https://interscity.rasppi.cloud/collector',
      ),
    };

    this.activeEndpoint = this.primaryEndpoint;
    this.health.active = this.activeEndpoint.name;

    this.maxRetries = Number(this.configService.get('MAX_RETRIES', 5));
    this.retryBaseDelay = Number(
      this.configService.get('RETRY_BASE_DELAY_MS', 1000),
    );
    this.catalogPageSize = Number(
      this.configService.get('CATALOG_PAGE_SIZE', 500),
    );
    this.healthTimeoutMs = this.configService.get<number>(
      'INTERSCITY_HEALTH_TIMEOUT_MS',
      8000,
    );
    this.firstHealthTimeoutMs = this.configService.get<number>(
      'INTERSCITY_FIRST_HEALTH_TIMEOUT_MS',
      30_000,
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Inicializando InterscityReaderService e checando health...');
    await this.checkHealth();
  }

  private async isEndpointUp(
    endpoint: InterscityEndpoint,
    timeoutMs: number = this.healthTimeoutMs,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${endpoint.catalogUrl}/resources`, {
          timeout: timeoutMs,
          params: { per_page: 1 },
        }),
      );
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.debug(
        `Healthcheck DOWN para ${endpoint.name} (${endpoint.catalogUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  async checkHealth(): Promise<InterscityHealth> {
    const timeoutMs = this.firstCheckDone ? this.healthTimeoutMs : this.firstHealthTimeoutMs;

    if (!this.firstCheckDone) {
      this.logger.log(`⏳ Primeiro healthcheck do InterSCity (timeout ${timeoutMs}ms)...`);
    }

    const [primaryProbe, fallbackUp] = await Promise.all([
      this.isEndpointUp(this.primaryEndpoint, timeoutMs),
      this.isEndpointUp(this.fallbackEndpoint, timeoutMs),
    ]);

    const primaryUp = this.chaosPrimaryDown ? false : primaryProbe;
    if (this.chaosPrimaryDown) {
      this.logger.warn('🧪 [CHAOS] Primário do InterSCity forçado como DOWN no Motor de Alertas.');
    }

    this.firstCheckDone = true;
    const previous = this.activeEndpoint.name;

    if (primaryUp) {
      this.activeEndpoint = this.primaryEndpoint;
    } else if (fallbackUp) {
      this.activeEndpoint = this.fallbackEndpoint;
    }

    if (this.activeEndpoint.name !== previous) {
      this.logger.warn(`🔀 Failover: endpoint ativo ${previous} → ${this.activeEndpoint.name}`);
    }

    this.health = {
      active: this.activeEndpoint.name,
      primaryUp,
      fallbackUp,
      lastCheckedAt: new Date().toISOString(),
    };

    const overall = primaryUp ? '🟢' : fallbackUp ? '🟡' : '🔴';
    this.logger.log(
      `${overall} Healthcheck Leitor - primário: ${primaryUp ? 'UP' : 'DOWN'} | fallback: ${
        fallbackUp ? 'UP' : 'DOWN'
      } | ativo: ${this.activeEndpoint.name}`,
    );

    return this.health;
  }

  @Interval('interscity-health-reader', 60_000)
  async scheduledHealthCheck(): Promise<void> {
    await this.checkHealth();
  }

  getHealth(): InterscityHealth {
    return this.health;
  }

  async setChaosPrimaryDown(down: boolean): Promise<InterscityHealth> {
    this.chaosPrimaryDown = down;
    this.logger.warn(`🧪 [CHAOS] Simulação de primário DOWN no Motor ${down ? 'ATIVADA' : 'DESATIVADA'}.`);
    return this.checkHealth();
  }

  isChaosPrimaryDown(): boolean {
    return this.chaosPrimaryDown;
  }

  async fetchResources(): Promise<InterscityResource[]> {
    const response = await retryWithBackoff(
      () =>
        firstValueFrom(
          this.httpService.get(`${this.activeEndpoint.catalogUrl}/resources`, {
            params: { per_page: this.catalogPageSize },
          }),
        ),
      this.maxRetries,
      this.retryBaseDelay,
      'InterSCity.fetchResources',
    );

    const resources: any[] = response.data?.resources ?? [];

    const mappedResources = resources
      .filter(
        (r) =>
          typeof r?.description === 'string' &&
          (r.description.includes('Ar-Saúde') || r.description.includes('Ar-Saude')),
      )
      .map((r) => {
        const name = this.parseNeighborhoodName(r.description);
        return {
          resourceUuid: r.uuid,
          neighborhoodId: slugify(name),
          neighborhoodName: name,
          latitude: this.toNumber(r.lat),
          longitude: this.toNumber(r.lon),
        };
      })
      .filter((r) => Boolean(r.resourceUuid) && SAO_LUIS_NEIGHBORHOODS.some(n => n.id === r.neighborhoodId));

    // Remove duplicatas mantendo apenas o UUID mais recente (primeiro que aparece na API)
    const uniqueResources = new Map<string, InterscityResource>();
    for (const res of mappedResources) {
      if (!uniqueResources.has(res.neighborhoodId)) {
        uniqueResources.set(res.neighborhoodId, res);
      }
    }

    return Array.from(uniqueResources.values());
  }

  async fetchLatestReading(
    resource: InterscityResource,
  ): Promise<InterscityReading | null> {
    let response;
    try {
      response = await retryWithBackoff(
        () =>
          firstValueFrom(
            this.httpService.get(
              `${this.activeEndpoint.collectorUrl}/resources/${resource.resourceUuid}/data`,
            ),
          ),
        this.maxRetries,
        this.retryBaseDelay,
        `InterSCity.fetchData(${resource.neighborhoodId})`,
        (error) => !this.isNotFound(error),
      );
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      throw error;
    }

    const capabilities = response.data?.resources?.[0]?.capabilities;
    if (!capabilities || Object.keys(capabilities).length === 0) {
      return null;
    }

    const aqi = this.latestNumber(capabilities.air_quality_index);
    const measuredAt = this.latestTimestamp(capabilities.air_quality_index);

    if (!measuredAt) {
      return null;
    }

    return {
      resourceUuid: resource.resourceUuid,
      neighborhoodId: resource.neighborhoodId,
      neighborhoodName: resource.neighborhoodName,
      latitude: resource.latitude,
      longitude: resource.longitude,
      aqi,
      level: classifyAqi(aqi),
      pm10: this.latestNumber(capabilities.pm10),
      pm2_5: this.latestNumber(capabilities.pm2_5),
      no2: this.latestNumber(capabilities.no2),
      ozone: this.latestNumber(capabilities.ozone),
      co: this.latestNumber(capabilities.co),
      so2: this.latestNumber(capabilities.so2),
      nh3: this.latestNumber(capabilities.nh3),
      no: this.latestNumber(capabilities.no),
      measuredAt,
    };
  }

  private parseNeighborhoodName(description: string): string {
    const idx = description.indexOf('Bairro: ');
    if (idx >= 0) {
      return description.slice(idx + 'Bairro: '.length).trim();
    }
    return description.replace(RESOURCE_DESCRIPTION_PREFIX, '').trim();
  }

  private latestEntry(series: SeriesEntry[] | undefined): SeriesEntry | null {
    if (!Array.isArray(series) || series.length === 0) return null;
    return series[series.length - 1];
  }

  private latestNumber(series: SeriesEntry[] | undefined): number | null {
    const entry = this.latestEntry(series);
    return entry ? this.toNumber(entry.value) : null;
  }

  private latestTimestamp(series: SeriesEntry[] | undefined): Date | null {
    const entry = this.latestEntry(series);
    const raw = entry?.date ?? entry?.timestamp;
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  private isNotFound(error: unknown): boolean {
    return (
      (error as { response?: { status?: number } })?.response?.status === 404
    );
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
}
