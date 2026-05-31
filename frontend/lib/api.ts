import { Alert, DashboardStats, Measurement } from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  neighborhoodId: string,
  limit = 336,
): Promise<Measurement[]> {
  return request<Measurement[]>(
    `/measurements/history?neighborhoodId=${encodeURIComponent(neighborhoodId)}&limit=${limit}`,
  );
}

export function getActiveAlerts(): Promise<Alert[]> {
  return request<Alert[]>('/alerts/active');
}

export function getAlerts(limit = 50): Promise<Alert[]> {
  return request<Alert[]>(`/alerts?limit=${limit}`);
}

export const apiBaseUrl = API_URL;
