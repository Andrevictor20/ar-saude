import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { retryWithBackoff } from '../common/utils/retry.util.js';
import { CacheService } from '../common/cache/cache.service.js';

import {
  AirQualityData,
  AirQualityLevel,
  ProcessedAirQualityData,
} from '../common/interfaces/index.js';

interface OpenWeatherApiResponse {
  list?: Array<{
    main?: {
      aqi?: number;
    };
    components?: {
      co?: number;
      so2?: number;
      nh3?: number;
      no?: number;
      no2?: number;
      o3?: number;
      pm2_5?: number;
      pm10?: number;
    };
  }>;
}

@Injectable()
export class OpenWeatherService {
  private readonly logger = new Logger(OpenWeatherService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OPENWEATHER_BASE_URL',
      'http://api.openweathermap.org/data/2.5/air_pollution',
    );
    this.apiKey = this.configService.get<string>('OPENWEATHER_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn('⚠️ OPENWEATHER_API_KEY não configurada!');
    }

    this.maxRetries = 5;
    this.retryBaseDelay = 500;
    this.cacheTtlMs = this.configService.get<number>('CACHE_TTL_MS', 600_000);
  }

  /** Busca os dados de qualidade do ar via OpenWeatherMap. */
  async fetchAirQuality(
    latitude: number,
    longitude: number,
    locationId: string,
    locationName: string,
  ): Promise<ProcessedAirQualityData> {
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY não configurada. Não é possível buscar dados.');
    }

    this.logger.debug(
      `Coletando qualidade do ar para ${locationName} via OpenWeatherMap...`,
    );

    const cacheKey = `owm:${latitude},${longitude}`;

    const rawData = await this.cacheService.wrap<AirQualityData>(
      cacheKey,
      this.cacheTtlMs,
      () =>
        retryWithBackoff<AirQualityData>(
          () => this.callOpenWeatherApi(latitude, longitude),
          this.maxRetries,
          this.retryBaseDelay,
          `OpenWeather.fetchAirQuality(${locationId})`,
        ),
    );

    const processed: ProcessedAirQualityData = {
      ...rawData,
      level: this.classifyAqi(rawData.aqi),
      locationId: locationId,
      locationName: locationName,
      latitude: latitude,
      longitude: longitude,
    };

    return processed;
  }

  private async callOpenWeatherApi(
    latitude: number,
    longitude: number,
  ): Promise<AirQualityData> {
    const params = {
      lat: latitude,
      lon: longitude,
      appid: this.apiKey,
    };

    const response = await firstValueFrom(
      this.httpService.get<OpenWeatherApiResponse>(this.baseUrl, { params }),
    );

    const components = response.data?.list?.[0]?.components;

    if (!components) {
      throw new Error(
        'Resposta da API OpenWeatherMap não contém dados de poluentes.',
      );
    }

    const pm2_5 = components.pm2_5 ?? null;
    const pm10 = components.pm10 ?? null;
    const aqiNum = this.calculateAqi(pm2_5, pm10);

    return {
      timestamp: new Date().toISOString(),
      aqi: aqiNum,
      pm10: pm10,
      pm2_5: pm2_5,
      no2: components.no2 ?? null,
      ozone: components.o3 ?? null,
      co: components.co ?? null,
      so2: components.so2 ?? null,
      nh3: components.nh3 ?? null,
      no: components.no ?? null,
    };
  }

  /** Calcula um AQI contínuo na escala 0-100+ baseado no padrão EAQI para PM2.5 e PM10. */
  private calculateAqi(pm2_5: number | null, pm10: number | null): number {
    if (pm2_5 === null && pm10 === null) return 0;
    
    const getPm25Aqi = (c: number) => {
      if (c <= 10) return (20 / 10) * c; // 0-20
      if (c <= 20) return 20 + (20 / 10) * (c - 10); // 20-40
      if (c <= 25) return 40 + (20 / 5) * (c - 20); // 40-60
      if (c <= 50) return 60 + (20 / 25) * (c - 25); // 60-80
      if (c <= 75) return 80 + (20 / 25) * (c - 50); // 80-100
      return 100 + (20 / 25) * (c - 75); // >100
    };

    const getPm10Aqi = (c: number) => {
      if (c <= 20) return (20 / 20) * c;
      if (c <= 40) return 20 + (20 / 20) * (c - 20);
      if (c <= 50) return 40 + (20 / 10) * (c - 40);
      if (c <= 100) return 60 + (20 / 50) * (c - 50);
      if (c <= 150) return 80 + (20 / 50) * (c - 100);
      return 100 + (20 / 50) * (c - 150);
    };

    const aqi25 = pm2_5 !== null ? getPm25Aqi(pm2_5) : 0;
    const aqi10 = pm10 !== null ? getPm10Aqi(pm10) : 0;
    
    return Math.round(Math.max(aqi25, aqi10));
  }

  /** Classifica o nível de qualidade do ar com base na escala numérica. */
  private classifyAqi(aqi: number | null): AirQualityLevel {
    if (aqi === null || aqi === undefined) return 'Indisponível';
    if (aqi <= 20) return 'Bom';
    if (aqi <= 40) return 'Moderado';
    if (aqi <= 60) return 'Ruim para grupos sensíveis';
    if (aqi <= 80) return 'Ruim';
    if (aqi <= 100) return 'Muito Ruim';
    return 'Perigoso';
  }
}
