import React from 'react';

export default function PollutantsLegend() {
  const items = [
    {
      symbol: 'AQI',
      desc: 'Índice de Qualidade do Ar',
      limit: '0-50 (Bom), >100 (Ruim)',
    },
    {
      symbol: 'PM2.5',
      desc: 'Partículas Finas (< 2.5µm)',
      limit: 'Até 15 µg/m³ (24h)',
    },
    {
      symbol: 'PM10',
      desc: 'Poeira/Particulado (< 10µm)',
      limit: 'Até 45 µg/m³ (24h)',
    },
    {
      symbol: 'NO₂',
      desc: 'Dióxido de Nitrogênio',
      limit: 'Até 25 µg/m³ (24h)',
    },
    {
      symbol: 'O₃',
      desc: 'Ozônio',
      limit: 'Até 100 µg/m³ (8h)',
    },
    {
      symbol: 'CO',
      desc: 'Monóxido de Carbono',
      limit: 'Até 4000 µg/m³ (24h)',
    },
    {
      symbol: 'SO₂',
      desc: 'Dióxido de Enxofre',
      limit: 'Até 40 µg/m³ (24h)',
    },
    {
      symbol: 'NH₃',
      desc: 'Amônia',
      limit: 'Padrão OMS não definido',
    },
    {
      symbol: 'NO',
      desc: 'Óxido Nítrico',
      limit: 'Padrão OMS não definido',
    },
  ];

  return (
    <div
      className="panel"
      style={{
        marginTop: 16,
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'center',
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ width: '100%', textAlign: 'center', marginBottom: 4 }}>
        <h3
          style={{
            fontSize: 13,
            margin: 0,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Legenda de Poluentes e Limites Seguros (OMS 2021)
        </h3>
      </div>
      {items.map((item) => (
        <div
          key={item.symbol}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'var(--bg)',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            minWidth: '140px',
            textAlign: 'center',
          }}
        >
          <strong style={{ fontSize: 14, color: 'var(--accent)' }}>
            {item.symbol}
          </strong>
          <span style={{ fontSize: 11, color: 'var(--text)', margin: '4px 0' }}>
            {item.desc}
          </span>
          <span
            style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}
          >
            {item.limit}
          </span>
        </div>
      ))}
    </div>
  );
}
