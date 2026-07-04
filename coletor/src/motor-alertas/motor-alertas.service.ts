import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ProcessedAirQualityData } from '../common/interfaces/index.js';
import { ExtraPollutants } from '../open-weather/open-weather.service.js';
import { retryWithBackoff } from '../common/utils/retry.util.js';

@Injectable()
export class MotorAlertasService {
  private readonly logger = new Logger(MotorAlertasService.name);
  private readonly motorAlertasUrl: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.motorAlertasUrl = this.configService.get<string>(
      'MOTOR_ALERTAS_URL',
      'http://motor-alertas:3001',
    );
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
  }

  async sendMeasurement(data: ProcessedAirQualityData & ExtraPollutants): Promise<void> {
    const url = `${this.motorAlertasUrl}/measurements/ingest`;

    this.logger.log(`📤 Enviando medição ao Motor de Alertas — URL: ${url}`);

    await retryWithBackoff(
      () =>
        firstValueFrom(
          this.httpService.post(url, data, {
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      this.maxRetries,
      this.retryBaseDelay,
      'MotorAlertas.sendMeasurement',
    );

    this.logger.log(
      `✅ Medição enviada com sucesso para ${data.neighborhoodName} — AQI: ${data.aqi} (${data.level})`,
    );
  }
}
