import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OpenMeteoModule } from './open-meteo/open-meteo.module.js';
import { InterscityModule } from './interscity/interscity.module.js';
import { CollectorModule } from './collector/collector.module.js';

/**
 * Módulo raiz do Microsserviço 1 — Coletor.
 *
 * Importa os seguintes módulos:
 * - ConfigModule: carrega variáveis de ambiente a partir do .env.
 * - ScheduleModule: habilita o suporte a Cron Jobs (@Cron).
 * - HttpModule: provê o HttpService (wrapper do axios) para todos os módulos.
 * - OpenMeteoModule: encapsula a lógica de consumo da API Open-Meteo.
 * - InterscityModule: encapsula a integração com a plataforma InterSCity.
 * - CollectorModule: orquestra a coleta (cron) e o envio dos dados.
 */
@Module({
  imports: [
    // Carrega .env e torna as variáveis acessíveis via ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Habilita o agendamento de tarefas (@Cron, @Interval, etc.)
    ScheduleModule.forRoot(),

    // Módulo HTTP global com timeout padrão de 10 segundos
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),

    // Módulos de domínio
    OpenMeteoModule,
    InterscityModule,
    CollectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
