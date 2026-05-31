import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import {
  ProcessedAirQualityData,
  InterscityCapabilityPayload,
  InterscityResourcePayload,
  InterscityMeasurementPayload,
  InterscityResourceResponse,
} from '../common/interfaces/index.js';
import { retryWithBackoff } from '../common/utils/retry.util.js';
import { SAO_LUIS_NEIGHBORHOODS } from '../common/constants/neighborhoods.js';

/** Adaptador de integração com a plataforma InterSCity (capabilities, resources, medições). */
@Injectable()
export class InterscityService implements OnModuleInit {
  private readonly logger = new Logger(InterscityService.name);

  private readonly catalogUrl: string;

  private readonly collectorUrl: string;

  private readonly adaptorUrl: string;

  private readonly kongUrl: string;

  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;

  /** Mapa neighborhoodId → resourceUuid */
  private readonly resourceUuids = new Map<string, string>();

  private readonly capabilities: InterscityCapabilityPayload[] = [
    {
      name: 'air_quality_index',
      description: 'Índice de Qualidade do Ar (European AQI) — valor inteiro de 0 a 500+',
      capability_type: 'sensor',
    },
    {
      name: 'pm10',
      description: 'Concentração de material particulado PM10 (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'pm2_5',
      description: 'Concentração de material particulado PM2.5 (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'no2',
      description: 'Concentração de Dióxido de Nitrogênio — NO₂ (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'ozone',
      description: 'Concentração de Ozônio troposférico — O₃ (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'air_quality_level',
      description: 'Classificação textual do nível de qualidade do ar (ex.: Bom, Moderado, Ruim)',
      capability_type: 'sensor',
    },
    {
      name: 'co',
      description: 'Concentração de Monóxido de Carbono — CO (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'so2',
      description: 'Concentração de Dióxido de Enxofre — SO₂ (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'nh3',
      description: 'Concentração de Amônia — NH₃ (µg/m³)',
      capability_type: 'sensor',
    },
    {
      name: 'no',
      description: 'Concentração de Monóxido de Nitrogênio — NO (µg/m³)',
      capability_type: 'sensor',
    },
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.catalogUrl = this.configService.get<string>(
      'INTERSCITY_CATALOG_URL',
      'https://interscity.rasppi.cloud/catalog',
    );
    this.collectorUrl = this.configService.get<string>(
      'INTERSCITY_COLLECTOR_URL',
      'https://interscity.rasppi.cloud/collector',
    );
    this.adaptorUrl = this.configService.get<string>(
      'INTERSCITY_ADAPTOR_URL',
      'https://interscity.rasppi.cloud/adaptor',
    );
    this.kongUrl = this.configService.get<string>(
      'KONG_UPSTREAM_URL',
      'https://kong.rasppi.cloud/upstreams',
    );
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
  }

  /** Registra capabilities e resources ao iniciar o módulo. */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Inicializando integração com InterSCity...');

    try {
      await this.ensureCapabilitiesRegistered();
      await this.ensureResourcesRegistered();
      this.logger.log(
        `✅ InterSCity inicializado com ${this.resourceUuids.size} bairros registrados.`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️  Falha ao inicializar InterSCity (será reattempted no próximo cron): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Registra capabilities no catálogo (ignora duplicatas). */
  async ensureCapabilitiesRegistered(): Promise<void> {
    this.logger.log('Registrando capabilities no InterSCity...');

    for (const capability of this.capabilities) {
      try {
        await retryWithBackoff(
          () =>
            firstValueFrom(
              this.httpService.post(
                `${this.catalogUrl}/capabilities`,
                capability,
                { headers: { 'Content-Type': 'application/json' } },
              ),
            ),
          this.maxRetries,
          this.retryBaseDelay,
          `InterSCity.registerCapability(${capability.name})`,
          (error: any) => {
            const status = error?.response?.status;
            const errorMsg = error?.response?.data?.error;
            if (
              status === 409 ||
              status === 422 ||
              (status === 400 && errorMsg === 'Name has already been taken')
            ) {
              return false;
            }
            return true;
          },
        );

        this.logger.log(`  ✓ Capability "${capability.name}" registrada.`);
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; data?: any } };
        const errorMsg = axiosError?.response?.data?.error;
        
        if (
          axiosError?.response?.status === 409 ||
          axiosError?.response?.status === 422 ||
          (axiosError?.response?.status === 400 && errorMsg === 'Name has already been taken')
        ) {
          this.logger.log(
            `  ⏭️  Capability "${capability.name}" já existe, pulando.`,
          );
        } else {
          const erroDetalhado = axiosError?.response?.data
            ? JSON.stringify(axiosError.response.data)
            : error instanceof Error
              ? error.message
              : String(error);

          this.logger.warn(
            `  ❌ Erro ao registrar capability "${capability.name}" (Status ${axiosError?.response?.status}): ${erroDetalhado}`,
          );
          throw error;
        }
      }
    }
  }

