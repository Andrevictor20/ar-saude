import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { OpenMeteoService } from '../open-meteo/open-meteo.service.js';
import {
  OpenWeatherService,
  ExtraPollutants,
} from '../open-weather/open-weather.service.js';
import { InterscityService } from '../interscity/interscity.service.js';
import {
  RequestQueueService,
  QueueStats,
} from '../common/queue/request-queue.service.js';
import {
  SAO_LUIS_NEIGHBORHOODS,
  Neighborhood,
} from '../common/constants/neighborhoods.js';

/**
 * Orquestrador de coleta: Cron → Fila → (Open-Meteo + OpenWeather) → InterSCity.
 *
 * Em vez de processar os bairros inline (sequencialmente, com risco de perder
 * dados em caso de falha), o coletor agora apenas *enfileira* um job por bairro.
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
    private readonly interscityService: InterscityService,
    private readonly queue: RequestQueueService,
    private readonly configService: ConfigService,
  ) {}

  /** Configura a fila e registra o worker que processa cada bairro. */
  onModuleInit(): void {
    this.queue.configure({
      concurrency: this.configService.get<number>('QUEUE_CONCURRENCY', 5),
      maxAttempts: this.configService.get<number>('QUEUE_MAX_ATTEMPTS', 5),
      retryDelayMs: this.configService.get<number>('RETRY_BASE_DELAY_MS', 1000),
    });

    this.queue.setWorker<Neighborhood>((neighborhood) =>
      this.processNeighborhood(neighborhood),
    );
  }

  /** Cron Job principal — apenas enfileira a coleta de todos os bairros. */
  @Cron(process.env.CRON_COLLECT_INTERVAL ?? '* * * * *', {
    name: 'air-quality-collection',
    timeZone: 'America/Sao_Paulo',
  })
  handleCollection(): void {
    this.executionCount++;
    const executionId = this.executionCount;

    this.logger.log('═══════════════════════════════════════════════════');
    this.logger.log(
      `🔄 Execução #${executionId} — Enfileirando coleta de ${SAO_LUIS_NEIGHBORHOODS.length} bairros...`,
    );
    this.logger.log('═══════════════════════════════════════════════════');

    this.enqueueAllNeighborhoods();
  }

  /** Enfileira um job de coleta para cada bairro. Retorna a quantidade enfileirada. */
  enqueueAllNeighborhoods(): number {
    const count = this.queue.enqueueMany<Neighborhood>(SAO_LUIS_NEIGHBORHOODS);
    this.logger.log(
      `📥 ${count} bairros enfileirados. Fila: ${JSON.stringify(this.queue.getStats())}`,
    );
    return count;
  }

  /**
   * Processa um único bairro: coleta (Open-Meteo + OpenWeather) e envia ao
   * InterSCity. Lança erro em caso de falha no envio, para que a fila reenfileire.
   */
  private async processNeighborhood(neighborhood: Neighborhood): Promise<void> {
    this.logger.log(`--- Bairro: ${neighborhood.name} ---`);

    const airQualityData =
      await this.openMeteoService.fetchAirQuality(neighborhood);

    this.logger.log(
      `[1/3] ✅ Open-Meteo — AQI: ${airQualityData.aqi} (${airQualityData.level}) | ` +
        `PM10: ${airQualityData.pm10} | PM2.5: ${airQualityData.pm2_5} | ` +
        `NO₂: ${airQualityData.no2} | O₃: ${airQualityData.ozone}`,
    );

    let extraPollutants: ExtraPollutants = {
      co: null,
      so2: null,
      nh3: null,
      no: null,
    };
    try {
      extraPollutants = await this.openWeatherService.fetchExtraPollutants(
        neighborhood.latitude,
        neighborhood.longitude,
        neighborhood.name,
      );
      this.logger.log(
        `[2/3] ✅ OpenWeather — CO: ${extraPollutants.co} | SO₂: ${extraPollutants.so2} | ` +
          `NH₃: ${extraPollutants.nh3} | NO: ${extraPollutants.no}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ Falha ao buscar dados extras do OWM para ${neighborhood.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const enrichedData = { ...airQualityData, ...extraPollutants };

    await this.interscityService.sendMeasurement(enrichedData);

    this.logger.log(
      `[3/3] ✅ Medição de ${neighborhood.name} enviada com sucesso!`,
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
