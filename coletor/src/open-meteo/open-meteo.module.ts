import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpenMeteoService } from './open-meteo.service.js';

/** Módulo de integração com a API Open-Meteo. */
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
