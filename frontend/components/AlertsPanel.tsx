import { Alert } from '@/lib/types';
import {
  formatDateTime,
  severityColor,
  severityLabel,
} from '@/lib/format';

interface Props {
  alerts: Alert[];
}

export default function AlertsPanel({ alerts }: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Alertas ativos</h2>
        <span className="badge" style={{ background: '#1b2638', color: '#94a3b8' }}>
          {alerts.length}
        </span>
      </div>
      <div className="panel-body">
        {alerts.length === 0 ? (
          <div className="empty">Nenhum alerta ativo no momento.</div>
        ) : (
          alerts.map((alert) => {
            const color = severityColor(alert.severity);
            return (
              <div
                key={alert.id}
                className="alert-item"
                style={{ borderLeftColor: color }}
              >
                <div className="alert-top">
                  <span className="alert-neigh">{alert.neighborhoodName}</span>
                  <span
                    className="badge"
                    style={{ background: color, color: '#0b1120' }}
                  >
                    {severityLabel(alert.severity)}
                  </span>
                </div>
                <div className="alert-msg">{alert.message}</div>
                <div className="alert-meta">
                  <span>AQI atual: {alert.aqi}</span>
                  <span>Pico: {alert.peakAqi}</span>
                  <span>Desde {formatDateTime(alert.triggeredAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
