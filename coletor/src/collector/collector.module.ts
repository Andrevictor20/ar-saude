import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service.js';
import { OpenMeteoModule } from '../open-meteo/open-meteo.module.js';
import { OpenWeatherModule } from '../open-weather/open-weather.module.js';
import { MotorAlertasModule } from '../motor-alertas/motor-alertas.module.js';

/** Módulo orquestrador de coleta de dados. */
@Module({
  imports: [OpenMeteoModule, OpenWeatherModule, MotorAlertasModule],
  providers: [CollectorService],
  exports: [CollectorService],
})
export class CollectorModule {}
