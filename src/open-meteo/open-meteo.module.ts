import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpenMeteoService } from './open-meteo.service.js';

/**
 * Módulo responsável pela integração com a API Open-Meteo.
 *
 * Exporta o OpenMeteoService para que outros módulos
 * (especialmente o CollectorModule) possam utilizá-lo.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  providers: [OpenMeteoService],
  exports: [OpenMeteoService],
})
export class OpenMeteoModule {}
