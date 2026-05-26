import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterscityService } from './interscity.service.js';

/**
 * Módulo de integração com a plataforma InterSCity.
 *
 * Responsável por registrar recursos (bairros), capacidades
 * (indicadores ambientais) e enviar medições de qualidade do ar.
 *
 * Exporta o InterscityService para uso pelo CollectorModule.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  providers: [InterscityService],
  exports: [InterscityService],
})
export class InterscityModule {}
