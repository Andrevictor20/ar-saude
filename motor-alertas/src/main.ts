import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "@fastify/helmet";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

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

  // Configuração do Swagger OpenAPI
  const config = new DocumentBuilder()
    .setTitle("Ar-Saúde API (Motor de Alertas)")
    .setDescription("API responsável pela ingestão de medições, avaliação de qualidade do ar e geração de alertas para localidades do Brasil.")
    .setVersion("1.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "api-key")
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // '0.0.0.0' para expor externamente no container
  await app.listen(port, "0.0.0.0");

  Logger.log(`Ar-Saude Motor de Alertas rodando na porta ${port}`, "Bootstrap");
}

void bootstrap();
