import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
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
import { MetricsService } from '../common/metrics/metrics.service.js';

/** Um destino do InterSCity (catálogo + adaptor). */
export interface InterscityEndpoint {
  name: string;
  catalogUrl: string;
  adaptorUrl: string;
}

/** Situação de saúde atual da integração com o InterSCity. */
export interface InterscityHealth {
  active: string;
  primaryUp: boolean;
  fallbackUp: boolean;
  lastCheckedAt: string | null;
}

/** Adaptador de integração com a plataforma InterSCity (capabilities, resources, medições). */
@Injectable()
export class InterscityService implements OnModuleInit {
  private readonly logger = new Logger(InterscityService.name);

  /** Endpoint primário — sempre preferido enquanto estiver no ar. */
  private readonly primaryEndpoint: InterscityEndpoint;

  /** Endpoint de fallback — usado apenas se o primário cair. */
  private readonly fallbackEndpoint: InterscityEndpoint;

  /** Endpoint efetivamente em uso no momento. */
  private activeEndpoint: InterscityEndpoint;

  /** Último retrato de saúde dos endpoints. */
  private health: InterscityHealth = {
    active: '',
    primaryUp: false,
    fallbackUp: false,
    lastCheckedAt: null,
  };

  private readonly kongUrl: string;

  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly healthTimeoutMs: number;

  /** Timeout (maior) usado só no primeiro healthcheck, p/ tolerar o cold start. */
  private readonly firstHealthTimeoutMs: number;

  /** Indica se o primeiro healthcheck já rodou. */
  private firstCheckDone = false;

  /** Chaos: quando true, o primário é tratado como DOWN (ver setChaosPrimaryDown). */
  private chaosPrimaryDown = false;

  /** Catálogo do endpoint ativo. */
  private get catalogUrl(): string {
    return this.activeEndpoint.catalogUrl;
  }

  /** Adaptor do endpoint ativo. */
  private get adaptorUrl(): string {
    return this.activeEndpoint.adaptorUrl;
  }

  /** Mapa neighborhoodId → resourceUuid */
  private readonly resourceUuids = new Map<string, string>();

  private readonly capabilities: InterscityCapabilityPayload[] = [
    {
      name: 'air_quality_index',
      description:
        'Índice de Qualidade do Ar (European AQI) — valor inteiro de 0 a 500+',
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
      description:
        'Classificação textual do nível de qualidade do ar (ex.: Bom, Moderado, Ruim)',
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
    private readonly metrics: MetricsService,
  ) {
    // Endpoint primário (LSDI/UFMA) — preferido sempre que estiver no ar.
    this.primaryEndpoint = {
      name: 'primary',
      catalogUrl: this.configService.get<string>(
        'INTERSCITY_CATALOG_URL',
        'https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/catalog',
      ),
      adaptorUrl: this.configService.get<string>(
        'INTERSCITY_ADAPTOR_URL',
        'https://cidadesinteligentes.lsdi.ufma.br/interscity_lh/adaptor',
      ),
    };

    // Endpoint de fallback — usado só se o primário cair.
    this.fallbackEndpoint = {
      name: 'fallback',
      catalogUrl: this.configService.get<string>(
        'INTERSCITY_CATALOG_URL_FALLBACK',
        'https://interscity.rasppi.cloud/catalog',
      ),
      adaptorUrl: this.configService.get<string>(
        'INTERSCITY_ADAPTOR_URL_FALLBACK',
        'https://interscity.rasppi.cloud/adaptor',
      ),
    };

    // Começa apontando para o primário; o healthcheck ajusta se necessário.
    this.activeEndpoint = this.primaryEndpoint;
    this.health.active = this.activeEndpoint.name;

    this.kongUrl = this.configService.get<string>(
      'KONG_UPSTREAM_URL',
      'https://kong.rasppi.cloud/upstreams',
    );
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 5);
    this.retryBaseDelay = this.configService.get<number>(
      'RETRY_BASE_DELAY_MS',
      1000,
    );
    this.healthTimeoutMs = this.configService.get<number>(
      'INTERSCITY_HEALTH_TIMEOUT_MS',
      8000,
    );
    this.firstHealthTimeoutMs = this.configService.get<number>(
      'INTERSCITY_FIRST_HEALTH_TIMEOUT_MS',
      30_000,
    );
  }

