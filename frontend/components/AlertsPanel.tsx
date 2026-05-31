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
                {alert.triggeredBy && alert.triggeredBy.length > 0 && (
                  <div className="alert-tips" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <strong>Dicas: </strong>
                    {alert.triggeredBy.map(trigger => {
                      if (trigger.startsWith('PM2.5') || trigger.startsWith('PM10')) return '😷 Use máscara, evite exercícios ao ar livre. ';
                      if (trigger.startsWith('O3')) return '☀️ Evite o sol forte e atividades intensas à tarde. ';
                      if (trigger.startsWith('NO2') || trigger.startsWith('SO2')) return '🫁 Fique em ambientes fechados se tiver problemas respiratórios. ';
                      if (trigger.startsWith('CO')) return '🚗 Evite áreas de tráfego intenso. ';
                      return '';
                    }).join(' ')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
