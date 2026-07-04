import { AirQualityLevel } from "../../common/air-quality";

export interface IngestMeasurementDto {
  neighborhoodId: string;
  neighborhoodName: string;
  latitude: number;
  longitude: number;
  aqi: number | null;
  level: AirQualityLevel;
  pm10: number | null;
  pm2_5: number | null;
  no2: number | null;
  ozone: number | null;
  co: number | null;
  so2: number | null;
  nh3: number | null;
  no: number | null;
  timestamp: string;
}
