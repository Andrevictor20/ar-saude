import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { OpenMeteoService } from '../open-meteo/open-meteo.service.js';
import {
  OpenWeatherService,
  ExtraPollutants,
} from '../open-weather/open-weather.service.js';
import { MotorAlertasService } from '../motor-alertas/motor-alertas.service.js';
import {
  RequestQueueService,
  QueueStats,
} from '../common/queue/request-queue.service.js';
import { MetricsService } from '../common/metrics/metrics.service.js';
import axios from 'axios';

// Location entity from API
export interface Location {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  ibgeCode: string;
}

/**
 * Orquestrador de coleta: Cron → Fila → (Open-Meteo + OpenWeather) → Motor de Alertas.
 *
 * Em vez de processar os locais inline (sequencialmente, com risco de perder
 * dados em caso de falha), o coletor agora apenas *enfileira* um job por local.
 * A fila processa os jobs com concorrência limitada, retry e dead-letter,
 * garantindo que nenhuma requisição se perca mesmo sob rajada.
 */
@Injectable()
export class CollectorService implements OnModuleInit {
  private readonly logger = new Logger(CollectorService.name);

  /** Contador de execuções para observabilidade */
  private executionCount = 0;

  constructor(
    private readonly openMeteoService: OpenMeteoService,
    private readonly openWeatherService: OpenWeatherService,
    private readonly motorAlertasService: MotorAlertasService,
    private readonly queue: RequestQueueService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  /** Configura a fila e registra o worker que processa cada bairro. */
  onModuleInit(): void {
    this.queue.configure({
      concurrency: this.configService.get<number>('QUEUE_CONCURRENCY', 5),
      maxAttempts: this.configService.get<number>('QUEUE_MAX_ATTEMPTS', 5),
      retryDelayMs: this.configService.get<number>('RETRY_BASE_DELAY_MS', 1000),
      drainTimeoutMs: this.configService.get<number>(
        'QUEUE_DRAIN_TIMEOUT_MS',
        10_000,
      ),
      rateLimitMs: 1200, // Strict limit of ~50 requests per minute to OpenWeatherMap
    });

    this.queue.setWorker<Location>((location) =>
      this.processLocation(location),
    );
  }

  /** Cron Job principal — apenas enfileira a coleta de todas as localidades. */
  @Cron(process.env.CRON_COLLECT_INTERVAL ?? '* * * * *', {
    name: 'air-quality-collection',
    timeZone: 'America/Sao_Paulo',
  })
  handleCollection(): void {
    this.executionCount++;
    this.metrics.incCollections();
    const executionId = this.executionCount;

    this.logger.log('═══════════════════════════════════════════════════');
    this.logger.log(
      `🔄 Execução #${executionId} — Buscando localidades e enfileirando coleta...`,
    );
    this.logger.log('═══════════════════════════════════════════════════');

    this.enqueueAllLocations();
  }

  /** Enfileira um job de coleta para cada localidade. */
  async enqueueAllLocations(): Promise<number> {
    try {
      const baseUrl = process.env.MOTOR_ALERTAS_URL || 'http://localhost:3001';
      const response = await axios.get<Location[]>(`${baseUrl}/locations`);
      const locations = response.data;

      const count = this.queue.enqueueMany<Location>(locations);
      this.logger.log(
        `📥 ${count} localidades enfileiradas. Fila: ${JSON.stringify(this.queue.getStats())}`,
      );
      return count;
    } catch (error) {
      this.logger.error('Failed to fetch locations for collection', error instanceof Error ? error.stack : String(error));
      return 0;
    }
  }

  /**
   * Processa uma única localidade: coleta (Open-Meteo + OpenWeather) e envia ao
   * Motor de Alertas. Lança erro em caso de falha no envio, para que a fila reenfileire.
   */
  private async processLocation(location: Location): Promise<void> {
    this.logger.debug(`--- Localidade: ${location.name} ---`);

    let airQualityData;
    
    try {
      airQualityData = await this.openMeteoService.fetchAirQuality(location);
      this.logger.debug(
        `[1/3] ✅ Open-Meteo — AQI: ${airQualityData.aqi} (${airQualityData.level}) | ` +
          `PM10: ${airQualityData.pm10} | PM2.5: ${airQualityData.pm2_5} | ` +
          `NO₂: ${airQualityData.no2} | O₃: ${airQualityData.ozone}`,
      );
    } catch (error) {
      this.logger.error(`❌ Falha no Open-Meteo para ${location.name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Re-throw the original error to be handled by the queue dead-letter/retry
    }

    let extraPollutants: ExtraPollutants = {
      co: null,
      so2: null,
      nh3: null,
      no: null,
    };
    try {
      extraPollutants = await this.openWeatherService.fetchExtraPollutants(
        location.latitude,
        location.longitude,
        location.name,
      );
      this.logger.debug(
        `[2/3] ✅ OpenWeather — CO: ${extraPollutants.co} | SO₂: ${extraPollutants.so2} | ` +
          `NH₃: ${extraPollutants.nh3} | NO: ${extraPollutants.no}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ Falha ao buscar dados extras do OWM para ${location.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const enrichedData = { ...airQualityData, ...extraPollutants };

    try {
      await this.motorAlertasService.sendMeasurement(enrichedData);
    } catch (error) {
      // Falha após os retries internos: contabiliza e propaga para a fila
      // reenfileirar/mandar para a dead-letter.
      this.metrics.incMeasurementFailed();
      throw error;
    }

    this.metrics.incMeasurementSent();
    this.logger.debug(
      `[3/3] ✅ Medição de ${location.name} enviada com sucesso!`,
    );
  }

  /** Número de execuções (ciclos de cron) realizadas. */
  getExecutionCount(): number {
    return this.executionCount;
  }

  /** Estatísticas atuais da fila de coleta. */
  getQueueStats(): QueueStats {
    return this.queue.getStats();
  }
}
