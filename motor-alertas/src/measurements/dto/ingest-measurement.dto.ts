import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AirQualityLevel } from "../../common/air-quality";

export class IngestMeasurementDto {
  @ApiProperty({ description: "ID único do local (cidade/município)", example: "loc_123" })
  locationId: string;

  @ApiProperty({ description: "Nome do local", example: "São Paulo - SP" })
  locationName: string;

  @ApiProperty({ description: "Latitude do local", example: -23.5505 })
  latitude: number;

  @ApiProperty({ description: "Longitude do local", example: -46.6333 })
  longitude: number;

  @ApiPropertyOptional({ description: "Índice de Qualidade do Ar (AQI)", example: 45 })
  aqi: number | null;

  @ApiProperty({ description: "Nível de qualidade do ar", enum: ["boa", "moderada", "ruim", "muito_ruim", "pessima", "indisponivel"], example: "boa" })
  level: AirQualityLevel;

  @ApiPropertyOptional({ description: "Material particulado PM10", example: 12.5 })
  pm10: number | null;

  @ApiPropertyOptional({ description: "Material particulado PM2.5", example: 5.2 })
  pm2_5: number | null;

  @ApiPropertyOptional({ description: "Dióxido de nitrogênio (NO2)", example: 20 })
  no2: number | null;

  @ApiPropertyOptional({ description: "Ozônio (O3)", example: 35 })
  ozone: number | null;

  @ApiPropertyOptional({ description: "Monóxido de carbono (CO)", example: 250 })
  co: number | null;

  @ApiPropertyOptional({ description: "Dióxido de enxofre (SO2)", example: 2.1 })
  so2: number | null;

  @ApiPropertyOptional({ description: "Amônia (NH3)", example: 1.5 })
  nh3: number | null;

  @ApiPropertyOptional({ description: "Monóxido de nitrogênio (NO)", example: 0.5 })
  no: number | null;

  @ApiProperty({ description: "Timestamp da coleta", example: "2026-07-04T12:00:00Z" })
  timestamp: string;
}
