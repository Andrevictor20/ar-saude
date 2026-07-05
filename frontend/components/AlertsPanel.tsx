'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertSeverity } from '@/lib/types';
import { formatDateTime, severityColor, severityLabel } from '@/lib/format';

interface Props {
  alerts: Alert[];
}

const SEVERITY_ORDER: AlertSeverity[] = ['emergencia', 'critico', 'alerta', 'atencao'];

const SEVERITY_TABS: { key: 'todos' | AlertSeverity; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'emergencia', label: 'Emergência' },
  { key: 'critico', label: 'Crítico' },
  { key: 'alerta', label: 'Alerta' },
  { key: 'atencao', label: 'Atenção' },
];

export default function AlertsPanel({ alerts }: Props) {
  const [activeTab, setActiveTab] = useState<'todos' | AlertSeverity>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  /* Count per severity */
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: alerts.length };
    alerts.forEach((a) => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  /* Group alerts */
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, Alert & { locations: string[] }>();
    
    let filtered = alerts;
    
    /* Filter by severity tab */
    if (activeTab !== 'todos') {
      filtered = filtered.filter((a) => a.severity === activeTab);
    }

    /* Filter by search query */
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((a) => a.locationName.toLowerCase().includes(q));
    }

    filtered.forEach((alert) => {
      const triggersSig = alert.triggeredBy
        ? [...alert.triggeredBy].sort().join('|')
        : '';
      const key = `${alert.severity}|${alert.aqi}|${alert.peakAqi}|${triggersSig}`;
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        if (!existing.locations.includes(alert.locationName)) {
          existing.locations.push(alert.locationName);
        }
      } else {
        groups.set(key, { ...alert, locations: [alert.locationName] });
      }
    });

    let result = Array.from(groups.values());

    /* Sort by AQI */
    result.sort((a, b) => {
      const priorityA = SEVERITY_ORDER.indexOf(a.severity);
      const priorityB = SEVERITY_ORDER.indexOf(b.severity);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return sortAsc ? a.aqi - b.aqi : b.aqi - a.aqi;
    });

    return result;
  }, [alerts, activeTab, searchQuery, sortAsc]);

  const totalFiltered = useMemo(() => {
    let count = 0;
    groupedAlerts.forEach((g) => {
      count += g.locations.length;
    });
    return count;
  }, [groupedAlerts]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Alertas ativos</h2>
        <span
          className="badge"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid var(--border)' }}
        >
          {alerts.length} alertas
          {totalFiltered !== alerts.length && ` · ${groupedAlerts.length} exibidos`}
        </span>
      </div>

      {/* Severity Sub-Tabs */}
      <div className="alert-tabs">
        {SEVERITY_TABS.map((tab) => {
          const count = severityCounts[tab.key] || 0;
          const color = tab.key === 'todos' ? 'var(--accent)' : severityColor(tab.key as AlertSeverity);
          return (
            <button
              key={tab.key}
              className={`alert-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              {tab.key !== 'todos' && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                />
              )}
              {tab.label}
              <span
                className="tab-badge"
                style={{
                  background: activeTab === tab.key ? `${color}20` : 'rgba(255,255,255,0.05)',
                  color: activeTab === tab.key ? color : 'var(--text-dim)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Sort */}
      <div className="alert-toolbar">
        <input
          type="text"
          placeholder="🔍 Buscar por localidade..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button
          className="sort-toggle"
          onClick={() => setSortAsc(!sortAsc)}
          title={sortAsc ? 'AQI: menor → maior' : 'AQI: maior → menor'}
        >
          {sortAsc ? '▲' : '▼'} AQI {sortAsc ? 'menor → maior' : 'maior → menor'}
        </button>
      </div>

      <div className="panel-body">
        {groupedAlerts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            {activeTab === 'todos' && !searchQuery
              ? 'Nenhum alerta ativo no momento.'
              : 'Nenhum alerta encontrado para o filtro selecionado.'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '16px',
            }}
          >
            {groupedAlerts.map((group) => {
              const color = severityColor(group.severity);
              const riskPercent = Math.min((group.aqi / 100) * 100, 100);
              return (
                <div
                  key={group.id}
                  className="alert-item"
                  style={{
                    borderLeftColor: color,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    className="alert-top"
                    style={{
                      alignItems: 'flex-start',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        paddingBottom: '12px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: `${color}15`,
                          border: `1px solid ${color}30`,
                          flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      </span>
                      <span
                        style={{
                          color: color,
                          fontSize: '14px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {severityLabel(group.severity)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          marginLeft: 'auto',
                          background: `${color}15`,
                          color: color,
                          border: `1px solid ${color}30`,
                          fontSize: 10,
                        }}
                      >
                        AQI {group.aqi}
                      </span>
                    </div>

                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                    >
                      {group.locations.map((n, i) => (
                        <span
                          key={i}
                          className="badge"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="alert-msg"
                    style={{ flex: 1, marginTop: '12px' }}
                  >
                    {group.message.replace(` em ${group.locationName}`, '')}
                  </div>

                  {/* Risk Progress Bar */}
                  <div className="alert-risk-bar">
                    <div
                      className="alert-risk-fill"
                      style={{
                        width: `${riskPercent}%`,
                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                      }}
                    />
                  </div>

                  <div className="alert-meta">
                    <span>AQI atual: {group.aqi}</span>
                    <span>Pico: {group.peakAqi}</span>
                    <span>Desde {formatDateTime(group.triggeredAt)}</span>
                  </div>

                  {group.triggeredBy && group.triggeredBy.length > 0 && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        lineHeight: 1.6,
                      }}
                    >
                      <strong style={{ color: 'var(--text)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        💡 Dicas de proteção
                      </strong>
                      <div style={{ marginTop: 6 }}>
                        {group.triggeredBy
                          .map((trigger) => {
                            if (
                              trigger.startsWith('PM2.5') ||
                              trigger.startsWith('PM10')
                            )
                              return '😷 Use máscara, evite exercícios ao ar livre.';
                            if (trigger.startsWith('O3'))
                              return '☀️ Evite o sol forte e atividades intensas à tarde.';
                            if (
                              trigger.startsWith('NO2') ||
                              trigger.startsWith('SO2')
                            )
                              return '🫁 Fique em ambientes fechados se tiver problemas respiratórios.';
                            if (trigger.startsWith('CO'))
                              return '🚗 Evite áreas de tráfego intenso.';
                            return '';
                          })
                          .filter(Boolean)
                          .map((tip, i) => (
                            <div key={i} style={{ marginTop: i > 0 ? 4 : 0 }}>{tip}</div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
