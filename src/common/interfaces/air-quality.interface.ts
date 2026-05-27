/** Dados brutos retornados pela API Open-Meteo. */
export interface AirQualityData {
  timestamp: string;
  aqi: number | null;
  pm10: number | null;
  pm2_5: number | null;
  no2: number | null;
  ozone: number | null;
}

/** Classificação textual do nível de qualidade do ar. */
export type AirQualityLevel =
  | 'Bom'
  | 'Moderado'
  | 'Ruim para grupos sensíveis'
  | 'Ruim'
  | 'Muito Ruim'
  | 'Perigoso'
  | 'Indisponível';

/** Dado processado pronto para envio ao InterSCity. */
export interface ProcessedAirQualityData extends AirQualityData {
  level: AirQualityLevel;
  neighborhoodId: string;
  neighborhoodName: string;
  latitude: number;
  longitude: number;
}