  /** Garante que os recursos (bairros) estejam registrados. */
  async ensureResourcesRegistered(): Promise<void> {
    for (const neighborhood of SAO_LUIS_NEIGHBORHOODS) {
      if (this.resourceUuids.has(neighborhood.id)) {
        continue;
      }

      const resourcePayload: InterscityResourcePayload = {
        data: {
          description: `Monitoramento Ar-Saúde - Bairro: ${neighborhood.name}`,
          capabilities: this.capabilities.map((c) => c.name),
          status: 'active',
          lat: neighborhood.latitude,
          lon: neighborhood.longitude,
        },
      };

      try {
        const response = await retryWithBackoff(
          () =>
            firstValueFrom(
              this.httpService.post<InterscityResourceResponse>(
                `${this.catalogUrl}/resources`,
                resourcePayload,
                { headers: { 'Content-Type': 'application/json' } },
              ),
            ),
          this.maxRetries,
          this.retryBaseDelay,
          `InterSCity.registerResource(${neighborhood.id})`,
          (error: any) => {
            const status = error?.response?.status;
            if (status === 409 || status === 422) return false;
            return true;
          },
        );

        const uuid = response.data?.data?.uuid;
        if (uuid) {
          this.resourceUuids.set(neighborhood.id, uuid);
          this.logger.log(
            `✅ Bairro ${neighborhood.name} registrado — UUID: ${uuid}`,
          );
        }
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number } };
        if (
          axiosError?.response?.status === 409 ||
          axiosError?.response?.status === 422
        ) {
          this.logger.log(`Bairro ${neighborhood.name} já existe, buscando UUID...`);
          await this.fetchExistingResourceUuid(neighborhood.id, neighborhood.name);
        } else {
          throw error;
        }
      }
    }
  }

  /** Busca UUID de um recurso já existente. */
  private async fetchExistingResourceUuid(neighborhoodId: string, neighborhoodName: string): Promise<void> {
    try {
      const response = await retryWithBackoff(
        () =>
          firstValueFrom(
            this.httpService.get(`${this.catalogUrl}/resources`, {
              params: { per_page: 1000 },
            }),
          ),
        this.maxRetries,
        this.retryBaseDelay,
        'InterSCity.fetchResources',
      );

      const resources = response.data?.resources ?? [];
      const existingResource = resources.find(
        (r: { description?: string }) =>
          r.description?.includes(`Bairro: ${neighborhoodName}`),
      );

      if (existingResource?.uuid) {
        this.resourceUuids.set(neighborhoodId, existingResource.uuid);
        this.logger.log(
          `✅ Recurso existente encontrado para ${neighborhoodName} — UUID: ${existingResource.uuid}`,
        );
      } else {
        this.logger.warn(
          `⚠️ Nenhum recurso Ar-Saúde encontrado para o bairro ${neighborhoodName}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao buscar recursos existentes para ${neighborhoodName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Envia medição de qualidade do ar ao InterSCity Adaptor. */
  async sendMeasurement(data: ProcessedAirQualityData): Promise<void> {
    const uuid = this.resourceUuids.get(data.neighborhoodId);

    if (!uuid) {
      this.logger.warn(
        `Resource UUID não disponível para ${data.neighborhoodName}. Tentando re-registrar...`,
      );
      await this.ensureResourcesRegistered();

      if (!this.resourceUuids.has(data.neighborhoodId)) {
        throw new Error(
          `Impossível enviar medição: Resource UUID não encontrado no InterSCity para ${data.neighborhoodName}.`,
        );
      }
    }

    const currentUuid = this.resourceUuids.get(data.neighborhoodId);

    const measurementPayload: InterscityMeasurementPayload = {
      data: {
        air_quality_index: [
          { value: data.aqi, timestamp: data.timestamp },
        ],

        pm10: [
          { value: data.pm10, timestamp: data.timestamp },
        ],

        pm2_5: [
          { value: data.pm2_5, timestamp: data.timestamp },
        ],

        no2: [
          { value: data.no2, timestamp: data.timestamp },
        ],

        ozone: [
          { value: data.ozone, timestamp: data.timestamp },
        ],

        air_quality_level: [
          { value: data.level, timestamp: data.timestamp },
        ],

        co: [
          { value: data.co ?? null, timestamp: data.timestamp },
        ],

        so2: [
          { value: data.so2 ?? null, timestamp: data.timestamp },
        ],

        nh3: [
          { value: data.nh3 ?? null, timestamp: data.timestamp },
        ],

        no: [
          { value: data.no ?? null, timestamp: data.timestamp },
        ],
      },
    };

    const url = `${this.adaptorUrl}/resources/${currentUuid}/data`;

    this.logger.log(
      `📤 Enviando medição ao InterSCity — URL: ${url}`,
    );
    this.logger.debug(
      `Payload: ${JSON.stringify(measurementPayload, null, 2)}`,
    );

    await retryWithBackoff(
      () =>
        firstValueFrom(
          this.httpService.post(url, measurementPayload, {
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      this.maxRetries,
      this.retryBaseDelay,
      'InterSCity.sendMeasurement',
    );

    this.logger.log(
      `✅ Medição enviada com sucesso para ${data.neighborhoodName} — AQI: ${data.aqi} (${data.level})`,
    );
  }

  /** Retorna mapa de UUIDs registrados. */
  getResourceUuids(): Record<string, string> {
    return Object.fromEntries(this.resourceUuids);
  }
}
