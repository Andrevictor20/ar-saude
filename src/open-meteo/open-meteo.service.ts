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

/**
 * =====================================================
 * OpenMeteoService — Serviço de Coleta de Dados
 * =====================================================
 *
 * Responsável por:
 * 1. Consultar a API pública Open-Meteo (Air Quality API).
 * 2. Extrair as métricas de qualidade do ar (AQI, PM10, PM2.5, NO2, O3).
 * 3. Classificar o nível de qualidade do ar (Bom → Perigoso).
 * 4. Aplicar retry com backoff exponencial para resiliência.
 *
 * A API Open-Meteo é gratuita e não exige chave de API,
 * porém aplica rate limiting. O mecanismo de retry mitiga
 * eventuais bloqueios por excesso de requisições.
 *
 * Endpoint utilizado:
 *   GET https://air-quality-api.open-meteo.com/v1/air-quality
 *       ?latitude=-2.5293
 *       &longitude=-44.3028
 *       &current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone
 */
@Injectable()
export class OpenMeteoService {
  private readonly logger = new Logger(OpenMeteoService.name);

  /** URL base da API Open-Meteo (configurável via .env) */
  private readonly baseUrl: string;

  /** Coordenadas geográficas de São Luís, MA */
  private readonly latitude: number;
  private readonly longitude: number;

  /** Configurações de retry */
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
    this.latitude = this.configService.get<number>('LATITUDE', -2.5293);
    this.longitude = this.configService.get<number>('LONGITUDE', -44.3028);
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
  }

  /**
   * Busca os dados atuais de qualidade do ar na API Open-Meteo.
   *
   * Utiliza o endpoint `current` para obter a medição mais recente,
   * que inclui:
   * - european_aqi: Índice de Qualidade do Ar Europeu
   * - pm10: Material particulado ≤10µm (µg/m³)
   * - pm2_5: Material particulado ≤2.5µm (µg/m³)
   * - nitrogen_dioxide: NO₂ (µg/m³)
   * - ozone: O₃ (µg/m³)
   *
   * @returns Dados processados de qualidade do ar com classificação.
   * @throws Erro após esgotar todas as tentativas de retry.
   */
  async fetchAirQuality(): Promise<ProcessedAirQualityData> {
    this.logger.log(
      `Iniciando coleta de dados para lat=${this.latitude}, lon=${this.longitude}`,
    );

    // A chamada HTTP é encapsulada no retryWithBackoff para resiliência
    const rawData = await retryWithBackoff<AirQualityData>(
      () => this.callOpenMeteoApi(),
      this.maxRetries,
      this.retryBaseDelay,
      'OpenMeteo.fetchAirQuality',
    );

    // Processa e enriquece os dados com classificação e localização
    const processed: ProcessedAirQualityData = {
      ...rawData,
      level: this.classifyAqi(rawData.aqi),
      latitude: this.latitude,
      longitude: this.longitude,
    };

    this.logger.log(
      `✅ Dados coletados com sucesso — AQI: ${processed.aqi} (${processed.level})`,
    );

    return processed;
  }

  /**
   * Realiza a chamada HTTP efetiva à API Open-Meteo.
   * Método separado para facilitar o encapsulamento no retry.
   */
  private async callOpenMeteoApi(): Promise<AirQualityData> {
    const params = {
      latitude: this.latitude,
      longitude: this.longitude,
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

    // Mapeia os campos da API para a interface interna
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

  /**
   * Classifica o nível de qualidade do ar com base no AQI europeu.
   *
   * Faixas (European AQI):
   * | Faixa   | Classificação                |
   * |---------|------------------------------|
   * | 0–20    | Bom                          |
   * | 21–40   | Moderado                     |
   * | 41–60   | Ruim para grupos sensíveis   |
   * | 61–80   | Ruim                         |
   * | 81–100  | Muito Ruim                   |
   * | >100    | Perigoso                     |
   *
   * @param aqi Valor do AQI europeu
   * @returns Classificação textual em português
   */
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
