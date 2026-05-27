import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterscityReaderService } from './interscity-reader.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  providers: [InterscityReaderService],
  exports: [InterscityReaderService],
})
export class InterscityModule {}
