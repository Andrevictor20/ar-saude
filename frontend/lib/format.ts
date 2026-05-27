import { AlertSeverity } from './types';

export function aqiColor(aqi: number | null): string {
  if (aqi === null || aqi === undefined) return '#64748b';
  if (aqi <= 20) return '#22c55e';
  if (aqi <= 40) return '#84cc16';
  if (aqi <= 60) return '#eab308';
  if (aqi <= 80) return '#f97316';
  if (aqi <= 100) return '#ef4444';
  return '#a855f7';
}

export function levelColor(level: string): string {
  switch (level) {
    case 'Bom':
      return '#22c55e';
    case 'Moderado':
      return '#84cc16';
    case 'Ruim para grupos sensiveis':
      return '#eab308';
    case 'Ruim':
      return '#f97316';
    case 'Muito Ruim':
      return '#ef4444';
    case 'Perigoso':
      return '#a855f7';
    default:
      return '#64748b';
  }
}

export function severityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'atencao':
      return '#eab308';
    case 'alerta':
      return '#f97316';
    case 'critico':
      return '#ef4444';
    case 'emergencia':
      return '#a855f7';
    default:
      return '#64748b';
  }
}

export function severityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'atencao':
      return 'Atencao';
    case 'alerta':
      return 'Alerta';
    case 'critico':
      return 'Critico';
    case 'emergencia':
      return 'Emergencia';
    default:
      return severity;
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number | null, digits = 1): string {
  if (value === null || value === undefined) return '-';
  return value.toFixed(digits);
}
