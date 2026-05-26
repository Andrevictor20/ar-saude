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

/**
 * =====================================================
 * InterscityService — Integração com InterSCity
 * =====================================================
 *
 * Este serviço é o adaptador entre o Microsserviço Coletor e a
 * plataforma de Cidades Inteligentes InterSCity. Ele gerencia:
 *
 * 1. Registro de Capacidades (Capabilities):
 *    Cada indicador ambiental é registrado como uma Capability
 *    do tipo "sensor" no catálogo do InterSCity. As capabilities
 *    definidas são:
 *      - air_quality_index → AQI europeu (inteiro)
 *      - pm10              → Partículas ≤10µm (µg/m³)
 *      - pm2_5             → Partículas ≤2.5µm (µg/m³)
 *      - no2               → Dióxido de Nitrogênio (µg/m³)
 *      - ozone             → Ozônio troposférico (µg/m³)
 *      - air_quality_level → Classificação textual (ex.: "Bom", "Moderado")
 *
 * 2. Registro de Recursos (Resources):
 *    No modelo InterSCity, cada estação de monitoramento (ou bairro)
 *    é um Resource que possui as capabilities acima.
 *
 * 3. Envio de Medições:
 *    Os dados coletados são enviados via POST ao InterSCity Collector,
 *    passando pelo Kong API Gateway. O payload segue a estrutura:
 *    { data: { [capability_name]: [{ value, timestamp }] } }
 *
 * ─── Fluxo via Kong Gateway ───
 *
 * As requisições ao Collector passam pelo Kong Gateway para
 * balanceamento de carga e controle de acesso:
 *
 *   Coletor → Kong (kong.rasppi.cloud) → InterSCity Collector
 *
 * As URLs base são configuráveis via variáveis de ambiente para
 * permitir diferentes ambientes (dev, staging, prod).
 */
@Injectable()
export class InterscityService implements OnModuleInit {
  private readonly logger = new Logger(InterscityService.name);

  /** URL do catálogo InterSCity (registro de resources e capabilities) */
  private readonly catalogUrl: string;

  /** URL do coletor InterSCity (envio de medições sensoriais) */
  private readonly collectorUrl: string;

  /** URL do Kong API Gateway (upstream para o coletor) */
  private readonly kongUrl: string;

  /** Configurações de retry */
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;

  /**
   * UUID do recurso registrado no InterSCity.
   * É obtido durante a inicialização do módulo (onModuleInit)
   * e reutilizado em todas as chamadas subsequentes.
   */
  private resourceUuid: string | null = null;

  /**
   * Definição das Capacidades (Capabilities) do sistema Ar-Saúde.
   *
   * Cada capability mapeia um indicador ambiental que será
   * enviado como dado sensorial ao InterSCity. O campo `name`
   * deve ser único e em snake_case, pois é usado como chave
   * no payload de medição.
   *
   * O `capability_type` é "sensor" pois todos os indicadores
   * são dados de leitura (produzidos pelo microsserviço),
   * e não comandos de atuação.
   */
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

