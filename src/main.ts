// Tracing PRIMEIRO — antes de qualquer import que carregue http/express/nest.
import './tracing.js';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

/** Ponto de entrada do Microsserviço Coletor Ar-Saúde. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  // Habilita os hooks de ciclo de vida (onModuleDestroy/beforeApplicationShutdown)
  // para que a fila possa drenar os jobs em andamento antes do processo morrer.
  app.enableShutdownHooks();

  await app.listen(port);

  Logger.log(`🌬️  Ar-Saúde Coletor rodando na porta ${port}`, 'Bootstrap');
}

bootstrap();
