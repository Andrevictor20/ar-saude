import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ProcessedAirQualityData } from '../common/interfaces/index.js';

import { retryWithBackoff } from '../common/utils/retry.util.js';

@Injectable()
export class MotorAlertasService {
  private readonly logger = new Logger(MotorAlertasService.name);
  private readonly motorAlertasUrl: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.motorAlertasUrl = this.configService.get<string>(
      'MOTOR_ALERTAS_URL',
      'http://motor-alertas:3001',
    );
    this.maxRetries = 5;
    this.retryBaseDelay = 500;
    this.apiKey = this.configService.get<string>('API_KEY', 'default-dev-key');
  }

  async sendMeasurement(data: ProcessedAirQualityData): Promise<void> {
    const url = `${this.motorAlertasUrl}/measurements/ingest`;

    this.logger.log(`📤 Enviando medição ao Motor de Alertas — URL: ${url}`);

    await retryWithBackoff(
      () =>
        firstValueFrom(
          this.httpService.post(url, data, {
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey
            },
          }),
        ),
      this.maxRetries,
      this.retryBaseDelay,
      'MotorAlertas.sendMeasurement',
    );

    this.logger.log(
      `✅ Medição enviada com sucesso para ${data.locationName} — AQI: ${data.aqi} (${data.level})`,
    );
  }
}