  /**
   * Hook de inicialização do módulo NestJS.
   *
   * Ao iniciar a aplicação, registra automaticamente:
   * 1. As capabilities (indicadores ambientais) no catálogo.
   * 2. O recurso (estação de monitoramento) com as capabilities associadas.
   *
   * Se o registro falhar, loga o erro mas não impede a inicialização
   * (o registro será reattempted na próxima execução do cron).
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Inicializando integração com InterSCity...');

    try {
      await this.ensureCapabilitiesRegistered();
      await this.ensureResourceRegistered();
      this.logger.log(
        `✅ InterSCity inicializado — Resource UUID: ${this.resourceUuid}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️  Falha ao inicializar InterSCity (será reattempted no próximo cron): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Registra todas as capabilities definidas no catálogo InterSCity.
   *
   * Cada capability é registrada individualmente via POST.
   * Se já existir (HTTP 409 ou 422), o erro é ignorado silenciosamente.
   *
   * Endpoint: POST {catalogUrl}/capabilities
   */
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
        );

        this.logger.log(`  ✓ Capability "${capability.name}" registrada.`);
      } catch (error: unknown) {
        // HTTP 409/422 indica que a capability já existe — ignoramos
        const axiosError = error as { response?: { status?: number } };
        if (
          axiosError?.response?.status === 409 ||
          axiosError?.response?.status === 422
        ) {
          this.logger.log(
            `  ⏭️  Capability "${capability.name}" já existe, pulando.`,
          );
        } else {
          this.logger.warn(
            `  ❌ Erro ao registrar capability "${capability.name}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  }

  /**
   * Garante que o recurso (estação de monitoramento) esteja registrado
   * no InterSCity. Se já existir, busca o UUID existente.
   *
   * ─── Modelagem do Recurso ───
   *
   * O recurso representa a estação de monitoramento de São Luís.
   * Ele é associado a todas as capabilities de qualidade do ar,
   * formando o vínculo Resource ↔ Capabilities no InterSCity.
   *
   * Endpoint: POST {catalogUrl}/resources
   */
  async ensureResourceRegistered(): Promise<void> {
    // Se já temos o UUID em memória, não é necessário re-registrar
    if (this.resourceUuid) {
      return;
    }

    const latitude = this.configService.get<number>('LATITUDE', -2.5293);
    const longitude = this.configService.get<number>('LONGITUDE', -44.3028);

    /**
     * Payload de registro do recurso.
     *
     * O campo `capabilities` lista os nomes das capabilities que
     * este recurso pode produzir dados. O InterSCity usa essa
     * associação para validar os dados recebidos via Collector.
     */
    const resourcePayload: InterscityResourcePayload = {
      data: {
        description: 'Estação de monitoramento de qualidade do ar — São Luís, MA, Brasil (Ar-Saúde)',
        capabilities: this.capabilities.map((c) => c.name),
        status: 'active',
        lat: latitude,
        lon: longitude,
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
        'InterSCity.registerResource',
      );

      this.resourceUuid = response.data?.data?.uuid;
      this.logger.log(
        `✅ Recurso registrado no InterSCity — UUID: ${this.resourceUuid}`,
      );
    } catch (error: unknown) {
      // Se o recurso já existe, tentamos buscar o UUID via listagem
      const axiosError = error as { response?: { status?: number } };
      if (
        axiosError?.response?.status === 409 ||
        axiosError?.response?.status === 422
      ) {
        this.logger.log('Recurso já existe, buscando UUID...');
        await this.fetchExistingResourceUuid();
      } else {
        throw error;
      }
    }
  }

  /**
   * Busca o UUID de um recurso já existente no catálogo InterSCity.
   *
   * Consulta a listagem de recursos e filtra pelo primeiro
   * que contém "Ar-Saúde" na descrição.
   *
   * Endpoint: GET {catalogUrl}/resources
   */
  private async fetchExistingResourceUuid(): Promise<void> {
    try {
      const response = await retryWithBackoff(
        () =>
          firstValueFrom(
            this.httpService.get(`${this.catalogUrl}/resources`),
          ),
        this.maxRetries,
        this.retryBaseDelay,
        'InterSCity.fetchResources',
      );

      const resources = response.data?.resources ?? [];
      const arSaudeResource = resources.find(
        (r: { description?: string }) =>
          r.description?.includes('Ar-Saúde'),
      );

      if (arSaudeResource?.uuid) {
        this.resourceUuid = arSaudeResource.uuid;
        this.logger.log(
          `✅ Recurso existente encontrado — UUID: ${this.resourceUuid}`,
        );
      } else {
        this.logger.warn(
          '⚠️  Nenhum recurso Ar-Saúde encontrado no catálogo.',
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao buscar recursos existentes: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Envia uma medição de qualidade do ar para o InterSCity Collector.
   *
   * ─── Estrutura do Payload de Medição ───
   *
   * O payload segue o formato exigido pelo InterSCity Collector:
   *
   * {
   *   "data": {
   *     "<capability_name>": [
   *       { "value": <valor_medido>, "timestamp": "<ISO 8601>" }
   *     ],
   *     ...
   *   }
   * }
   *
   * Cada chave no objeto `data` corresponde ao `name` de uma
   * Capability registrada previamente. O valor é um array porque
   * o InterSCity suporta envio em lote (múltiplas medições de
   * timestamps diferentes). Neste caso, enviamos uma medição
   * por vez (array com um único elemento).
   *
   * O campo `value` aceita tipos numéricos (para indicadores
   * quantitativos como AQI, PM10, etc.) ou strings (para a
   * classificação textual `air_quality_level`).
   *
   * ─── Roteamento via Kong Gateway ───
   *
   * A requisição é enviada ao endpoint do Collector InterSCity:
   *   POST {collectorUrl}/resources/{uuid}/data
   *
   * Em produção, o collectorUrl pode apontar para o Kong Gateway,
   * que faz o roteamento para o upstream correto do InterSCity.
   *
   * @param data Dados processados de qualidade do ar
   * @throws Erro se o recurso não estiver registrado ou a requisição falhar
   */
  async sendMeasurement(data: ProcessedAirQualityData): Promise<void> {
    // Garante que o recurso esteja registrado antes do envio
    if (!this.resourceUuid) {
      this.logger.warn(
        'Resource UUID não disponível. Tentando re-registrar...',
      );
      await this.ensureResourceRegistered();

      if (!this.resourceUuid) {
        throw new Error(
          'Impossível enviar medição: Resource UUID não encontrado no InterSCity.',
        );
      }
    }

    /**
     * Monta o payload de medição.
     *
     * Cada capability é mapeada para um array contendo um objeto
     * com o valor medido e o timestamp. As capabilities quantitativas
     * (air_quality_index, pm10, pm2_5, no2, ozone) recebem valores
     * numéricos, enquanto air_quality_level recebe uma string
     * com a classificação textual do AQI.
     */
    const measurementPayload: InterscityMeasurementPayload = {
      data: {
        // Capability: Índice de Qualidade do Ar (valor inteiro do European AQI)
        air_quality_index: [
          { value: data.aqi, timestamp: data.timestamp },
        ],

        // Capability: Concentração de PM10 em µg/m³
        pm10: [
          { value: data.pm10, timestamp: data.timestamp },
        ],

        // Capability: Concentração de PM2.5 em µg/m³
        pm2_5: [
          { value: data.pm2_5, timestamp: data.timestamp },
        ],

        // Capability: Concentração de NO₂ em µg/m³
        no2: [
          { value: data.no2, timestamp: data.timestamp },
        ],

        // Capability: Concentração de O₃ em µg/m³
        ozone: [
          { value: data.ozone, timestamp: data.timestamp },
        ],

        // Capability: Classificação textual do nível de qualidade do ar
        // Valores possíveis: "Bom", "Moderado", "Ruim para grupos sensíveis",
        //                    "Ruim", "Muito Ruim", "Perigoso", "Indisponível"
        air_quality_level: [
          { value: data.level, timestamp: data.timestamp },
        ],
      },
    };

    const url = `${this.collectorUrl}/resources/${this.resourceUuid}/data`;

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
      `✅ Medição enviada com sucesso — AQI: ${data.aqi} (${data.level})`,
    );
  }

  /**
   * Retorna o UUID do recurso registrado (para fins de debug/health).
   */
  getResourceUuid(): string | null {
    return this.resourceUuid;
  }
}
