import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterscityService } from './interscity.service.js';
import * as https from 'https'; // <-- 1. Importe o pacote https

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
  providers: [InterscityService],
  exports: [InterscityService],
})
export class InterscityModule {}