  /**
   * Healthcheck de um endpoint: GET {catalog}/capabilities.
   * Retorna true se o serviço respondeu 2xx.
   */
  private async isEndpointUp(
    endpoint: InterscityEndpoint,
    timeoutMs: number = this.healthTimeoutMs,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${endpoint.catalogUrl}/capabilities`, {
          timeout: timeoutMs,
          params: { per_page: 1 },
        }),
      );
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.debug(
        `Healthcheck DOWN para ${endpoint.name} (${endpoint.catalogUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /**
   * Verifica primário e fallback e (re)seleciona o endpoint ativo.
   * Regra: o primário tem prioridade sempre que estiver no ar; se cair,
   * faz failover para o fallback; se ambos caírem, mantém o atual e confia
   * no retry das requisições.
   */
  async checkHealth(): Promise<InterscityHealth> {
    // O primeiro check usa um timeout maior para tolerar o cold start do servidor.
    const timeoutMs = this.firstCheckDone
      ? this.healthTimeoutMs
      : this.firstHealthTimeoutMs;

    if (!this.firstCheckDone) {
      this.logger.log(
        `⏳ Primeiro healthcheck do InterSCity (timeout estendido de ${timeoutMs}ms p/ cold start)...`,
      );
    }

    const [primaryProbe, fallbackUp] = await Promise.all([
      this.isEndpointUp(this.primaryEndpoint, timeoutMs),
      this.isEndpointUp(this.fallbackEndpoint, timeoutMs),
    ]);

    // Chaos engineering: quando ligado, o primário é tratado como DOWN mesmo
    // que esteja no ar, permitindo demonstrar o failover ao vivo (ver #7).
    const primaryUp = this.chaosPrimaryDown ? false : primaryProbe;
    if (this.chaosPrimaryDown) {
      this.logger.warn(
        '🧪 [CHAOS] Primário do InterSCity forçado como DOWN (chaos ativo).',
      );
    }

    this.firstCheckDone = true;

    const previous = this.activeEndpoint.name;

    if (primaryUp) {
      this.activeEndpoint = this.primaryEndpoint;
    } else if (fallbackUp) {
      this.activeEndpoint = this.fallbackEndpoint;
    }
    // ambos down → mantém o ativo atual

    if (this.activeEndpoint.name !== previous) {
      this.metrics.incFailover();
      this.logger.warn(
        `🔀 Failover do InterSCity: endpoint ativo ${previous} → ${this.activeEndpoint.name}`,
      );
    }

    this.health = {
      active: this.activeEndpoint.name,
      primaryUp,
      fallbackUp,
      lastCheckedAt: new Date().toISOString(),
    };

    const overall = primaryUp ? '🟢' : fallbackUp ? '🟡' : '🔴';
    this.logger.log(
      `${overall} Healthcheck InterSCity — primário: ${primaryUp ? 'UP' : 'DOWN'} | ` +
        `fallback: ${fallbackUp ? 'UP' : 'DOWN'} | ativo: ${this.activeEndpoint.name}`,
    );

    return this.health;
  }

  /** Healthcheck periódico — mantém o endpoint ativo sempre atualizado. */
  @Interval('interscity-health', 60_000)
  async scheduledHealthCheck(): Promise<void> {
    await this.checkHealth();
  }

  /** Último retrato de saúde conhecido (sem disparar nova checagem). */
  getHealth(): InterscityHealth {
    return this.health;
  }

  /**
   * Chaos engineering: liga/desliga a simulação de queda do primário.
   * Reavalia a saúde imediatamente para refletir o novo estado.
   */
  async setChaosPrimaryDown(down: boolean): Promise<InterscityHealth> {
    this.chaosPrimaryDown = down;
    this.logger.warn(
      `🧪 [CHAOS] Simulação de primário DOWN ${down ? 'ATIVADA' : 'DESATIVADA'}.`,
    );
    return this.checkHealth();
  }

  /** Estado atual da simulação de chaos. */
  isChaosPrimaryDown(): boolean {
    return this.chaosPrimaryDown;
  }

  /** Registra capabilities e resources ao iniciar o módulo. */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Inicializando integração com InterSCity...');

    // Descobre qual endpoint está no ar (primário tem prioridade) antes de registrar.
    await this.checkHealth();

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
        const axiosError = error as {
          response?: { status?: number; data?: any };
        };
        const errorMsg = axiosError?.response?.data?.error;

        if (
          axiosError?.response?.status === 409 ||
          axiosError?.response?.status === 422 ||
          (axiosError?.response?.status === 400 &&
            errorMsg === 'Name has already been taken')
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
          this.logger.log(
            `Bairro ${neighborhood.name} já existe, buscando UUID...`,
          );
          await this.fetchExistingResourceUuid(
            neighborhood.id,
            neighborhood.name,
          );
        } else {
          throw error;
        }
      }
    }
  }

  /** Busca UUID de um recurso já existente. */
  private async fetchExistingResourceUuid(
    neighborhoodId: string,
    neighborhoodName: string,
  ): Promise<void> {
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
      const existingResource = resources.find((r: { description?: string }) =>
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
        air_quality_index: [{ value: data.aqi, timestamp: data.timestamp }],

        pm10: [{ value: data.pm10, timestamp: data.timestamp }],

        pm2_5: [{ value: data.pm2_5, timestamp: data.timestamp }],

        no2: [{ value: data.no2, timestamp: data.timestamp }],

        ozone: [{ value: data.ozone, timestamp: data.timestamp }],

        air_quality_level: [{ value: data.level, timestamp: data.timestamp }],

        co: [{ value: data.co ?? null, timestamp: data.timestamp }],

        so2: [{ value: data.so2 ?? null, timestamp: data.timestamp }],

        nh3: [{ value: data.nh3 ?? null, timestamp: data.timestamp }],

        no: [{ value: data.no ?? null, timestamp: data.timestamp }],
      },
    };

    const url = `${this.adaptorUrl}/resources/${currentUuid}/data`;

    this.logger.log(`📤 Enviando medição ao InterSCity — URL: ${url}`);
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
