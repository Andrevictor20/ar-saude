import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { OpenMeteoService } from '../open-meteo/open-meteo.service.js';
import { InterscityService } from '../interscity/interscity.service.js';
import { SAO_LUIS_NEIGHBORHOODS } from '../common/constants/neighborhoods.js';

/** Orquestrador de coleta: Cron → Open-Meteo → InterSCity. */
@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  /** Contador de execuções para observabilidade */
  private executionCount = 0;

  constructor(
    private readonly openMeteoService: OpenMeteoService,
    private readonly interscityService: InterscityService,
    private readonly configService: ConfigService,
  ) {}

  /** Cron Job principal — coleta e envio por bairro. */
  @Cron(process.env.CRON_COLLECT_INTERVAL ?? '* * * * *', {
    name: 'air-quality-collection',
    timeZone: 'America/Sao_Paulo',
  })
  async handleCollection(): Promise<void> {
    this.executionCount++;
    const executionId = this.executionCount;

    this.logger.log(
      `═══════════════════════════════════════════════════`,
    );
    this.logger.log(
      `🔄 Execução #${executionId} — Iniciando coleta de qualidade do ar por bairros...`,
    );
    this.logger.log(
      `═══════════════════════════════════════════════════`,
    );

    const startTime = Date.now();

    for (const neighborhood of SAO_LUIS_NEIGHBORHOODS) {
      try {
        this.logger.log(`\n--- Bairro: ${neighborhood.name} ---`);

        this.logger.log('[1/2] Coletando dados do Open-Meteo...');
        const airQualityData =
          await this.openMeteoService.fetchAirQuality(neighborhood);

        this.logger.log(
          `[1/2] ✅ Dados coletados — AQI: ${airQualityData.aqi} ` +
            `(${airQualityData.level}) | PM10: ${airQualityData.pm10} | ` +
            `PM2.5: ${airQualityData.pm2_5} | NO₂: ${airQualityData.no2} | ` +
            `O₃: ${airQualityData.ozone}`,
        );

        this.logger.log('[2/2] Enviando dados ao InterSCity...');
        await this.interscityService.sendMeasurement(airQualityData);

        this.logger.log(
          `[2/2] ✅ Medição de ${neighborhood.name} enviada com sucesso!`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Falha ao processar o bairro ${neighborhood.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `🏁 Execução #${executionId} concluída em ${elapsed}ms`,
    );
  }

  /** Número de execuções realizadas. */
  getExecutionCount(): number {
    return this.executionCount;
  }
}
