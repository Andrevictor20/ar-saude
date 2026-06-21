// Tracing PRIMEIRO — antes de qualquer import que carregue http/express/nest.
import './tracing.js';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from '@fastify/helmet';

/** Ponto de entrada do Microsserviço Coletor Ar-Saúde. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  const port = process.env.PORT ?? 3000;

  await app.register(helmet);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Habilita os hooks de ciclo de vida (onModuleDestroy/beforeApplicationShutdown)
  // para que a fila possa drenar os jobs em andamento antes do processo morrer.
  app.enableShutdownHooks();

  // '0.0.0.0' garante que o Docker exponha a porta corretamente no Fastify
  await app.listen(port, '0.0.0.0');

  Logger.log(`🌬️  Ar-Saúde Coletor rodando na porta ${port}`, 'Bootstrap');
}

void bootstrap();
