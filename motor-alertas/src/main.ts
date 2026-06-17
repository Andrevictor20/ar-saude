// Tracing PRIMEIRO — antes de qualquer import que carregue http/express/nest/pg.
import './tracing';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Hooks de ciclo de vida para shutdown limpo.
  app.enableShutdownHooks();

  await app.listen(port);

  Logger.log(
    `Ar-Saude Motor de Alertas rodando na porta ${port}`,
    'Bootstrap',
  );
}

bootstrap();
