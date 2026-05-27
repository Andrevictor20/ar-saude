'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import SummaryCards from '@/components/SummaryCards';
import AlertsPanel from '@/components/AlertsPanel';
import NeighborhoodTable from '@/components/NeighborhoodTable';
import HistoryChart from '@/components/HistoryChart';

import {
  getActiveAlerts,
  getHistory,
  getLatestMeasurements,
  getStats,
} from '@/lib/api';
import { Alert, DashboardStats, Measurement } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

const REFRESH_MS = 15000;

interface Selected {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedRef = useRef<Selected | null>(null);
  selectedRef.current = selected;

  const load = useCallback(async () => {
    try {
      const [s, m, a] = await Promise.all([
        getStats(),
        getLatestMeasurements(),
        getActiveAlerts(),
      ]);
      setStats(s);
      setMeasurements(m);
      setAlerts(a);
      setConnected(true);
      setUpdatedAt(new Date());

      const current = selectedRef.current;
      if (current) {
        const h = await getHistory(current.id);
        setHistory(h);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleSelect = useCallback(async (m: Measurement) => {
    const next = { id: m.neighborhoodId, name: m.neighborhoodName };
    setSelected(next);
    selectedRef.current = next;
    try {
      const h = await getHistory(next.id);
      setHistory(h);
    } catch {
      setHistory([]);
    }
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-title">Ar-Saude</span>
            <span className="brand-subtitle">
              Monitoramento da Qualidade do Ar · São Luís - MA, Brasil
            </span>
          </div>
          <div className="header-status">
            <span className="region-chip">São Luís - MA, Brasil</span>
            <span className="status-dot">
              <span className={`dot ${connected ? 'online' : 'offline'}`} />
              {connected ? 'Conectado ao motor de alertas' : 'Sem conexao'}
            </span>
            <span>
              Atualizado: {updatedAt ? formatDateTime(updatedAt.toISOString()) : '-'}
            </span>
          </div>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="spinner">Carregando dados do motor de alertas...</div>
        ) : (
          <>
            <SummaryCards stats={stats} activeAlerts={alerts.length} />

            <div className="layout-grid">
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                <NeighborhoodTable
                  measurements={measurements}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelect}
                />
                <HistoryChart
                  neighborhoodName={selected?.name ?? null}
                  history={history}
                />
              </div>

              <AlertsPanel alerts={alerts} />
            </div>

            <div className="footer-note">
              Dados coletados via InterSCity e Open-Meteo. Atualizacao
              automatica a cada {REFRESH_MS / 1000}s.
            </div>
          </>
        )}
      </main>
    </>
  );
}
