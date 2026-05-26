import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import {
  AirQualityData,
  AirQualityLevel,
  ProcessedAirQualityData,
} from '../common/interfaces/index.js';
import { retryWithBackoff } from '../common/utils/retry.util.js';
import { Neighborhood } from '../common/constants/neighborhoods.js';

/** Serviço de coleta de dados de qualidade do ar via API Open-Meteo. */
@Injectable()
export class OpenMeteoService {
  private readonly logger = new Logger(OpenMeteoService.name);

  private readonly baseUrl: string;

  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OPEN_METEO_BASE_URL',
      'https://air-quality-api.open-meteo.com/v1/air-quality',
    );
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
  }

  /** Busca dados atuais de qualidade do ar para um bairro. */
  async fetchAirQuality(neighborhood: Neighborhood): Promise<ProcessedAirQualityData> {
    this.logger.log(
      `Iniciando coleta de dados para bairro ${neighborhood.name} (lat=${neighborhood.latitude}, lon=${neighborhood.longitude})`,
    );

    const rawData = await retryWithBackoff<AirQualityData>(
      () => this.callOpenMeteoApi(neighborhood.latitude, neighborhood.longitude),
      this.maxRetries,
      this.retryBaseDelay,
      `OpenMeteo.fetchAirQuality(${neighborhood.id})`,
    );

    const processed: ProcessedAirQualityData = {
      ...rawData,
      level: this.classifyAqi(rawData.aqi),
      neighborhoodId: neighborhood.id,
      neighborhoodName: neighborhood.name,
      latitude: neighborhood.latitude,
      longitude: neighborhood.longitude,
    };

    this.logger.log(
      `✅ Dados coletados com sucesso — AQI: ${processed.aqi} (${processed.level})`,
    );

    return processed;
  }

  /** Chamada HTTP efetiva à API Open-Meteo. */
  private async callOpenMeteoApi(latitude: number, longitude: number): Promise<AirQualityData> {
    const params = {
      latitude,
      longitude,
      current: 'european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone',
    };

    const response = await firstValueFrom(
      this.httpService.get(this.baseUrl, { params }),
    );

    const current = response.data?.current;

    if (!current) {
      throw new Error(
        'Resposta da API Open-Meteo não contém dados "current". ' +
          `Resposta recebida: ${JSON.stringify(response.data).substring(0, 200)}`,
      );
    }

    const airQuality: AirQualityData = {
      timestamp: current.time ?? new Date().toISOString(),
      aqi: current.european_aqi ?? null,
      pm10: current.pm10 ?? null,
      pm2_5: current.pm2_5 ?? null,
      no2: current.nitrogen_dioxide ?? null,
      ozone: current.ozone ?? null,
    };

    return airQuality;
  }

  /** Classifica o nível de qualidade do ar com base no AQI europeu. */
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
