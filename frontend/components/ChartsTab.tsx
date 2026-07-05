'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  LabelList
} from 'recharts';
import { Measurement, DashboardStats, Alert } from '@/lib/types';
import { levelColor, aqiColor } from '@/lib/format';
import { getStateUF } from '@/lib/states';
import { exportChartsDataToCsv, exportChartsDataToXlsx, exportChartsToPdf } from '@/lib/exportUtils';

interface Props {
  measurements: Measurement[];
  stats: DashboardStats | null;
  alerts: Alert[];
}

// WHO 24h Limits (approximate, for scaling the radar chart)
const WHO_LIMITS = {
  pm2_5: 15,
  pm10: 45,
  no2: 25,
  ozone: 100,
  so2: 40,
  co: 4000,
};

export default function ChartsTab({ measurements, stats, alerts }: Props) {
  /* 1. Donut Chart: AQI Distribution */
  const distributionData = useMemo(() => {
    if (!stats?.distribution) return [];
    return stats.distribution.map((d) => ({
      name: d.level,
      value: d.count,
      fill: levelColor(d.level),
    })).filter(d => d.value > 0);
  }, [stats]);

  /* 2. Bar Chart: Average AQI by State */
  const stateData = useMemo(() => {
    const stateMap = new Map<string, { sum: number; count: number }>();
    measurements.forEach((m) => {
      if (m.state && m.aqi !== null) {
        const uf = getStateUF(m.state);
        const current = stateMap.get(uf) || { sum: 0, count: 0 };
        stateMap.set(uf, {
          sum: current.sum + m.aqi,
          count: current.count + 1,
        });
      }
    });

    return Array.from(stateMap.entries())
      .map(([state, { sum, count }]) => ({
        state,
        aqi: Math.round(sum / count),
      }))
      .sort((a, b) => b.aqi - a.aqi); // Top worst states
  }, [measurements]);

  /* 3. Horizontal Bar Chart: Pollutants vs WHO Limit */
  const pollutantsData = useMemo(() => {
    const sums = { pm2_5: 0, pm10: 0, no2: 0, ozone: 0, so2: 0, co: 0 };
    const counts = { pm2_5: 0, pm10: 0, no2: 0, ozone: 0, so2: 0, co: 0 };

    measurements.forEach((m) => {
      if (m.pm2_5 !== null) { sums.pm2_5 += m.pm2_5; counts.pm2_5++; }
      if (m.pm10 !== null) { sums.pm10 += m.pm10; counts.pm10++; }
      if (m.no2 !== null) { sums.no2 += m.no2; counts.no2++; }
      if (m.ozone !== null) { sums.ozone += m.ozone; counts.ozone++; }
      if (m.so2 !== null) { sums.so2 += m.so2; counts.so2++; }
      if (m.co !== null) { sums.co += m.co; counts.co++; }
    });

    const getPct = (key: keyof typeof WHO_LIMITS) => {
      if (counts[key] === 0) return 0;
      const avg = sums[key] / counts[key];
      return Math.round((avg / WHO_LIMITS[key]) * 100);
    };

    return [
      { subject: 'PM2.5', A: getPct('pm2_5') },
      { subject: 'PM10', A: getPct('pm10') },
      { subject: 'NO₂', A: getPct('no2') },
      { subject: 'O₃', A: getPct('ozone') },
      { subject: 'SO₂', A: getPct('so2') },
      { subject: 'CO', A: getPct('co') },
    ].sort((a, b) => b.A - a.A);
  }, [measurements]);

  /* 4. Bar Chart: Alerts by Severity */
  const alertsData = useMemo(() => {
    const counts = { atencao: 0, alerta: 0, critico: 0, emergencia: 0 };
    alerts.forEach((a) => {
      if (counts[a.severity] !== undefined) counts[a.severity]++;
    });
    return [
      { name: 'Atenção', count: counts.atencao, fill: '#eab308' },
      { name: 'Alerta', count: counts.alerta, fill: '#f97316' },
      { name: 'Crítico', count: counts.critico, fill: '#ef4444' },
      { name: 'Emergência', count: counts.emergencia, fill: '#a855f7' },
    ];
  }, [alerts]);

  /* 5. Top 5 Worst Cities */
  const topCitiesData = useMemo(() => {
    const valid = measurements.filter((m) => m.aqi !== null);
    valid.sort((a, b) => (b.aqi as number) - (a.aqi as number));
    return valid.slice(0, 5).map(m => ({
      name: m.locationName,
      uf: getStateUF(m.state),
      aqi: m.aqi,
      fill: aqiColor(m.aqi as number)
    }));
  }, [measurements]);

  /* 6. Top 5 Best Cities */
  const bestCitiesData = useMemo(() => {
    const valid = measurements.filter((m) => m.aqi !== null);
    valid.sort((a, b) => (a.aqi as number) - (b.aqi as number));
    return valid.slice(0, 5).map(m => ({
      name: m.locationName,
      uf: getStateUF(m.state),
      aqi: m.aqi,
      fill: aqiColor(m.aqi as number)
    }));
  }, [measurements]);

  /* Custom Tooltip for Charts to match our dark/glass theme */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label ?? payload[0].name}</p>
          <p className="chart-tooltip-value" style={{ color: payload[0].payload.fill || payload[0].color || 'var(--text)' }}>
            {payload[0].value} {payload[0].dataKey === 'A' ? '% do Limite' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  const handleExportData = (type: 'csv' | 'xlsx') => {
    const datasets = {
      'Distribuição AQI': distributionData,
      'Média por Estado': stateData,
      'Poluentes vs Limite': pollutantsData,
      'Alertas por Severidade': alertsData,
      'Top 5 Piores': topCitiesData,
      'Top 5 Melhores': bestCitiesData,
    };
    if (type === 'csv') exportChartsDataToCsv(datasets, 'graficos_dados');
    else exportChartsDataToXlsx(datasets, 'graficos_dados');
  };

  return (
    <div className="charts-tab-root">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => handleExportData('csv')}>
          Exportar Dados (CSV)
        </button>
        <button className="btn btn-secondary" onClick={() => handleExportData('xlsx')}>
          Exportar Dados (XLSX)
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => exportChartsToPdf('charts-export-container', 'relatorio_graficos', 'Relatório Consolidado de Gráficos')}
        >
          Salvar Gráficos (PDF)
        </button>
      </div>

      <div id="charts-export-container" className="charts-grid" style={{ background: 'var(--bg)', padding: '12px' }}>
        
        {/* Chart 1 */}
        <div className="chart-card">
          <h3 className="chart-title">Distribuição Nacional (Níveis AQI)</h3>
          <p className="chart-desc">Proporção de municípios em cada nível de qualidade do ar.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2 */}
        <div className="chart-card">
          <h3 className="chart-title">AQI Médio por Estado</h3>
          <p className="chart-desc">Ranking das unidades federativas com a pior média no momento.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stateData.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--text-muted)" />
                <YAxis dataKey="state" type="category" stroke="var(--text-muted)" width={40} interval={0} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="aqi" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="aqi" position="right" style={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  {stateData.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={aqiColor(entry.aqi)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Pollutants Bar Chart */}
        <div className="chart-card">
          <h3 className="chart-title">Perfil de Poluentes vs Limite OMS</h3>
          <p className="chart-desc">Percentual de concentração média nacional comparado ao limite diário sugerido.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pollutantsData}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--text-muted)" domain={[0, 'dataMax + 10']} />
                <YAxis dataKey="subject" type="category" stroke="var(--text-muted)" width={50} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="A" radius={[0, 4, 4, 0]}>
                  {pollutantsData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.A > 100 ? '#ef4444' : entry.A > 50 ? '#f97316' : '#38bdf8'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Alerts */}
        <div className="chart-card">
          <h3 className="chart-title">Alertas Ativos por Severidade</h3>
          <p className="chart-desc">Volume atual de incidentes mapeados pelo Motor de Alertas.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={alertsData}
                margin={{ top: 20, right: 50, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {alertsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Top 5 Cities */}
        <div className="chart-card">
          <h3 className="chart-title">Top 5 Cidades Críticas</h3>
          <p className="chart-desc">Municípios com os piores índices de qualidade do ar neste momento.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCitiesData}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--text-muted)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="var(--text-muted)" 
                  width={100}
                  tickFormatter={(val, i) => `${val} - ${topCitiesData[i]?.uf}`}
                  style={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="aqi" radius={[0, 4, 4, 0]}>
                  {topCitiesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 6: Top 5 Best Cities */}
        <div className="chart-card">
          <h3 className="chart-title">Top 5 Melhores Cidades</h3>
          <p className="chart-desc">Municípios com o ar mais limpo do país neste momento.</p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bestCitiesData}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--text-muted)" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="var(--text-muted)" 
                  width={100}
                  tickFormatter={(val, i) => `${val} - ${bestCitiesData[i]?.uf}`}
                  style={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="aqi" radius={[0, 4, 4, 0]}>
                  {bestCitiesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <style jsx>{`
        .charts-tab-root {
          padding: 24px 0;
          animation: fade-in 0.3s ease-out;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
        }
        .chart-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius, 12px);
          padding: 24px;
          display: flex;
          flex-direction: column;
        }
        .chart-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
        }
        .chart-desc {
          margin: 4px 0 24px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .chart-container {
          flex: 1;
          min-height: 280px;
        }
      `}</style>
      <style>{`
        /* Recharts Overrides for Tooltip */
        .chart-tooltip {
          background: var(--bg-elevated) !important;
          backdrop-filter: blur(8px);
          border: 1px solid var(--border);
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .chart-tooltip-label {
          margin: 0 0 4px;
          font-weight: 600;
          font-size: 13px;
          color: var(--text);
        }
        .chart-tooltip-value {
          margin: 0;
          font-weight: 700;
          font-size: 16px;
        }
        .recharts-legend-item-text {
          color: var(--text-muted) !important;
          font-size: 12px;
        }
        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
          .chart-card {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
