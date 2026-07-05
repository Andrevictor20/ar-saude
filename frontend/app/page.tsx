'use client'; // Re-trigger frontend build

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import SummaryCards from '@/components/SummaryCards';
import AlertsPanel from '@/components/AlertsPanel';
import LocationTable from '@/components/LocationTable';
import PollutantsLegend from '@/components/PollutantsLegend';
import HistoryChart from '@/components/HistoryChart';
import HistoryRanking from '@/components/HistoryRanking';
import ChartsTab from '@/components/ChartsTab';

import {
  apiBaseUrl,
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

type TabKey = 'dashboard' | 'historico' | 'alertas' | 'mapa' | 'graficos';

interface Selected {
  id: string;
  name: string;
}

/* ─── Skeleton Components ─── */
function SkeletonCards() {
  return (
    <section>
      <div className="cards-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </section>
  );
}

function SkeletonTable() {
  return (
    <div className="panel" style={{ padding: '20px' }}>
      <div className="skeleton" style={{ height: 20, width: 200, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="skeleton skeleton-table-row" style={{ animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
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
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

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

  // Alertas em tempo real via Server-Sent Events (push do Motor de Alertas).
  // Em vez de depender só do polling, reagimos a cada evento created/resolved.
  useEffect(() => {
    const source = new EventSource(`${apiBaseUrl}/alerts/stream`);

    const refreshAlerts = () => {
      getActiveAlerts()
        .then((a) => {
          setAlerts(a);
          setConnected(true);
          setUpdatedAt(new Date());
        })
        .catch(() => undefined);
    };

    source.addEventListener('created', refreshAlerts);
    source.addEventListener('resolved', refreshAlerts);
    source.addEventListener('updated', refreshAlerts);
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, []);

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
    const next = { id: m.locationId, name: m.locationName };
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.svg" alt="Ar-Saúde Logo" width="40" height="40" />
            <div className="brand">
              <span className="brand-title">Ar-Saúde</span>
              <span className="brand-subtitle">Monitoramento da Qualidade do Ar · Brasil</span>
            </div>
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
              {alerts.length > 0 && (
                <span className="tab-badge-count">{alerts.length}</span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'graficos'}
              className={`tab-btn${activeTab === 'graficos' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('graficos')}
            >
              📊 Gráficos
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
            <span className="region-chip">Brasil</span>
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
            <>
              <SkeletonCards />
              <SkeletonTable />
            </>
          ) : (
            <>
              <SummaryCards 
                stats={stats} 
                activeAlerts={alerts.length} 
                onNavigateAlerts={() => setActiveTab('alertas')}
                onNavigateMap={(lat, lng) => {
                  setMapFocus([lat, lng]);
                  setActiveTab('mapa');
                }}
              />

              <div
                className="layout-grid"
                style={{ gridTemplateColumns: '1fr' }}
              >
                <LocationTable
                  measurements={measurements}
                  selectedId={selected?.id ?? null}
                  onSelect={handleSelect}
                />
                <PollutantsLegend />
              </div>

              <div className="footer-note">
                Dados coletados via Motor de Alertas, Open-Meteo e OpenWeatherMap.
                Atualização automática a cada {REFRESH_MS / 1000}s.
              </div>
            </>
          )}
        </main>
      )}

      {/* ─── Histórico Tab ─── */}
      {activeTab === 'historico' && (
        <main>
          {loading ? (
            <>
              <div className="skeleton" style={{ height: 60, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 450, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 300, borderRadius: 12 }} />
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: '1px solid var(--glass-border)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Selecionar Localidade:
                </span>
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) => {
                    const m = measurements.find(
                      (x) => x.locationId === e.target.value,
                    );
                    if (m) handleSelect(m);
                  }}
                  style={{
                    background: 'var(--panel-2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 14,
                    flex: 1,
                    outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  <option value="" disabled>
                    -- Escolha uma localidade --
                  </option>
                  {[...measurements]
                    .sort((a, b) =>
                      a.locationName.localeCompare(b.locationName),
                    )
                    .map((m) => (
                      <option key={m.locationId} value={m.locationId}>
                        {m.locationName}
                      </option>
                    ))}
                </select>
              </div>
              <HistoryChart
                locationName={selected?.name ?? null}
                history={history}
              />
              <HistoryRanking />
            </div>
          )}
        </main>
      )}

      {/* ─── Alertas Tab ─── */}
      {activeTab === 'alertas' && (
        <main>
          {loading ? (
            <div className="panel" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 20, width: 150, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 180, borderRadius: 10, animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <AlertsPanel alerts={alerts} />
          )}
        </main>
      )}

      {/* ─── Mapa Tab ─── */}
      {activeTab === 'mapa' && (
        <main className="mapa-main" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div className="skeleton" style={{ height: 'calc(100vh - 120px)', borderRadius: 12, width: '100%' }} />
          ) : (
            <MapaTab measurements={measurements} stats={stats} focus={mapFocus} />
          )}
        </main>
      )}

      {/* ─── Gráficos Tab ─── */}
      {activeTab === 'graficos' && (
        <main>
          {loading ? (
            <div className="skeleton" style={{ height: 'calc(100vh - 120px)', borderRadius: 12, width: '100%' }} />
          ) : (
            <ChartsTab measurements={measurements} stats={stats} alerts={alerts} />
          )}
        </main>
      )}

      {/* ─── Mobile Bottom Navigation ─── */}
      <nav className="mobile-bottom-nav">
        <button role="tab" aria-selected={activeTab === 'dashboard'} className={`bottom-nav-btn${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span className="icon">📊</span>
          <span className="label">Painel</span>
        </button>
        <button role="tab" aria-selected={activeTab === 'historico'} className={`bottom-nav-btn${activeTab === 'historico' ? ' active' : ''}`} onClick={() => setActiveTab('historico')}>
          <span className="icon">📈</span>
          <span className="label">Evolução</span>
        </button>
        <button role="tab" aria-selected={activeTab === 'alertas'} className={`bottom-nav-btn${activeTab === 'alertas' ? ' active' : ''}`} onClick={() => setActiveTab('alertas')}>
          <div style={{ position: 'relative' }}>
            <span className="icon">🚨</span>
            {alerts.length > 0 && <span className="mobile-nav-badge">{alerts.length}</span>}
          </div>
          <span className="label">Alertas</span>
        </button>
        <button role="tab" aria-selected={activeTab === 'graficos'} className={`bottom-nav-btn${activeTab === 'graficos' ? ' active' : ''}`} onClick={() => setActiveTab('graficos')}>
          <span className="icon">📉</span>
          <span className="label">Gráficos</span>
        </button>
        <button role="tab" aria-selected={activeTab === 'mapa'} className={`bottom-nav-btn${activeTab === 'mapa' ? ' active' : ''}`} onClick={() => setActiveTab('mapa')}>
          <span className="icon">🗺️</span>
          <span className="label">Mapa</span>
        </button>
      </nav>

      {/* ─── Scoped styles for tabs ─── */}
      <style>{`
        .tab-nav {
          display: flex;
          gap: 4px;
          background: var(--bg, #0b1120);
          border-radius: 10px;
          padding: 4px;
          border: 1px solid var(--border, #233047);
        }
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #94a3b8);
          font-size: 12px;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease, color 0.15s ease;
          letter-spacing: .02em;
          white-space: nowrap;
          font-family: 'Inter', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .tab-btn:active {
          transform: scale(0.96);
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
