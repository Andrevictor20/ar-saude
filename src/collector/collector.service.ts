import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { OpenMeteoService } from '../open-meteo/open-meteo.service.js';
import { InterscityService } from '../interscity/interscity.service.js';

/**
 * =====================================================
 * CollectorService — Orquestrador de Coleta
 * =====================================================
 *
 * Este é o serviço central do Microsserviço 1 (Coletor).
 * Ele orquestra o fluxo completo de coleta de dados:
 *
 *   ┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
 *   │  Cron Job   │────▶│ OpenMeteoService  │────▶│ InterscityService│
 *   │ (agendado)  │     │ (coleta + retry)  │     │ (envio ao ISCITY)│
 *   └─────────────┘     └──────────────────┘     └──────────────────┘
 *
 * A cada execução do Cron Job:
 * 1. Busca dados de qualidade do ar na API Open-Meteo.
 * 2. Envia os dados processados para o InterSCity via Collector API.
 * 3. Registra logs detalhados de cada etapa (sucesso ou falha).
 *
 * O intervalo do cron é configurável via variável de ambiente
 * CRON_COLLECT_INTERVAL (padrão: a cada 30 minutos).
 */
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

  /**
   * Cron Job principal — coleta e envio de dados.
   *
   * Executa no intervalo definido pela variável de ambiente
   * CRON_COLLECT_INTERVAL (expressão cron).
   *
   * Padrão: a cada 30 minutos (expressão cron: asterisco-barra-30).
   *
   * O decorator Cron aceita uma expressão cron padrão Unix
   * (minuto hora dia mês dia_semana).
   *
   * Este método NAO lança exceções — todos os erros são
   * capturados e logados para não interromper o agendador.
   */
  @Cron(process.env.CRON_COLLECT_INTERVAL ?? '*/30 * * * *', {
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
      `🔄 Execução #${executionId} — Iniciando coleta de qualidade do ar...`,
    );
    this.logger.log(
      `═══════════════════════════════════════════════════`,
    );

    const startTime = Date.now();

    try {
      // ── Etapa 1: Coleta de dados na API Open-Meteo ──
      this.logger.log('[1/2] Coletando dados do Open-Meteo...');
      const airQualityData =
        await this.openMeteoService.fetchAirQuality();

      this.logger.log(
        `[1/2] ✅ Dados coletados — AQI: ${airQualityData.aqi} ` +
          `(${airQualityData.level}) | PM10: ${airQualityData.pm10} | ` +
          `PM2.5: ${airQualityData.pm2_5} | NO₂: ${airQualityData.no2} | ` +
          `O₃: ${airQualityData.ozone}`,
      );

      // ── Etapa 2: Envio dos dados ao InterSCity ──
      this.logger.log('[2/2] Enviando dados ao InterSCity...');
      await this.interscityService.sendMeasurement(airQualityData);

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[2/2] ✅ Medição enviada com sucesso em ${elapsed}ms`,
      );

      this.logger.log(
        `🏁 Execução #${executionId} concluída com sucesso (${elapsed}ms)`,
      );
    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `❌ Execução #${executionId} falhou após ${elapsed}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Log do stack trace para debugging
      if (error instanceof Error && error.stack) {
        this.logger.debug(error.stack);
      }
    }
  }

  /**
   * Retorna o número de execuções realizadas (para healthcheck).
   */
  getExecutionCount(): number {
    return this.executionCount;
  }
}
