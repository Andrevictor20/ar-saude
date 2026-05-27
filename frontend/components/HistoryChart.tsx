import { Measurement } from '@/lib/types';
import { aqiColor, formatNumber, formatTime } from '@/lib/format';

interface Props {
  neighborhoodName: string | null;
  history: Measurement[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

export default function HistoryChart({ neighborhoodName, history }: Props) {
  const points = [...history]
    .reverse()
    .filter((m) => typeof m.aqi === 'number') as Array<
    Measurement & { aqi: number }
  >;

  const latest = history[0];

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Historico de AQI</h2>
        <span className="muted">{neighborhoodName ?? 'Selecione um bairro'}</span>
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
          <Chart points={points} />
        )}

        {neighborhoodName && latest && (
          <div className="pollute-grid">
            <Cell k="AQI" v={latest.aqi ?? '-'} color={aqiColor(latest.aqi)} />
            <Cell k="PM2.5" v={formatNumber(latest.pm2_5)} />
            <Cell k="PM10" v={formatNumber(latest.pm10)} />
            <Cell k="NO2" v={formatNumber(latest.no2)} />
            <Cell k="O3" v={formatNumber(latest.ozone)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({
  k,
  v,
  color,
}: {
  k: string;
  v: string | number;
  color?: string;
}) {
  return (
    <div className="pollute-cell">
      <div className="k">{k}</div>
      <div className="v" style={color ? { color } : undefined}>
        {v}
      </div>
    </div>
  );
}

function Chart({ points }: { points: Array<Measurement & { aqi: number }> }) {
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
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.aqi).toFixed(1)}`)
    .join(' ');

  const area =
    `M ${x(0).toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} ` +
    points.map((p, i) => `L ${x(i).toFixed(1)} ${y(p.aqi).toFixed(1)}`).join(' ') +
    ` L ${x(points.length - 1).toFixed(1)} ${(PADDING.top + innerH).toFixed(1)} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = Math.round(max - t * (max - min));
    const yy = PADDING.top + t * innerH;
    return { value, yy };
  });

  const lastColor = aqiColor(points[points.length - 1].aqi);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="xMidYMid meet"
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

        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.aqi)}
            r={2.5}
            fill={aqiColor(p.aqi)}
          />
        ))}

        <text
          x={PADDING.left}
          y={HEIGHT - 8}
          fill="#64748b"
          fontSize={10}
        >
          {formatTime(points[0].measuredAt)}
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 8}
          fill="#64748b"
          fontSize={10}
          textAnchor="end"
        >
          {formatTime(points[points.length - 1].measuredAt)}
        </text>
      </svg>
    </div>
  );
}
