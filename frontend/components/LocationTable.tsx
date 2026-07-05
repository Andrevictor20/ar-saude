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

type SortKey =
  | 'locationName'
  | 'aqi'
  | 'pm2_5'
  | 'pm10'
  | 'no2'
  | 'ozone'
  | 'co'
  | 'so2'
  | 'nh3'
  | 'no';

type SortDir = 'asc' | 'desc';

const LEVELS = [
  'Todos',
  'Bom',
  'Moderado',
  'Ruim para grupos sensíveis',
  'Ruim',
  'Muito Ruim',
  'Perigoso',
] as const;

const COLUMNS: { key: SortKey; label: string; tooltip?: string; unit?: string }[] = [
  { key: 'pm2_5', label: 'PM2.5', unit: '(µg/m³)', tooltip: 'Material Particulado < 2.5µm. Partículas finas que penetram profundamente nos pulmões e corrente sanguínea.' },
  { key: 'pm10', label: 'PM10', unit: '(µg/m³)', tooltip: 'Material Particulado < 10µm. Poeira e partículas inaláveis que causam irritação e problemas respiratórios.' },
  { key: 'no2', label: 'NO₂', unit: '(µg/m³)', tooltip: 'Dióxido de Nitrogênio. Gás emitido por veículos e queima de combustíveis fósseis; causa inflamação pulmonar.' },
  { key: 'ozone', label: 'O₃', unit: '(µg/m³)', tooltip: 'Ozônio. Poluente secundário formado sob luz solar; agrava asma e afeta os pulmões.' },
  { key: 'co', label: 'CO', unit: '(µg/m³)', tooltip: 'Monóxido de Carbono. Gás incolor e tóxico que reduz a capacidade de transporte de oxigênio no sangue.' },
  { key: 'so2', label: 'SO₂', unit: '(µg/m³)', tooltip: 'Dióxido de Enxofre. Gás irritante resultante da combustão; causa broncoconstrição e tosse aguda.' },
  { key: 'nh3', label: 'NH₃', unit: '(µg/m³)', tooltip: 'Amônia. Gás de forte odor, atua na atmosfera como precursor de partículas finas.' },
  { key: 'no', label: 'NO', unit: '(µg/m³)', tooltip: 'Óxido Nítrico. Gás reativo de escapamentos que rapidamente contribui para formar poluição fotoquímica (ozônio).' },
];

export default function LocationTable({
  measurements,
  selectedId,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('Todos');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* Count per level */
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: measurements.length };
    measurements.forEach((m) => {
      counts[m.level] = (counts[m.level] || 0) + 1;
    });
    return counts;
  }, [measurements]);

  /* Handle column header click */
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'desc') {
        setSortDir('asc');
      } else {
        /* Reset */
        setSortKey(null);
        setSortDir('desc');
      }
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = measurements;

    /* Text filter */
    if (q) {
      list = list.filter((m) => m.locationName.toLowerCase().includes(q));
    }

    /* Level filter */
    if (levelFilter !== 'Todos') {
      list = list.filter((m) => m.level === levelFilter);
    }

    /* Sort */
    const sorted = [...list];
    if (sortKey) {
      sorted.sort((a, b) => {
        let aVal: number | string | null;
        let bVal: number | string | null;

        if (sortKey === 'locationName') {
          aVal = a.locationName;
          bVal = b.locationName;
          const cmp = (aVal as string).localeCompare(bVal as string);
          return sortDir === 'asc' ? cmp : -cmp;
        }

        aVal = a[sortKey] as number | null;
        bVal = b[sortKey] as number | null;
        const na = aVal ?? -Infinity;
        const nb = bVal ?? -Infinity;
        return sortDir === 'asc' ? na - nb : nb - na;
      });
    } else {
      /* Default: sort by AQI desc */
      sorted.sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1));
    }

    return sorted;
  }, [measurements, query, levelFilter, sortKey, sortDir]);

  const btnStyle = {
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Inter', sans-serif",
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span className="sort-indicator">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Qualidade do ar por localidade</h2>
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
            placeholder="🔍 Buscar localidade..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 180 }}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-chips">
        {LEVELS.map((level) => (
          <button
            key={level}
            className={`filter-chip${levelFilter === level ? ' active' : ''}`}
            onClick={() => setLevelFilter(level)}
          >
            {level !== 'Todos' && (
              <span
                className="chip-dot"
                style={{ background: levelColor(level) }}
              />
            )}
            {level === 'Ruim para grupos sensíveis' ? 'Sensíveis' : level}
            <span className="chip-count">{levelCounts[level] || 0}</span>
          </button>
        ))}
      </div>

      <div className="panel-body" style={{ padding: 0 }}>
        {measurements.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📡</div>
            Aguardando primeira coleta do motor de monitoramento.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th
                    className={`sortable${sortKey === 'locationName' ? ' sort-active' : ''}`}
                    onClick={() => handleSort('locationName')}
                  >
                    Localidade {renderSortIndicator('locationName')}
                  </th>
                  <th
                    className={`sortable${sortKey === 'aqi' ? ' sort-active' : ''}`}
                    onClick={() => handleSort('aqi')}
                  >
                    <span
                      className="has-tooltip"
                      data-tooltip="Índice de Qualidade do Ar. Medida geral e simplificada da poluição atmosférica atual."
                    >
                      AQI
                    </span>
                    {renderSortIndicator('aqi')}
                  </th>
                  <th>Nivel</th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`sortable${sortKey === col.key ? ' sort-active' : ''}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span
                        className="has-tooltip"
                        data-tooltip={col.tooltip}
                      >
                        {col.label}{' '}
                        <span style={{ textTransform: 'lowercase' }}>
                          {col.unit}
                        </span>
                      </span>
                      {renderSortIndicator(col.key)}
                    </th>
                  ))}
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.locationId}
                    className={
                      m.locationId === selectedId ? 'selected' : ''
                    }
                    onClick={() => onSelect(m)}
                  >
                    <td style={{ fontWeight: 500 }}>{m.locationName}</td>
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
                      Nenhuma localidade encontrada para a busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Result count footer */}
      {measurements.length > 0 && (
        <div className="table-info">
          <span>
            Exibindo <strong>{filtered.length}</strong> de{' '}
            <strong>{measurements.length}</strong> localidades
          </span>
          {sortKey && (
            <span style={{ color: 'var(--accent)', fontSize: 11 }}>
              Ordenado por {COLUMNS.find((c) => c.key === sortKey)?.label ?? sortKey}{' '}
              {sortDir === 'asc' ? '(menor → maior)' : '(maior → menor)'}
            </span>
          )}
        </div>
      )}

      {isExportModalOpen && (
        <ExportModal
          onClose={() => setIsExportModalOpen(false)}
          currentMeasurements={measurements}
        />
      )}
    </div>
  );
}
