import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Alert } from '../entities/alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertsEventsService } from './alerts-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([Alert])],
  providers: [AlertsService, AlertsEventsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
