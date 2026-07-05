'use client';

import React, { useState } from 'react';

export default function PollutantsLegend() {
  const [isOpen, setIsOpen] = useState(false);

  const items = [
    {
      symbol: 'AQI',
      desc: 'Índice de Qualidade do Ar',
      limit: '0-50 (Bom), >100 (Ruim)',
      color: '#38bdf8',
    },
    {
      symbol: 'PM2.5',
      desc: 'Partículas Finas (< 2.5µm)',
      limit: 'Até 15 µg/m³ (24h)',
      color: '#f97316',
    },
    {
      symbol: 'PM10',
      desc: 'Poeira/Particulado (< 10µm)',
      limit: 'Até 45 µg/m³ (24h)',
      color: '#eab308',
    },
    {
      symbol: 'NO₂',
      desc: 'Dióxido de Nitrogênio',
      limit: 'Até 25 µg/m³ (24h)',
      color: '#ef4444',
    },
    {
      symbol: 'O₃',
      desc: 'Ozônio',
      limit: 'Até 100 µg/m³ (8h)',
      color: '#a855f7',
    },
    {
      symbol: 'CO',
      desc: 'Monóxido de Carbono',
      limit: 'Até 4000 µg/m³ (24h)',
      color: '#64748b',
    },
    {
      symbol: 'SO₂',
      desc: 'Dióxido de Enxofre',
      limit: 'Até 40 µg/m³ (24h)',
      color: '#22c55e',
    },
    {
      symbol: 'NH₃',
      desc: 'Amônia',
      limit: 'Padrão OMS não definido',
      color: '#818cf8',
    },
    {
      symbol: 'NO',
      desc: 'Óxido Nítrico',
      limit: 'Padrão OMS não definido',
      color: '#84cc16',
    },
  ];

  return (
    <div>
      <button
        className="legend-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        Legenda de Poluentes e Limites Seguros (OMS 2021)
        <span className={`toggle-arrow${isOpen ? ' open' : ''}`}>▼</span>
      </button>

      <div className={`legend-content${isOpen ? ' open' : ''}`}>
        <div
          className="panel"
          style={{
            marginTop: 8,
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          {items.map((item) => (
            <div
              key={item.symbol}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'var(--bg)',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                minWidth: '130px',
                textAlign: 'center',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = item.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `${item.color}18`,
                  border: `2px solid ${item.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: item.color }}>
                  {item.symbol.replace('₂', '₂').replace('₃', '₃').substring(0, 3)}
                </span>
              </div>
              <strong style={{ fontSize: 13, color: item.color }}>
                {item.symbol}
              </strong>
              <span style={{ fontSize: 11, color: 'var(--text)', margin: '4px 0', fontWeight: 500 }}>
                {item.desc}
              </span>
              <span
                style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}
              >
                {item.limit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
