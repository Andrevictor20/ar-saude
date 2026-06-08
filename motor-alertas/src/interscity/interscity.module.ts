import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterscityReaderService } from './interscity-reader.service';
import * as https from 'https'; // <-- 1. Importação necessária

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }),
  ],
  providers: [InterscityReaderService],
  exports: [InterscityReaderService],
})
export class InterscityModule {}
