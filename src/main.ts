import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

/** Ponto de entrada do Microsserviço Coletor Ar-Saúde. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  Logger.log(
    `🌬️  Ar-Saúde Coletor rodando na porta ${port}`,
    'Bootstrap',
  );
}

bootstrap();
