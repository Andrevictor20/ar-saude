import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
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

    ScheduleModule.forRoot(),

    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),

    OpenMeteoModule,
    OpenWeatherModule,
    InterscityModule,
    CollectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
