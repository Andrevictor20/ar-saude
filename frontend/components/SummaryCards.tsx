import { DashboardStats } from '@/lib/types';
import { aqiColor } from '@/lib/format';

interface Props {
  stats: DashboardStats | null;
  activeAlerts: number;
}

export default function SummaryCards({ stats, activeAlerts }: Props) {
  const avg = stats?.averageAqi ?? null;

  return (
    <section>
      <div className="cards-grid">
        <div className="card">
          <div className="metric-label">Localidades monitoradas</div>
          <div className="metric-value">
            {stats?.monitoredLocations ?? '-'}
          </div>
          <div className="metric-sub">
            {stats?.totalMeasurements ?? 0} medicoes registradas
          </div>
        </div>

        <div className="card">
          <div className="metric-label">AQI medio</div>
          <div
            className="metric-value"
            style={{ color: avg !== null ? aqiColor(avg) : undefined }}
          >
            {avg ?? '-'}
          </div>
          <div className="metric-sub">Indice Europeu de Qualidade do Ar</div>
        </div>

        <div className="card">
          <div className="metric-label">Alertas ativos</div>
          <div
            className="metric-value"
            style={{ color: activeAlerts > 0 ? '#f97316' : '#22c55e' }}
          >
            {activeAlerts}
          </div>
          <div className="metric-sub">Eventos criticos em aberto</div>
        </div>

        <div className="card">
          <div className="metric-label">Pior localidade agora</div>
          <div
            className="metric-value"
            style={{
              fontSize: 22,
              color: stats?.worst ? aqiColor(stats.worst.aqi) : undefined,
            }}
          >
            {stats?.worst?.locationName ?? '-'}
          </div>
          <div className="metric-sub">
            {stats?.worst
              ? `AQI ${stats.worst.aqi} - ${stats.worst.level}`
              : 'Sem dados'}
          </div>
        </div>
      </div>
    </section>
  );
}
