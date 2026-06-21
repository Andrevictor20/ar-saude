import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { Measurement } from './entities/measurement.entity';
import { Alert } from './entities/alert.entity';
import { MeasurementsModule } from './measurements/measurements.module';
import { AlertsModule } from './alerts/alerts.module';
import { InterscityModule } from './interscity/interscity.module';
import { MonitorModule } from './monitor/monitor.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minuto
      limit: 100, // max 100 requisições por minuto por IP
    }]),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get<string>('DB_USER', 'arsaude'),
        password: config.get<string>('DB_PASSWORD', 'arsaude'),
        database: config.get<string>('DB_NAME', 'arsaude_alertas'),
        entities: [Measurement, Alert],
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),

    MeasurementsModule,
    AlertsModule,
    InterscityModule,
    MonitorModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
