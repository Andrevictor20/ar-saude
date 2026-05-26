/**
 * =====================================================
 * Interfaces compartilhadas — Qualidade do Ar
 * =====================================================
 *
 * Define os contratos de dados usados entre os módulos
 * OpenMeteo, InterSCity e Collector.
 */

/**
 * Dados brutos de qualidade do ar retornados pela API Open-Meteo.
 * Corresponde à resposta JSON da Air Quality API após parsing.
 */
export interface AirQualityData {
  /** Timestamp ISO 8601 da medição */
  timestamp: string;

  /** Índice de Qualidade do Ar Europeu (European AQI) — valor inteiro */
  aqi: number | null;

  /** Concentração de PM10 (µg/m³) */
  pm10: number | null;

  /** Concentração de PM2.5 (µg/m³) */
  pm2_5: number | null;

  /** Concentração de NO₂ — Dióxido de Nitrogênio (µg/m³) */
  no2: number | null;

  /** Concentração de O₃ — Ozônio (µg/m³) */
  ozone: number | null;
}

/**
 * Classificação textual do nível de qualidade do ar
 * baseada no valor do AQI europeu.
 */
export type AirQualityLevel =
  | 'Bom'
  | 'Moderado'
  | 'Ruim para grupos sensíveis'
  | 'Ruim'
  | 'Muito Ruim'
  | 'Perigoso'
  | 'Indisponível';

/**
 * Dado processado pronto para envio ao InterSCity.
 * Inclui a classificação textual do AQI e metadados de localização.
 */
export interface ProcessedAirQualityData extends AirQualityData {
  /** Classificação textual do AQI */
  level: AirQualityLevel;

  /** Latitude da estação de medição */
  latitude: number;

  /** Longitude da estação de medição */
  longitude: number;
}
