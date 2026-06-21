import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { retryWithBackoff } from '../common/utils/retry.util.js';
import { CacheService } from '../common/cache/cache.service.js';

export interface ExtraPollutants {
  co: number | null;
  so2: number | null;
  nh3: number | null;
  no: number | null;
}

interface OpenWeatherApiResponse {
  list?: Array<{
    components?: {
      co?: number;
      so2?: number;
      nh3?: number;
      no?: number;
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

    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
    this.cacheTtlMs = this.configService.get<number>('CACHE_TTL_MS', 600_000);
  }

  /** Busca APENAS os poluentes complementares (CO, SO₂, NH₃, NO). */
  async fetchExtraPollutants(
    latitude: number,
    longitude: number,
    neighborhoodName: string,
  ): Promise<ExtraPollutants> {
    if (!this.apiKey) {
      return { co: null, so2: null, nh3: null, no: null };
    }

    this.logger.debug(
      `Coletando dados extras para ${neighborhoodName} via OpenWeatherMap...`,
    );

    const cacheKey = `owm:${latitude},${longitude}`;

    const data = await this.cacheService.wrap<ExtraPollutants>(
      cacheKey,
      this.cacheTtlMs,
      () =>
        retryWithBackoff<ExtraPollutants>(
          () => this.callOpenWeatherApi(latitude, longitude),
          this.maxRetries,
          this.retryBaseDelay,
          `OpenWeather.fetchExtraPollutants(${neighborhoodName})`,
        ),
    );

    return data;
  }



  private async callOpenWeatherApi(
    latitude: number,
    longitude: number,
  ): Promise<ExtraPollutants> {
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

    return {
      co: components.co ?? null,
      so2: components.so2 ?? null,
      nh3: components.nh3 ?? null,
      no: components.no ?? null,
    };
  }
}
