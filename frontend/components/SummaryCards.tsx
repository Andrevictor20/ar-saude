import { DashboardStats } from '@/lib/types';
import { aqiColor } from '@/lib/format';
import { getStateAbbr } from '@/lib/states';

interface Props {
  stats: DashboardStats | null;
  activeAlerts: number;
  onNavigateAlerts?: () => void;
  onNavigateMap?: (lat: number, lng: number) => void;
}

export default function SummaryCards({ stats, activeAlerts, onNavigateAlerts, onNavigateMap }: Props) {
  const avg = stats?.averageAqi ?? null;

  return (
    <section>
      <div className="cards-grid">
        {/* Locations Card */}
        <div className="card">
          <div className="card-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div className="metric-label">Localidades monitoradas</div>
          <div className="metric-value">
            {stats?.monitoredLocations ?? '-'}
          </div>
          <div className="metric-sub">
            {stats?.totalMeasurements ?? 0} medições registradas
          </div>
        </div>

        {/* AQI Card */}
        <div className="card">
          <div className="card-icon" style={{ background: avg !== null ? `${aqiColor(avg)}15` : 'rgba(56, 189, 248, 0.1)', borderColor: avg !== null ? `${aqiColor(avg)}25` : 'rgba(56, 189, 248, 0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={avg !== null ? aqiColor(avg) : '#38bdf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div className="metric-label">AQI médio</div>
          <div
            className="metric-value"
            style={{ color: avg !== null ? aqiColor(avg) : undefined }}
          >
            {avg ?? '-'}
          </div>
          <div className="metric-sub">Índice Europeu de Qualidade do Ar</div>
          {avg !== null && (
            <div className="aqi-progress-bar">
              <div
                className="aqi-progress-fill"
                style={{
                  width: `${Math.min((avg / 100) * 100, 100)}%`,
                  background: `linear-gradient(90deg, #22c55e, ${aqiColor(avg)})`,
                }}
              />
            </div>
          )}
        </div>

        {/* Alerts Card */}
        <div 
          className="card clickable-card"
          onClick={onNavigateAlerts}
        >
          <div className="card-icon" style={{ background: activeAlerts > 0 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(34, 197, 94, 0.1)', borderColor: activeAlerts > 0 ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeAlerts > 0 ? '#f97316' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="metric-label">Alertas ativos</div>
          <div
            className="metric-value"
            style={{ color: activeAlerts > 0 ? '#f97316' : '#22c55e' }}
          >
            {activeAlerts}
          </div>
          <div className="metric-sub">Eventos críticos em aberto</div>
        </div>

        {/* Worst Location Card */}
        <div 
          className="card clickable-card"
          onClick={() => {
            if (onNavigateMap && stats?.worst?.latitude != null && stats?.worst?.longitude != null) {
              onNavigateMap(stats.worst.latitude, stats.worst.longitude);
            }
          }}
        >
          <div className="card-icon" style={{ background: stats?.worst ? `${aqiColor(stats.worst.aqi)}15` : 'rgba(56, 189, 248, 0.1)', borderColor: stats?.worst ? `${aqiColor(stats.worst.aqi)}25` : 'rgba(56, 189, 248, 0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stats?.worst ? aqiColor(stats.worst.aqi) : '#38bdf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="metric-label">Pior localidade agora</div>
          <div
            className="metric-value"
            style={{
              fontSize: 22,
              color: stats?.worst ? aqiColor(stats.worst.aqi) : undefined,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            {stats?.worst?.locationName ?? '-'}
            {stats?.worst?.state && (
              <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 10, padding: '2px 6px' }}>
                {getStateAbbr(stats.worst.state)}
              </span>
            )}
          </div>
          <div className="metric-sub">
            {stats?.worst
              ? `AQI ${stats.worst.aqi} · ${stats.worst.level}`
              : 'Sem dados'}
          </div>
        </div>

        {/* Best Location Card */}
        <div 
          className="card clickable-card"
          onClick={() => {
            if (onNavigateMap && stats?.best?.latitude != null && stats?.best?.longitude != null) {
              onNavigateMap(stats.best.latitude, stats.best.longitude);
            }
          }}
        >
          <div className="card-icon" style={{ background: stats?.best ? `${aqiColor(stats.best.aqi)}15` : 'rgba(56, 189, 248, 0.1)', borderColor: stats?.best ? `${aqiColor(stats.best.aqi)}25` : 'rgba(56, 189, 248, 0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stats?.best ? aqiColor(stats.best.aqi) : '#38bdf8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="metric-label">Melhor localidade</div>
          <div
            className="metric-value"
            style={{
              fontSize: 22,
              color: stats?.best ? aqiColor(stats.best.aqi) : undefined,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            {stats?.best?.locationName ?? '-'}
            {stats?.best?.state && (
              <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 10, padding: '2px 6px' }}>
                {getStateAbbr(stats.best.state)}
              </span>
            )}
          </div>
          <div className="metric-sub">
            {stats?.best
              ? `AQI ${stats.best.aqi} · ${stats.best.level}`
              : 'Sem dados'}
          </div>
        </div>
      </div>
    </section>
  );
}
