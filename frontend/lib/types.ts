export interface Measurement {
  id: string;
  locationId: string;
  locationName: string;
  resourceUuid: string;
  aqi: number | null;
  level: string;
  pm10: number | null;
  pm2_5: number | null;
  no2: number | null;
  ozone: number | null;
  co: number | null;
  so2: number | null;
  nh3: number | null;
  no: number | null;
  latitude: number | null;
  longitude: number | null;
  measuredAt: string;
  createdAt: string;
}

export type AlertSeverity = 'atencao' | 'alerta' | 'critico' | 'emergencia';
export type AlertStatus = 'active' | 'resolved';

export interface Alert {
  id: string;
  locationId: string;
  locationName: string;
  resourceUuid: string;
  aqi: number;
  peakAqi: number;
  level: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  latitude: number | null;
  longitude: number | null;
  triggeredAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  triggeredBy?: string[];
}

export interface LevelDistribution {
  level: string;
  count: number;
}

export interface DashboardStats {
  monitoredLocations: number;
  totalMeasurements: number;
  averageAqi: number | null;
  worst: { locationName: string; aqi: number; level: string } | null;
  best: { locationName: string; aqi: number; level: string } | null;
  distribution: LevelDistribution[];
  updatedAt: string;
}
