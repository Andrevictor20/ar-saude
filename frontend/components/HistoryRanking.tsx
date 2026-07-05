'use client';

import { useCallback, useEffect, useState } from 'react';
import { RankingResult } from '@/lib/types';
import { getRanking } from '@/lib/api';
import { aqiColor } from '@/lib/format';

const INDEX_OPTIONS = [
  { key: 'aqi', label: 'AQI', unit: '' },
  { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
  { key: 'no2', label: 'NO₂', unit: 'µg/m³' },
  { key: 'ozone', label: 'O₃', unit: 'µg/m³' },
  { key: 'co', label: 'CO', unit: 'µg/m³' },
  { key: 'so2', label: 'SO₂', unit: 'µg/m³' },
  { key: 'nh3', label: 'NH₃', unit: 'µg/m³' },
  { key: 'no', label: 'NO', unit: 'µg/m³' },
];

const PERIOD_OPTIONS = [
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Último mês' },
  { key: '90d', label: 'Últimos 3 meses' },
  { key: '180d', label: 'Últimos 6 meses' },
  { key: '365d', label: 'Último ano' },
  { key: 'all', label: 'Todo o período' },
];

/* State code → name mapping (Brazilian UF codes from IBGE) */
const UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
};

function formatState(state: string): string {
  if (!state || state === '-') return '-';
  /* If already a 2-letter code */
  if (state.length === 2 && /^[A-Z]{2}$/.test(state)) return state;
  /* If it's an IBGE code number */
  return UF_MAP[state] || state;
}

function getMedalEmoji(position: number): string {
  switch (position) {
    case 0: return '🥇';
    case 1: return '🥈';
    case 2: return '🥉';
    default: return `${position + 1}º`;
  }
}

export default function HistoryRanking() {
  const [selectedIndex, setSelectedIndex] = useState('aqi');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRanking(selectedIndex, selectedPeriod);
      setRanking(result);
    } catch {
      setError('Não foi possível carregar o ranking. Verifique se o motor de alertas está conectado.');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex, selectedPeriod]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const currentIndex = INDEX_OPTIONS.find((o) => o.key === selectedIndex);
  const currentPeriod = PERIOD_OPTIONS.find((o) => o.key === selectedPeriod);
  const unit = currentIndex?.unit || '';

  return (
    <div className="panel">
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Ranking Histórico — Top 5
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Index Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Índice:</span>
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value)}
              style={{
                background: 'var(--panel-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {INDEX_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Período:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                background: 'var(--panel-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="panel-body">
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="skeleton" style={{ height: 20, width: 140, marginBottom: 12 }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-table-row" style={{ animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
            <div>
              <div className="skeleton" style={{ height: 20, width: 140, marginBottom: 12 }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-table-row" style={{ animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            {error}
          </div>
        )}

        {!loading && !error && ranking && (
          <>
            <div style={{ 
              fontSize: 12, 
              color: 'var(--text-dim)', 
              marginBottom: 16, 
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                background: 'var(--panel-2)',
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
              }}>
                {currentIndex?.label}
              </span>
              <span>·</span>
              <span>{currentPeriod?.label}</span>
              <span>·</span>
              <span>Média por localidade {unit && `(${unit})`}</span>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
              gap: 24 
            }}>
              {/* WORST */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <polyline points="7 23 3 19 7 15"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
                    Top 5 Piores
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                    (maior média)
                  </span>
                </div>
                {ranking.worst.length === 0 ? (
                  <div className="empty" style={{ padding: '16px 0' }}>Dados insuficientes para o período.</div>
                ) : (
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Município</th>
                        <th>UF</th>
                        <th style={{ textAlign: 'right' }}>
                          {currentIndex?.label} {unit && <span style={{ textTransform: 'lowercase', fontSize: 10 }}>({unit})</span>}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.worst.map((entry, i) => (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td style={{ fontSize: 16, textAlign: 'center' }}>
                            {getMedalEmoji(i)}
                          </td>
                          <td style={{ fontWeight: 600 }}>{entry.locationName}</td>
                          <td>
                            <span className="badge" style={{
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                            }}>
                              {formatState(entry.state)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{
                              color: selectedIndex === 'aqi' ? aqiColor(entry.value) : '#ef4444',
                              background: selectedIndex === 'aqi' ? `${aqiColor(entry.value)}15` : 'rgba(239, 68, 68, 0.08)',
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 13,
                            }}>
                              {entry.value}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* BEST */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                    Top 5 Melhores
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                    (menor média)
                  </span>
                </div>
                {ranking.best.length === 0 ? (
                  <div className="empty" style={{ padding: '16px 0' }}>Dados insuficientes para o período.</div>
                ) : (
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Município</th>
                        <th>UF</th>
                        <th style={{ textAlign: 'right' }}>
                          {currentIndex?.label} {unit && <span style={{ textTransform: 'lowercase', fontSize: 10 }}>({unit})</span>}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.best.map((entry, i) => (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td style={{ fontSize: 16, textAlign: 'center' }}>
                            {getMedalEmoji(i)}
                          </td>
                          <td style={{ fontWeight: 600 }}>{entry.locationName}</td>
                          <td>
                            <span className="badge" style={{
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                            }}>
                              {formatState(entry.state)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{
                              color: selectedIndex === 'aqi' ? aqiColor(entry.value) : '#22c55e',
                              background: selectedIndex === 'aqi' ? `${aqiColor(entry.value)}15` : 'rgba(34, 197, 94, 0.08)',
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 13,
                            }}>
                              {entry.value}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
