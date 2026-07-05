'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertSeverity } from '@/lib/types';
import { formatDateTime, severityColor, severityLabel } from '@/lib/format';
import { getStateUF } from '@/lib/states';

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
  const [expandedStateId, setExpandedStateId] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  /* Count per severity */
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: alerts.length };
    alerts.forEach((a) => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  /* Group alerts by State */
  const stateGroups = useMemo(() => {
    let filtered = alerts;
    
    if (activeTab !== 'todos') {
      filtered = filtered.filter((a) => a.severity === activeTab);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((a) => a.locationName.toLowerCase().includes(q));
    }

    const groups = new Map<string, Alert[]>();
    filtered.forEach((alert) => {
      const stateKey = getStateUF(alert.state) || 'Outros';
      if (!groups.has(stateKey)) groups.set(stateKey, []);
      groups.get(stateKey)!.push(alert);
    });

    let result = Array.from(groups.entries()).map(([state, stateAlerts]) => {
      stateAlerts.sort((a, b) => {
        const priorityA = SEVERITY_ORDER.indexOf(a.severity);
        const priorityB = SEVERITY_ORDER.indexOf(b.severity);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return sortAsc ? a.aqi - b.aqi : b.aqi - a.aqi;
      });
      return {
        state,
        alerts: stateAlerts,
        maxAqi: stateAlerts.length > 0 ? stateAlerts[0].aqi : 0,
        worstSeverity: stateAlerts[0]?.severity || 'atencao'
      };
    });

    result.sort((a, b) => {
      const priorityA = SEVERITY_ORDER.indexOf(a.worstSeverity as AlertSeverity);
      const priorityB = SEVERITY_ORDER.indexOf(b.worstSeverity as AlertSeverity);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return sortAsc ? a.maxAqi - b.maxAqi : b.maxAqi - a.maxAqi;
    });

    return result;
  }, [alerts, activeTab, searchQuery, sortAsc]);

  const toggleStateExpand = (state: string) => {
    setExpandedStateId(prev => (prev === state ? null : state));
    setExpandedAlertId(null);
  };

  const toggleAlertExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedAlertId(prev => (prev === id ? null : id));
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Monitor de Alertas por Estado</h2>
        <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {alerts.length} eventos ativos
        </span>
      </div>

      <div className="alert-tabs" style={{ padding: '16px 20px 0', borderBottom: 'none' }}>
        {SEVERITY_TABS.map((tab) => {
          const count = severityCounts[tab.key] || 0;
          const color = tab.key === 'todos' ? 'var(--accent)' : severityColor(tab.key as AlertSeverity);
          return (
            <button
              key={tab.key}
              className={`alert-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key as any);
                setExpandedStateId(null);
              }}
              style={activeTab === tab.key ? { background: `${color}15`, color: color, borderColor: `${color}40` } : {}}
            >
              {tab.key !== 'todos' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
              {tab.label}
              <span className="tab-badge" style={{ background: activeTab === tab.key ? `${color}20` : 'var(--panel-2)', color: activeTab === tab.key ? color : 'var(--text-dim)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="alert-toolbar" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por localidade afetada..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ minWidth: 260, flex: 1 }}
        />
        <button className="sort-toggle" onClick={() => setSortAsc(!sortAsc)}>
          {sortAsc ? '▲' : '▼'} Ordem: AQI {sortAsc ? 'menor → maior' : 'maior → menor'}
        </button>
      </div>

      <div className="panel-body">
        {stateGroups.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            Nenhum alerta ativo para os filtros selecionados.
          </div>
        ) : (
          <div className="alert-list">
            {stateGroups.map((group) => {
              const isStateExpanded = expandedStateId === group.state;
              const stateColor = severityColor(group.worstSeverity as AlertSeverity);

              return (
                <div key={group.state} className={`alert-accordion ${isStateExpanded ? 'expanded' : ''}`} style={{ borderLeftColor: stateColor, borderLeftWidth: 4, marginBottom: 12 }}>
                  <div className="alert-accordion-header" onClick={() => toggleStateExpand(group.state)}>
                    <div className="alert-accordion-icon" style={{ background: `${stateColor}15`, border: `1px solid ${stateColor}30` }}>
                      <span style={{ fontWeight: 'bold', color: stateColor }}>{group.state}</span>
                    </div>
                    
                    <div className="alert-accordion-main">
                      <div className="alert-accordion-title">
                        Estado de {group.state}
                      </div>
                      <div className="alert-accordion-meta">
                        <span style={{ color: stateColor, fontWeight: 700 }}>Pico AQI {group.maxAqi}</span>
                        <span>·</span>
                        <span>{group.alerts.length} localidade{group.alerts.length > 1 ? 's' : ''} em alerta</span>
                      </div>
                    </div>
                    
                    <div className="alert-accordion-chevron">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {isStateExpanded && (
                    <div className="alert-accordion-body" style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: 'none' }}>
                      {group.alerts.map((alert) => {
                        const alertColor = severityColor(alert.severity as AlertSeverity);
                        const isAlertExpanded = expandedAlertId === alert.id;
                        const riskPercent = Math.min((alert.aqi / 100) * 100, 100);

                        return (
                          <div key={alert.id} className="state-alert-item" style={{ background: 'var(--bg-elevated)', borderRadius: 8, border: `1px solid var(--border)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }} onClick={(e) => toggleAlertExpand(e, alert.id)}>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{alert.locationName}</div>
                                <div style={{ fontSize: 12, color: alertColor, fontWeight: 500, marginTop: 4 }}>
                                  {severityLabel(alert.severity as AlertSeverity)} · AQI {alert.aqi}
                                </div>
                              </div>
                              <div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAlertExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                                  <polyline points="6 9 12 15 18 9"/>
                                </svg>
                              </div>
                            </div>
                            
                            {isAlertExpanded && (
                              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Risco Atual</div>
                                    <div className="alert-risk-bar" style={{ margin: 0, height: 6 }}>
                                      <div className="alert-risk-fill" style={{ width: `${riskPercent}%`, background: `linear-gradient(90deg, ${alertColor}80, ${alertColor})` }} />
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: alertColor }}>AQI {alert.aqi} <span style={{ color: 'var(--text-dim)', fontWeight: 500, fontSize: 12 }}>(pico de {alert.peakAqi})</span></div>
                                  </div>
                                </div>

                                {alert.triggeredBy && alert.triggeredBy.length > 0 && (
                                  <div style={{ background: `${alertColor}15`, borderRadius: '8px', padding: '12px', marginTop: 16 }}>
                                    <h4 style={{ margin: '0 0 8px', fontSize: 13, color: alertColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      Causas Identificadas
                                    </h4>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {alert.triggeredBy.map((c, i) => (
                                        <span key={i} style={{ fontSize: 11, background: `${alertColor}25`, color: alertColor, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                                  Registrado em: {formatDateTime(alert.triggeredAt)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 15px;
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          border: 1px dashed var(--border);
          margin: 20px;
        }
        .empty-icon {
          font-size: 32px;
          margin-bottom: 16px;
          opacity: 0.8;
        }
        .alert-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }
        .alert-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-weight: 500;
          font-size: 13px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .alert-tab:hover {
          background: var(--panel-2);
          color: var(--text);
        }
        .tab-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 4px;
        }
        .alert-toolbar {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        .sort-toggle {
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sort-toggle:hover {
          background: var(--border);
        }
        .alert-list {
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .alert-accordion {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        }
        .alert-accordion:hover {
          border-color: var(--border-hover, rgba(255,255,255,0.2));
        }
        .alert-accordion.expanded {
          background: var(--bg-elevated);
        }
        .alert-accordion-header {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          user-select: none;
        }
        .alert-accordion-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .alert-accordion-main {
          flex: 1;
          min-width: 0;
        }
        .alert-accordion-title {
          font-weight: 600;
          color: var(--text);
          font-size: 15px;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .alert-accordion-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }
        .alert-accordion-chevron {
          color: var(--text-muted);
          transition: transform 0.3s ease;
        }
        .alert-accordion.expanded .alert-accordion-chevron {
          transform: rotate(180deg);
        }
        .alert-risk-bar {
          background: var(--panel-2);
          border-radius: 4px;
          overflow: hidden;
          width: 100%;
        }
        .alert-risk-fill {
          height: 100%;
          border-radius: 4px;
        }
        .state-alert-item {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .state-alert-item:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
