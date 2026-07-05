'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertSeverity } from '@/lib/types';
import { formatDateTime, severityColor, severityLabel } from '@/lib/format';
import { getStateAbbr } from '@/lib/states';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* Count per severity */
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: alerts.length };
    alerts.forEach((a) => {
      counts[a.severity] = (counts[a.severity] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  /* Group alerts by state, then by similarity */
  const alertsByState = useMemo(() => {
    let filtered = alerts;
    
    if (activeTab !== 'todos') {
      filtered = filtered.filter((a) => a.severity === activeTab);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((a) => a.locationName.toLowerCase().includes(q));
    }

    const stateMap = new Map<string, Map<string, Alert & { locations: string[]; id: string }>>();
    
    filtered.forEach((alert) => {
      const abbr = getStateAbbr(alert.state);
      if (!stateMap.has(abbr)) stateMap.set(abbr, new Map());

      const groupMap = stateMap.get(abbr)!;
      const triggersSig = alert.triggeredBy ? [...alert.triggeredBy].sort().join('|') : '';
      const key = `${alert.severity}|${alert.aqi}|${alert.peakAqi}|${triggersSig}`;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        if (!existing.locations.includes(alert.locationName)) {
          existing.locations.push(alert.locationName);
        }
      } else {
        groupMap.set(key, { ...alert, locations: [alert.locationName], id: `${abbr}-${key}` });
      }
    });

    const result = Array.from(stateMap.entries()).map(([stateName, groupMap]) => {
      const groups = Array.from(groupMap.values());
      groups.sort((a, b) => {
        const priorityA = SEVERITY_ORDER.indexOf(a.severity);
        const priorityB = SEVERITY_ORDER.indexOf(b.severity);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return sortAsc ? a.aqi - b.aqi : b.aqi - a.aqi;
      });
      const count = groups.reduce((sum, g) => sum + g.locations.length, 0);
      return { stateName, groups, count };
    });

    result.sort((a, b) => b.count - a.count || a.stateName.localeCompare(b.stateName));
    return result;
  }, [alerts, activeTab, searchQuery, sortAsc]);

  const totalFiltered = useMemo(() => {
    return alertsByState.reduce((sum, state) => sum + state.count, 0);
  }, [alertsByState]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Monitor de Alertas</h2>
        <span
          className="badge"
          style={{ background: 'var(--panel-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          {alerts.length} eventos ativos
          {totalFiltered !== alerts.length && ` · ${totalFiltered} no filtro atual`}
        </span>
      </div>

      {/* Severity Sub-Tabs (Pills format) */}
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
                setExpandedId(null);
              }}
              style={
                activeTab === tab.key
                  ? { background: `${color}15`, color: color, borderColor: `${color}40` }
                  : {}
              }
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
                  background: activeTab === tab.key ? `${color}20` : 'var(--panel-2)',
                  color: activeTab === tab.key ? color : 'var(--text-dim)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Sort Toolbar */}
      <div className="alert-toolbar" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por localidade afetada..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ minWidth: 260, flex: 1 }}
        />
        <button
          className="sort-toggle"
          onClick={() => setSortAsc(!sortAsc)}
          title={sortAsc ? 'AQI: menor → maior' : 'AQI: maior → menor'}
        >
          {sortAsc ? '▲' : '▼'} Ordem: AQI {sortAsc ? 'menor → maior' : 'maior → menor'}
        </button>
      </div>

      <div className="panel-body">
        {alertsByState.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            {activeTab === 'todos' && !searchQuery
              ? 'Nenhum alerta ativo no momento. Tudo tranquilo!'
              : 'Nenhum alerta encontrado para o filtro selecionado.'}
          </div>
        ) : (
          <div className="alert-list">
            {alertsByState.map((stateBlock) => (
              <div key={stateBlock.stateName} className="state-alert-group">
                <div className="state-alert-header">
                  <h3>{stateBlock.stateName}</h3>
                  <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--text-muted)' }}>
                    {stateBlock.count} {stateBlock.count === 1 ? 'localidade' : 'localidades'}
                  </span>
                </div>
                
                <div className="state-alert-items">
                  {stateBlock.groups.map((group) => {
                    const color = severityColor(group.severity);
                    const isExpanded = expandedId === group.id;
                    const isPulse = group.severity === 'emergencia' || group.severity === 'critico';
                    
                    const locationsToShow = isExpanded ? group.locations : group.locations.slice(0, 5);
                    const hasMoreLocations = group.locations.length > 5;
                    const riskPercent = Math.min((group.aqi / 100) * 100, 100);

                    return (
                      <div 
                        key={group.id} 
                        className={`alert-accordion ${isExpanded ? 'expanded' : ''} ${!isExpanded && isPulse ? 'pulse-emergency' : ''}`}
                        style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                      >
                        {/* HEADER (Collapsed View) */}
                        <div className="alert-accordion-header" onClick={() => toggleExpand(group.id)}>
                          <div className="alert-accordion-icon" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          </div>
                          
                          <div className="alert-accordion-main">
                            <div className="alert-accordion-title">
                              {severityLabel(group.severity)} — {group.message.replace(` em ${group.locationName}`, '')}
                            </div>
                            <div className="alert-accordion-meta">
                              <span style={{ color: color, fontWeight: 700 }}>AQI {group.aqi}</span>
                              <span>·</span>
                              <span>{group.locations.length} {group.locations.length === 1 ? 'localidade' : 'localidades'}</span>
                              <span>·</span>
                              <span>Iniciado em {formatDateTime(group.triggeredAt)}</span>
                            </div>
                          </div>
                          
                          <div className="alert-accordion-chevron">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>
                        </div>

                        {/* BODY (Expanded View) */}
                        <div className="alert-accordion-body">
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            {/* Left Column: Metrics & Tips */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              
                              {/* Metrics */}
                              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Risco Atual</div>
                                  <div className="alert-risk-bar" style={{ margin: 0, height: 6 }}>
                                    <div
                                      className="alert-risk-fill"
                                      style={{
                                        width: `${riskPercent}%`,
                                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                                      }}
                                    />
                                  </div>
                                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color }}>AQI {group.aqi} <span style={{ color: 'var(--text-dim)', fontWeight: 500, fontSize: 12 }}>(pico de {group.peakAqi})</span></div>
                                </div>
                              </div>

                              {/* Tips */}
                              {group.triggeredBy && group.triggeredBy.length > 0 && (
                                <div style={{
                                  background: 'var(--bg)',
                                  padding: '16px',
                                  borderRadius: '10px',
                                  border: '1px solid var(--border)',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ background: 'var(--panel-2)', padding: 6, borderRadius: 6 }}>💡</span>
                                    <strong style={{ color: 'var(--text)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                      Ações Recomendadas
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    {group.triggeredBy.map((trigger, i) => {
                                      let tip = '';
                                      if (trigger.startsWith('PM2.5') || trigger.startsWith('PM10')) tip = '😷 Uso de máscara (N95/PFF2) altamente recomendado. Evite qualquer exercício ao ar livre.';
                                      else if (trigger.startsWith('O3')) tip = '☀️ Evite exposição ao sol e atividades intensas durante o período da tarde.';
                                      else if (trigger.startsWith('NO2') || trigger.startsWith('SO2')) tip = '🫁 Mantenha janelas fechadas. Pessoas com asma devem redobrar a atenção aos sintomas.';
                                      else if (trigger.startsWith('CO')) tip = '🚗 Risco de intoxicação contínua. Evite proximidade com vias de tráfego pesado.';
                                      
                                      return tip ? (
                                        <div key={i} style={{ display: 'flex', gap: 8 }}>
                                          <span style={{ color: color }}>•</span> {tip}
                                        </div>
                                      ) : null;
                                    }).filter(Boolean)}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right Column: Affected Locations */}
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
                                Localidades Afetadas ({group.locations.length})
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {locationsToShow.map((n, i) => (
                                  <span
                                    key={i}
                                    className="badge"
                                    style={{
                                      background: 'var(--bg)',
                                      color: 'var(--text)',
                                      border: '1px solid var(--border)',
                                      fontSize: 12,
                                      padding: '6px 12px'
                                    }}
                                  >
                                    {n}
                                  </span>
                                ))}
                                {!isExpanded && hasMoreLocations && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(group.id); }}
                                    style={{
                                      background: 'var(--panel-2)',
                                      border: '1px dashed var(--text-dim)',
                                      color: 'var(--text-muted)',
                                      borderRadius: '16px',
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'color 0.2s, border-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = 'var(--text)';
                                      e.currentTarget.style.borderColor = 'var(--text)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = 'var(--text-muted)';
                                      e.currentTarget.style.borderColor = 'var(--text-dim)';
                                    }}
                                  >
                                    + {group.locations.length - 5} localidades
                                  </button>
                                )}
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
