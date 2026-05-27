import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service.js';
import { OpenMeteoModule } from '../open-meteo/open-meteo.module.js';
import { InterscityModule } from '../interscity/interscity.module.js';

/** Módulo orquestrador de coleta de dados. */
@Module({
  imports: [OpenMeteoModule, InterscityModule],
  providers: [CollectorService],
})
export class CollectorModule {}
