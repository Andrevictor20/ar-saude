'use client';

import { useMemo, useState } from 'react';
import { Measurement } from '@/lib/types';
import { aqiColor, formatNumber, formatTime, levelColor } from '@/lib/format';
import ExportModal from './ExportModal';

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? measurements.filter((m) => m.neighborhoodName.toLowerCase().includes(q))
      : measurements;
    return [...list].sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1));
  }, [measurements, query]);

  const btnStyle = {
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Qualidade do ar por bairro</h2>
        <div className="toolbar">
          <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
            <button
              onClick={() => setIsExportModalOpen(true)}
              style={btnStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Opções de Exportação"
            >
              📥 Exportar Dados
            </button>
          </div>
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
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Índice de Qualidade do Ar. Medida geral e simplificada da poluição atmosférica atual."
                    >
                      AQI
                    </span>
                  </th>
                  <th>Nivel</th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Material Particulado < 2.5µm. Partículas finas que penetram profundamente nos pulmões e corrente sanguínea."
                    >
                      PM2.5{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Material Particulado < 10µm. Poeira e partículas inaláveis que causam irritação e problemas respiratórios."
                    >
                      PM10{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Dióxido de Nitrogênio. Gás emitido por veículos e queima de combustíveis fósseis; causa inflamação pulmonar."
                    >
                      NO₂{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Ozônio. Poluente secundário formado sob luz solar; agrava asma e afeta os pulmões."
                    >
                      O₃{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Monóxido de Carbono. Gás incolor e tóxico que reduz a capacidade de transporte de oxigênio no sangue."
                    >
                      CO{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Dióxido de Enxofre. Gás irritante resultante da combustão; causa broncoconstrição e tosse aguda."
                    >
                      SO₂{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Amônia. Gás de forte odor, atua na atmosfera como precursor de partículas finas."
                    >
                      NH₃{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>
                    <span
                      className="has-tooltip"
                      data-tooltip="Óxido Nítrico. Gás reativo de escapamentos que rapidamente contribui para formar poluição fotoquímica (ozônio)."
                    >
                      NO{' '}
                      <span style={{ textTransform: 'lowercase' }}>
                        (µg/m³)
                      </span>
                    </span>
                  </th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.neighborhoodId}
                    className={
                      m.neighborhoodId === selectedId ? 'selected' : ''
                    }
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
                    <td>{formatNumber(m.no2)}</td>
                    <td>{formatNumber(m.ozone)}</td>
                    <td>{formatNumber(m.co)}</td>
                    <td>{formatNumber(m.so2)}</td>
                    <td>{formatNumber(m.nh3)}</td>
                    <td>{formatNumber(m.no)}</td>
                    <td className="muted">{formatTime(m.measuredAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="empty">
                      Nenhum bairro encontrado para a busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          currentMeasurements={measurements}
        />
      )}
    </div>
  );
}
