import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Measurement } from '../entities/measurement.entity';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Measurement])],
  providers: [MeasurementsService],
  controllers: [MeasurementsController],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
