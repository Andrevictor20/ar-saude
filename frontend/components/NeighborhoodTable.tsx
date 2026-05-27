'use client';

import { useMemo, useState } from 'react';
import { Measurement } from '@/lib/types';
import {
  aqiColor,
  formatNumber,
  formatTime,
  levelColor,
} from '@/lib/format';

interface Props {
  measurements: Measurement[];
  selectedId: string | null;
  onSelect: (m: Measurement) => void;
}

export default function NeighborhoodTable({
  measurements,
  selectedId,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? measurements.filter((m) =>
          m.neighborhoodName.toLowerCase().includes(q),
        )
      : measurements;
    return [...list].sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1));
  }, [measurements, query]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Qualidade do ar por bairro</h2>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Buscar bairro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        {measurements.length === 0 ? (
          <div className="empty">
            Aguardando primeira coleta do motor de monitoramento.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Bairro</th>
                  <th>AQI</th>
                  <th>Nivel</th>
                  <th>PM2.5</th>
                  <th>PM10</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.neighborhoodId}
                    className={m.neighborhoodId === selectedId ? 'selected' : ''}
                    onClick={() => onSelect(m)}
                  >
                    <td>{m.neighborhoodName}</td>
                    <td>
                      <span
                        className="aqi-pill"
                        style={{ background: aqiColor(m.aqi) }}
                      >
                        {m.aqi ?? '-'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: 'transparent',
                          color: levelColor(m.level),
                          border: `1px solid ${levelColor(m.level)}`,
                        }}
                      >
                        {m.level}
                      </span>
                    </td>
                    <td>{formatNumber(m.pm2_5)}</td>
                    <td>{formatNumber(m.pm10)}</td>
                    <td className="muted">{formatTime(m.measuredAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Nenhum bairro encontrado para a busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
