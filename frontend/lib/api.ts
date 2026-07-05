import { Alert, DashboardStats, Measurement, RankingResult } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Requisicao falhou (${response.status}): ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/measurements/stats');
}

export function getLatestMeasurements(): Promise<Measurement[]> {
  return request<Measurement[]>('/measurements/latest');
}

export function getHistory(
  locationId: string,
  limit = 336,
): Promise<Measurement[]> {
  return request<Measurement[]>(
    `/measurements/history?locationId=${encodeURIComponent(locationId)}&limit=${limit}`,
  );
}

export function exportMeasurements(
  startDate?: string,
  endDate?: string,
): Promise<Measurement[]> {
  let url = '/measurements/export';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const query = params.toString();
  if (query) url += `?${query}`;
  
  return request<Measurement[]>(url);
}

export function getActiveAlerts(): Promise<Alert[]> {
  return request<Alert[]>('/alerts/active');
}

export function getAlerts(limit = 50): Promise<Alert[]> {
  return request<Alert[]>(`/alerts?limit=${limit}`);
}

export function getRanking(
  index: string = 'aqi',
  period: string = '30d',
): Promise<RankingResult> {
  return request<RankingResult>(
    `/measurements/ranking?index=${encodeURIComponent(index)}&period=${encodeURIComponent(period)}`,
  );
}

export const apiBaseUrl = API_URL;
