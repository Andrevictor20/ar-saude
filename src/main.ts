import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

/**
 * Ponto de entrada do Microsserviço 1 — Coletor Ar-Saúde.
 *
 * Este microsserviço é um worker headless: sua função primária é
 * executar Cron Jobs para coleta de dados de qualidade do ar na
 * API Open-Meteo e enviar as medições para a plataforma InterSCity.
 *
 * O servidor HTTP é mantido ativo apenas para healthchecks e
 * observabilidade em ambiente containerizado (Docker / Kubernetes).
 */
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
