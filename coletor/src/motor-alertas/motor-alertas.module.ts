import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MotorAlertasService } from './motor-alertas.service.js';

@Module({
  imports: [HttpModule],
  providers: [MotorAlertasService],
  exports: [MotorAlertasService],
})
export class MotorAlertasModule {}
