import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MetricsController } from './common/metrics/metrics.controller.js';
import { CommonModule } from './common/common.module.js';
import { OpenMeteoModule } from './open-meteo/open-meteo.module.js';
import { OpenWeatherModule } from './open-weather/open-weather.module.js';
import { InterscityModule } from './interscity/interscity.module.js';
import { CollectorModule } from './collector/collector.module.js';

/** Módulo raiz do Coletor Ar-Saúde. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    ScheduleModule.forRoot(),

    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),

    CommonModule,
    OpenMeteoModule,
    OpenWeatherModule,
    InterscityModule,
    CollectorModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
