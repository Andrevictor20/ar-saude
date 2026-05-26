/**
 * =====================================================
 * Interfaces InterSCity — Payloads
 * =====================================================
 *
 * Define a estrutura dos payloads enviados para a
 * plataforma de Cidades Inteligentes InterSCity.
 *
 * ─── Modelo de Domínio ───
 *
 * No InterSCity, a modelagem segue dois conceitos-chave:
 *
 * 1. RECURSO (Resource): Representa uma "coisa" no mundo real.
 *    No contexto do Ar-Saúde, cada **bairro** de São Luís é
 *    modelado como um Recurso. Exemplo: "Centro", "Renascença".
 *
 * 2. CAPACIDADE (Capability): Representa um tipo de dado que
 *    um recurso pode produzir ou consumir. No Ar-Saúde, as
 *    capacidades são os indicadores ambientais:
 *      - air_quality_index (AQI europeu)
 *      - pm10             (Partículas ≤10µm)
 *      - pm2_5            (Partículas ≤2.5µm)
 *      - no2              (Dióxido de Nitrogênio)
 *      - ozone            (Ozônio troposférico)
 *      - air_quality_level (classificação textual)
 *
 * ─── Fluxo de Dados ───
 *
 *   Open-Meteo API
 *       │
 *       ▼
 *   OpenMeteoService (coleta + retry)
 *       │
 *       ▼
 *   InterscityService
 *       ├── registerCapabilities()  → POST /catalog/capabilities
 *       ├── registerResource()      → POST /catalog/resources
 *       └── sendMeasurement()       → POST /collector/resources/{uuid}/data
 *           │
 *           ▼
 *       Kong Gateway → InterSCity Collector
 */

/**
 * Payload para registro de uma Capacidade no InterSCity.
 *
 * Exemplo:
 * {
 *   "name": "air_quality_index",
 *   "description": "Índice de Qualidade do Ar (European AQI)",
 *   "capability_type": "sensor"
 * }
 */
export interface InterscityCapabilityPayload {
  /** Nome único da capacidade (snake_case) */
  name: string;

  /** Descrição humana da capacidade */
  description: string;

  /**
   * Tipo da capacidade:
   * - "sensor": produz dados (leitura)
   * - "actuator": consome comandos (escrita)
   */
  capability_type: 'sensor' | 'actuator';
}

/**
 * Payload para registro de um Recurso (bairro) no InterSCity.
 *
 * Exemplo:
 * {
 *   "data": {
 *     "description": "Estação de monitoramento — São Luís, MA",
 *     "capabilities": ["air_quality_index", "pm10", "pm2_5", "no2", "ozone"],
 *     "status": "active",
 *     "lat": -2.5293,
 *     "lon": -44.3028
 *   }
 * }
 */
export interface InterscityResourcePayload {
  data: {
    /** Descrição textual do recurso */
    description: string;

    /** Lista de nomes de capacidades associadas */
    capabilities: string[];

    /** Status do recurso */
    status: 'active' | 'inactive';

    /** Latitude do recurso */
    lat: number;

    /** Longitude do recurso */
    lon: number;
  };
}

/**
 * Payload de envio de medição sensorial ao InterSCity Collector.
 *
 * ─── Estrutura das Capacidades no Payload ───
 *
 * O campo `data` é um objeto cujas chaves são os nomes das
 * Capacidades previamente registradas. Cada chave mapeia para
 * um array de valores (permitindo envio em lote), onde cada
 * elemento contém o valor medido e o timestamp da leitura.
 *
 * Exemplo:
 * {
 *   "data": {
 *     "air_quality_index": [{ "value": 42, "timestamp": "2026-05-25T22:00:00Z" }],
 *     "pm10":              [{ "value": 18.5, "timestamp": "2026-05-25T22:00:00Z" }],
 *     "pm2_5":             [{ "value": 7.2, "timestamp": "2026-05-25T22:00:00Z" }],
 *     "no2":               [{ "value": 12.3, "timestamp": "2026-05-25T22:00:00Z" }],
 *     "ozone":             [{ "value": 55.0, "timestamp": "2026-05-25T22:00:00Z" }],
 *     "air_quality_level":  [{ "value": "Bom", "timestamp": "2026-05-25T22:00:00Z" }]
 *   }
 * }
 *
 * Cada chave corresponde a uma Capability registrada no catálogo.
 * O InterSCity armazena esses valores como séries temporais,
 * permitindo consultas históricas por recurso e capacidade.
 */
export interface InterscityMeasurementPayload {
  data: {
    [capabilityName: string]: Array<{
      /** Valor medido (numérico ou textual) */
      value: number | string | null;

      /** Timestamp ISO 8601 da medição */
      timestamp: string;
    }>;
  };
}

/**
 * Resposta do InterSCity ao registrar/consultar um recurso.
 */
export interface InterscityResourceResponse {
  data: {
    uuid: string;
    description: string;
    capabilities: string[];
    status: string;
    lat: number;
    lon: number;
    [key: string]: unknown;
  };
}
