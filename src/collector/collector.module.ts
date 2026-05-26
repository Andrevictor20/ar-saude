import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service.js';
import { OpenMeteoModule } from '../open-meteo/open-meteo.module.js';
import { InterscityModule } from '../interscity/interscity.module.js';

/**
 * Módulo Orquestrador — Collector.
 *
 * Responsável por coordenar o fluxo completo de coleta:
 *   1. Agendar a execução via Cron Job.
 *   2. Chamar o OpenMeteoService para obter dados de qualidade do ar.
 *   3. Chamar o InterscityService para enviar os dados ao InterSCity.
 *
 * Importa os módulos OpenMeteo e Interscity para ter acesso
 * aos seus respectivos services exportados.
 */
@Module({
  imports: [OpenMeteoModule, InterscityModule],
  providers: [CollectorService],
})
export class CollectorModule {}
