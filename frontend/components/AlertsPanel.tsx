import { useMemo } from 'react';
import { Alert } from '@/lib/types';
import { formatDateTime, severityColor, severityLabel } from '@/lib/format';

interface Props {
  alerts: Alert[];
}

export default function AlertsPanel({ alerts }: Props) {
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, Alert & { neighborhoods: string[] }>();
    alerts.forEach((alert) => {
      const triggersSig = alert.triggeredBy
        ? [...alert.triggeredBy].sort().join('|')
        : '';
      const key = `${alert.severity}|${alert.aqi}|${alert.peakAqi}|${triggersSig}`;
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        if (!existing.neighborhoods.includes(alert.neighborhoodName)) {
          existing.neighborhoods.push(alert.neighborhoodName);
        }
      } else {
        groups.set(key, { ...alert, neighborhoods: [alert.neighborhoodName] });
      }
    });
    return Array.from(groups.values());
  }, [alerts]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Alertas ativos</h2>
        <span
          className="badge"
          style={{ background: '#1b2638', color: '#94a3b8' }}
        >
          {alerts.length}{' '}
          {alerts.length !== groupedAlerts.length
            ? `(Agrupados em ${groupedAlerts.length})`
            : ''}
        </span>
      </div>
      <div className="panel-body">
        {groupedAlerts.length === 0 ? (
          <div className="empty">Nenhum alerta ativo no momento.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '16px',
            }}
          >
            {groupedAlerts.map((group) => {
              const color = severityColor(group.severity);
              return (
                <div
                  key={group.id}
                  className="alert-item"
                  style={{
                    borderLeftColor: color,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    className="alert-top"
                    style={{
                      alignItems: 'flex-start',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        color: color,
                        fontSize: '15px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        width: '100%',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        paddingBottom: '12px',
                      }}
                    >
                      {severityLabel(group.severity)}
                    </div>

                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                    >
                      {group.neighborhoods.map((n, i) => (
                        <span
                          key={i}
                          className="badge"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="alert-msg"
                    style={{ flex: 1, marginTop: '12px' }}
                  >
                    {group.message.replace(` em ${group.neighborhoodName}`, '')}
                  </div>
                  <div className="alert-meta">
                    <span>AQI atual: {group.aqi}</span>
                    <span>Pico: {group.peakAqi}</span>
                    <span>Desde {formatDateTime(group.triggeredAt)}</span>
                  </div>
                  {group.triggeredBy && group.triggeredBy.length > 0 && (
                    <div
                      className="alert-tips"
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                      }}
                    >
                      <strong>Dicas: </strong>
                      {group.triggeredBy
                        .map((trigger) => {
                          if (
                            trigger.startsWith('PM2.5') ||
                            trigger.startsWith('PM10')
                          )
                            return '😷 Use máscara, evite exercícios ao ar livre. ';
                          if (trigger.startsWith('O3'))
                            return '☀️ Evite o sol forte e atividades intensas à tarde. ';
                          if (
                            trigger.startsWith('NO2') ||
                            trigger.startsWith('SO2')
                          )
                            return '🫁 Fique em ambientes fechados se tiver problemas respiratórios. ';
                          if (trigger.startsWith('CO'))
                            return '🚗 Evite áreas de tráfego intenso. ';
                          return '';
                        })
                        .join(' ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
