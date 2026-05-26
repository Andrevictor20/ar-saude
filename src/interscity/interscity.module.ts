import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterscityService } from './interscity.service.js';

/** Módulo de integração com a plataforma InterSCity. */
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
