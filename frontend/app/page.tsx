'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import SummaryCards from '@/components/SummaryCards';
import AlertsPanel from '@/components/AlertsPanel';
import NeighborhoodTable from '@/components/NeighborhoodTable';
import PollutantsLegend from '@/components/PollutantsLegend';
import HistoryChart from '@/components/HistoryChart';

import {
  getActiveAlerts,
  getHistory,
  getLatestMeasurements,
  getStats,
} from '@/lib/api';
import { Alert, DashboardStats, Measurement } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

/* Leaflet relies on `window` — load MapaTab only on the client */
const MapaTab = dynamic(() => import('@/components/MapaTab'), { ssr: false });

const REFRESH_MS = 15000;

type TabKey = 'dashboard' | 'historico' | 'alertas' | 'mapa';

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
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [isLightMode, setIsLightMode] = useState(false);

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

  useEffect(() => {
    const stored = localStorage.getItem('arSaudeTheme');
    if (stored === 'light') {
      setIsLightMode(true);
      document.body.classList.add('light-mode');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsLightMode((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('light-mode');
        localStorage.setItem('arSaudeTheme', 'light');
      } else {
        document.body.classList.remove('light-mode');
        localStorage.setItem('arSaudeTheme', 'dark');
      }
      return next;
    });
  }, []);

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
    setActiveTab('historico');
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

          {/* ─── Tab navigation ─── */}
          <nav className="tab-nav" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              className={`tab-btn${activeTab === 'dashboard' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'historico'}
              className={`tab-btn${activeTab === 'historico' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('historico')}
            >
              📈 Histórico
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'alertas'}
              className={`tab-btn${activeTab === 'alertas' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('alertas')}
            >
              🚨 Alertas
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'mapa'}
              className={`tab-btn${activeTab === 'mapa' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('mapa')}
            >
              🗺️ Mapa
            </button>
          </nav>

          <div className="header-status">
            <span className="region-chip">São Luís - MA, Brasil</span>
            <span className="status-dot">
              <span className={`dot ${connected ? 'online' : 'offline'}`} />
              {connected ? 'Conectado ao motor de alertas' : 'Sem conexao'}
            </span>
            <span>
              Atualizado:{' '}
              {updatedAt ? formatDateTime(updatedAt.toISOString()) : '-'}
            </span>
            <button
              onClick={toggleTheme}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px',
              }}
              title="Alternar tema claro/escuro"
            >
              {isLightMode ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <main>
          {loading ? (
            <div className="spinner">
              Carregando dados do motor de alertas...
            </div>
          ) : (
            <>
              <SummaryCards stats={stats} activeAlerts={alerts.length} />

              <div
                className="layout-grid"
                style={{ gridTemplateColumns: '1fr' }}
              >
                <NeighborhoodTable
                  measurements={measurements}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelect}
                />
                <PollutantsLegend />
              </div>

              <div className="footer-note">
                Dados coletados via InterSCity, Open-Meteo e OpenWeatherMap.
                Atualizacao automatica a cada {REFRESH_MS / 1000}s.
              </div>
            </>
          )}
        </main>
      )}

      {/* ─── Histórico Tab ─── */}
      {activeTab === 'historico' && (
        <main>
          {loading ? (
            <div className="spinner">
              Carregando dados do motor de alertas...
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                maxWidth: 1000,
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  background: 'var(--panel-bg, #111827)',
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #233047)',
                }}
              >
                <span
                  style={{
                    color: 'var(--text-muted, #94a3b8)',
                    fontWeight: 600,
                  }}
                >
                  Selecionar Bairro:
                </span>
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) => {
                    const m = measurements.find(
                      (x) => x.neighborhoodId === e.target.value,
                    );
                    if (m) handleSelect(m);
                  }}
                  style={{
                    background: 'var(--panel-2, #1b2638)',
                    color: 'var(--text, #e2e8f0)',
                    border: '1px solid var(--border, #233047)',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 14,
                    flex: 1,
                    outline: 'none',
                  }}
                >
                  <option value="" disabled>
                    -- Escolha um bairro --
                  </option>
                  {[...measurements]
                    .sort((a, b) =>
                      a.neighborhoodName.localeCompare(b.neighborhoodName),
                    )
                    .map((m) => (
                      <option key={m.neighborhoodId} value={m.neighborhoodId}>
                        {m.neighborhoodName}
                      </option>
                    ))}
                </select>
              </div>
              <HistoryChart
                neighborhoodName={selected?.name ?? null}
                history={history}
              />
            </div>
          )}
        </main>
      )}

      {/* ─── Alertas Tab ─── */}
      {activeTab === 'alertas' && (
        <main>
          {loading ? (
            <div className="spinner">
              Carregando dados do motor de alertas...
            </div>
          ) : (
            <AlertsPanel alerts={alerts} />
          )}
        </main>
      )}

      {/* ─── Mapa Tab ─── */}
      {activeTab === 'mapa' && (
        <main className="mapa-main">
          {loading ? (
            <div className="spinner">
              Carregando dados do motor de alertas...
            </div>
          ) : (
            <MapaTab measurements={measurements} stats={stats} />
          )}
        </main>
      )}

      {/* ─── Scoped styles for tabs ─── */}
      <style>{`
        .tab-nav {
          display: flex;
          gap: 4px;
          background: var(--bg, #0b1120);
          border-radius: 8px;
          padding: 3px;
          border: 1px solid var(--border, #233047);
        }
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #94a3b8);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all .15s ease;
          letter-spacing: .02em;
          white-space: nowrap;
        }
        .tab-btn:hover {
          color: var(--text, #e2e8f0);
          background: var(--panel-2, #1b2638);
        }
        .tab-btn.tab-active {
          background: var(--accent, #38bdf8);
          color: var(--bg, #0b1120);
        }
        .mapa-main {
          max-width: 100% !important;
          padding: 16px 24px !important;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 80px);
        }
      `}</style>
    </>
  );
}
