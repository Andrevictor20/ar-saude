import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsIn, IsDateString } from "class-validator";
import { AirQualityLevel } from "../../common/air-quality";

export class IngestMeasurementDto {
  @ApiProperty({ description: "ID único do local (cidade/município)", example: "loc_123" })
  @IsString()
  locationId: string;

  @ApiProperty({ description: "Nome do local", example: "São Paulo - SP" })
  @IsString()
  locationName: string;

  @ApiProperty({ description: "Latitude do local", example: -23.5505 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: "Longitude do local", example: -46.6333 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ description: "Índice de Qualidade do Ar (AQI)", example: 45 })
  @IsOptional()
  @IsNumber()
  aqi: number | null;

  @ApiProperty({ description: "Nível de qualidade do ar", enum: ["Bom", "Moderado", "Ruim para grupos sensíveis", "Ruim", "Muito Ruim", "Perigoso", "Indisponível"], example: "Bom" })
  @IsString()
  @IsIn(["Bom", "Moderado", "Ruim para grupos sensíveis", "Ruim", "Muito Ruim", "Perigoso", "Indisponível"])
  level: AirQualityLevel;

  @ApiPropertyOptional({ description: "Material particulado PM10", example: 12.5 })
  @IsOptional()
  @IsNumber()
  pm10: number | null;

  @ApiPropertyOptional({ description: "Material particulado PM2.5", example: 5.2 })
  @IsOptional()
  @IsNumber()
  pm2_5: number | null;

  @ApiPropertyOptional({ description: "Dióxido de nitrogênio (NO2)", example: 20 })
  @IsOptional()
  @IsNumber()
  no2: number | null;

  @ApiPropertyOptional({ description: "Ozônio (O3)", example: 35 })
  @IsOptional()
  @IsNumber()
  ozone: number | null;

  @ApiPropertyOptional({ description: "Monóxido de carbono (CO)", example: 250 })
  @IsOptional()
  @IsNumber()
  co: number | null;

  @ApiPropertyOptional({ description: "Dióxido de enxofre (SO2)", example: 2.1 })
  @IsOptional()
  @IsNumber()
  so2: number | null;

  @ApiPropertyOptional({ description: "Amônia (NH3)", example: 1.5 })
  @IsOptional()
  @IsNumber()
  nh3: number | null;

  @ApiPropertyOptional({ description: "Monóxido de nitrogênio (NO)", example: 0.5 })
  @IsOptional()
  @IsNumber()
  no: number | null;

  @ApiProperty({ description: "Timestamp da coleta", example: "2026-07-04T12:00:00Z" })
  @IsString()
  timestamp: string;
}
