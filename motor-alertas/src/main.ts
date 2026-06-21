// Tracing PRIMEIRO — antes de qualquer import que carregue http/express/nest/pg.
import "./tracing";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "@fastify/helmet";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  const port = process.env.PORT ?? 3001;

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
      ? process.env.CORS_ORIGIN.split(",")
      : false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // Hooks de ciclo de vida para shutdown limpo.
  app.enableShutdownHooks();

  // '0.0.0.0' para expor externamente no container
  await app.listen(port, "0.0.0.0");

  Logger.log(`Ar-Saude Motor de Alertas rodando na porta ${port}`, "Bootstrap");
}

void bootstrap();
