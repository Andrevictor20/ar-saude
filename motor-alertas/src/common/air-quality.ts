export type AirQualityLevel =
  | 'Bom'
  | 'Moderado'
  | 'Ruim para grupos sensiveis'
  | 'Ruim'
  | 'Muito Ruim'
  | 'Perigoso'
  | 'Indisponivel';

export type AlertSeverity = 'atencao' | 'alerta' | 'critico' | 'emergencia';

export function classifyAqi(aqi: number | null | undefined): AirQualityLevel {
  if (aqi === null || aqi === undefined) return 'Indisponivel';
  if (aqi <= 20) return 'Bom';
  if (aqi <= 40) return 'Moderado';
  if (aqi <= 60) return 'Ruim para grupos sensiveis';
  if (aqi <= 80) return 'Ruim';
  if (aqi <= 100) return 'Muito Ruim';
  return 'Perigoso';
}

export function severityForAqi(aqi: number | null | undefined): AlertSeverity | null {
  if (aqi === null || aqi === undefined) return null;
  if (aqi > 100) return 'emergencia';
  if (aqi > 80) return 'critico';
  if (aqi > 60) return 'alerta';
  if (aqi > 40) return 'atencao';
  return null;
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
