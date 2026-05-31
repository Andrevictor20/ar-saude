'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Measurement } from '@/lib/types';
import { aqiColor, formatNumber, formatDateTime } from '@/lib/format';

/* ─── Types ─── */
interface HistoryPointData {
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  ozone: number | null;
  co: number | null;
  so2: number | null;
  nh3: number | null;
  no: number | null;
  measuredAt: string;
}

interface Props {
  neighborhoodName: string | null;
  history: Measurement[];
  onHistoryPointSelect?: (point: HistoryPointData | null) => void;
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

export default function HistoryChart({
  neighborhoodName,
  history,
  onHistoryPointSelect,
}: Props) {
  const points = [...history]
    .reverse()
    .filter((m) => typeof m.aqi === 'number') as Array<
    Measurement & { aqi: number }
  >;

  const latest = history[0];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /* Reset selection when neighborhood changes */
  useEffect(() => {
    setSelectedIndex(null);
    onHistoryPointSelect?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhoodName]);

  const handlePointClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const p = points[index];
      if (p) {
        onHistoryPointSelect?.({
          aqi: p.aqi,
          pm2_5: p.pm2_5,
          pm10: p.pm10,
          no2: p.no2,
          ozone: p.ozone,
          co: p.co,
          so2: p.so2,
          nh3: p.nh3,
          no: p.no,
          measuredAt: p.measuredAt,
        });
      }
    },
    // points changes on every render; but the callback only matters when invoked
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points.length, onHistoryPointSelect],
  );

  const handleReset = useCallback(() => {
    setSelectedIndex(null);
    onHistoryPointSelect?.(null);
  }, [onHistoryPointSelect]);

  const activeData: HistoryPointData | null =
    selectedIndex !== null && points[selectedIndex]
      ? {
          aqi: points[selectedIndex].aqi,
          pm2_5: points[selectedIndex].pm2_5,
          pm10: points[selectedIndex].pm10,
          no2: points[selectedIndex].no2,
          ozone: points[selectedIndex].ozone,
          co: points[selectedIndex].co,
          so2: points[selectedIndex].so2,
          nh3: points[selectedIndex].nh3,
          no: points[selectedIndex].no,
          measuredAt: points[selectedIndex].measuredAt,
        }
      : latest
        ? {
            aqi: latest.aqi,
            pm2_5: latest.pm2_5,
            pm10: latest.pm10,
            no2: latest.no2,
            ozone: latest.ozone,
            co: latest.co,
            so2: latest.so2,
            nh3: latest.nh3,
            no: latest.no,
            measuredAt: latest.measuredAt,
          }
        : null;

  const isHistoryMode = selectedIndex !== null;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Historico de AQI</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isHistoryMode && (
            <button
              onClick={handleReset}
              style={{
                background: 'var(--accent, #38bdf8)',
                color: 'var(--bg, #0b1120)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '.02em',
                transition: 'opacity .15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              ↻ Voltar ao tempo real
            </button>
          )}
          <span className="muted">
            {neighborhoodName ?? 'Selecione um bairro'}
          </span>
        </div>
      </div>
      <div className="panel-body">
        {!neighborhoodName ? (
          <div className="empty">
            Clique em um bairro na tabela para ver o historico de medicoes.
          </div>
        ) : points.length < 2 ? (
          <div className="empty">
            Historico insuficiente. Aguarde novas coletas para este bairro.
          </div>
        ) : (
          <>
            {/* Timestamp indicator */}
            {isHistoryMode && activeData && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  fontSize: 12,
                  animation: 'histFadeIn .3s ease',
                }}
              >
                <span
                  style={{
                    background: 'var(--accent, #38bdf8)',
                    color: 'var(--bg, #0b1120)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  📍 Visualizando histórico –{' '}
                  {formatDateTime(activeData.measuredAt)}
                </span>
              </div>
            )}

            <Chart
              points={points}
              selectedIndex={selectedIndex}
              onPointClick={handlePointClick}
              onSelectedIndexChange={(i) => {
                setSelectedIndex(i);
                const p = points[i];
                if (p) {
                  onHistoryPointSelect?.({
                    aqi: p.aqi,
                    pm2_5: p.pm2_5,
                    pm10: p.pm10,
                    no2: p.no2,
                    ozone: p.ozone,
                    co: p.co,
                    so2: p.so2,
                    nh3: p.nh3,
                    no: p.no,
                    measuredAt: p.measuredAt,
                  });
                }
              }}
            />
          </>
        )}

        {neighborhoodName && activeData && (
          <div
            className="pollute-grid"
            style={{
              position: 'relative',
            }}
          >
            {isHistoryMode && (
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  right: 0,
                  fontSize: 10,
                  color: 'var(--accent, #38bdf8)',
                  fontWeight: 600,
                  animation: 'histFadeIn .3s ease',
                }}
              >
                📍 {formatDateTime(activeData.measuredAt)}
              </div>
            )}
            <AnimatedCell
              k="AQI"
              v={activeData.aqi ?? '-'}
              color={aqiColor(activeData.aqi)}
              key={`aqi-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="PM2.5"
              v={formatNumber(activeData.pm2_5)}
              key={`pm25-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="PM10"
              v={formatNumber(activeData.pm10)}
              key={`pm10-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="NO2"
              v={formatNumber(activeData.no2)}
              key={`no2-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="O3"
              v={formatNumber(activeData.ozone)}
              key={`o3-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="CO"
              v={formatNumber(activeData.co)}
              key={`co-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="SO2"
              v={formatNumber(activeData.so2)}
              key={`so2-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="NH3"
              v={formatNumber(activeData.nh3)}
              key={`nh3-${isHistoryMode ? selectedIndex : 'live'}`}
            />
            <AnimatedCell
              k="NO"
              v={formatNumber(activeData.no)}
              key={`no-${isHistoryMode ? selectedIndex : 'live'}`}
            />
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes histFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Animated Cell ─── */
function AnimatedCell({
  k,
  v,
  color,
}: {
  k: string;
  v: string | number;
  color?: string;
}) {
  return (
    <div className="pollute-cell" style={{ animation: 'histFadeIn .3s ease' }}>
      <div className="k">{k}</div>
      <div className="v" style={color ? { color } : undefined}>
        {v}
      </div>
    </div>
  );
}

/* ─── Chart ─── */
function Chart({
  points,
  selectedIndex,
  onPointClick,
  onSelectedIndexChange,
}: {
  points: Array<Measurement & { aqi: number }>;
  selectedIndex: number | null;
  onPointClick: (index: number) => void;
  onSelectedIndexChange: (index: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const values = points.map((p) => p.aqi);
  const maxRaw = Math.max(...values, 40);
  const max = Math.ceil(maxRaw / 20) * 20;
  const min = 0;

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (i: number) =>
    PADDING.left +
    (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) =>
    PADDING.top + innerH - ((v - min) / (max - min)) * innerH;

  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.aqi).toFixed(1)}`,
    )
    .join(' ');

  const area =
    `M ${x(0).toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} ` +
    points
      .map((p, i) => `L ${x(i).toFixed(1)} ${y(p.aqi).toFixed(1)}`)
      .join(' ') +
    ` L ${x(points.length - 1).toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = Math.round(max - t * (max - min));
    const yy = PADDING.top + t * innerH;
    return { value, yy };
  });

  const lastColor = aqiColor(points[points.length - 1].aqi);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const current = selectedIndex ?? 0;
        let next: number;
        if (e.key === 'ArrowRight') {
          next = Math.min(current + 1, points.length - 1);
        } else {
          next = Math.max(current - 1, 0);
        }
        onSelectedIndexChange(next);
      }
    },
    [selectedIndex, points.length, onSelectedIndexChange],
  );

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none', cursor: 'crosshair' }}
        role="img"
        aria-label="Gráfico de histórico de AQI"
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={g.yy}
              y2={g.yy}
              stroke="#233047"
              strokeWidth={1}
            />
            <text x={8} y={g.yy + 4} fill="#64748b" fontSize={10}>
              {g.value}
            </text>
          </g>
        ))}

        <path d={area} fill={lastColor} opacity={0.12} />
        <path d={line} fill="none" stroke={lastColor} strokeWidth={2} />

        {/* Crosshair line */}
        {selectedIndex !== null && (
          <line
            x1={x(selectedIndex)}
            x2={x(selectedIndex)}
            y1={PADDING.top}
            y2={PADDING.top + innerH}
            stroke="var(--accent, #38bdf8)"
            strokeWidth={1.5}
            strokeDasharray="4,3"
            opacity={0.8}
          >
            <animate
              attributeName="opacity"
              values="0;0.8"
              dur="0.3s"
              fill="freeze"
            />
          </line>
        )}

        {/* Data points */}
        {points.map((p, i) => {
          const isSelected = i === selectedIndex;
          return (
            <g key={p.id}>
              <circle
                cx={x(i)}
                cy={y(p.aqi)}
                r={isSelected ? 5 : 2.5}
                fill={aqiColor(p.aqi)}
                stroke={isSelected ? '#fff' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
                style={{
                  cursor: 'pointer',
                  transition: 'r .15s ease, stroke-width .15s ease',
                }}
              />
              {/* Invisible larger hit area */}
              <circle
                cx={x(i)}
                cy={y(p.aqi)}
                r={8}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => onPointClick(i)}
              />
            </g>
          );
        })}

        {/* Selected point highlight ring */}
        {selectedIndex !== null && points[selectedIndex] && (
          <circle
            cx={x(selectedIndex)}
            cy={y(points[selectedIndex].aqi)}
            r={8}
            fill="none"
            stroke={aqiColor(points[selectedIndex].aqi)}
            strokeWidth={1.5}
            opacity={0.5}
          >
            <animate
              attributeName="r"
              values="5;10;8"
              dur="0.4s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0;0.5"
              dur="0.3s"
              fill="freeze"
            />
          </circle>
        )}

        <text
          x={PADDING.left}
          y={HEIGHT - 8}
          fill="#64748b"
          fontSize={10}
        >
          {formatDateTime(points[0].measuredAt)}
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 8}
          fill="#64748b"
          fontSize={10}
          textAnchor="end"
        >
          {formatDateTime(points[points.length - 1].measuredAt)}
        </text>
      </svg>
    </div>
  );
}
