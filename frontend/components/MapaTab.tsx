'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Measurement, DashboardStats } from '@/lib/types';
import { aqiColor, aqiLevel, formatNumber, formatTime } from '@/lib/format';

/* ─── Leaflet dynamic import (SSR-safe) ─── */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

/* ─── Constants ─── */
// Brazil approx center
const MAP_CENTER: [number, number] = [-14.2350, -51.9253];
const MAP_ZOOM = 4;
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const AQI_LEGEND: { label: string; range: string; color: string }[] = [
  { label: 'Bom', range: '0–20', color: '#22c55e' },
  { label: 'Moderado', range: '21–40', color: '#84cc16' },
  { label: 'Ruim p/ sensíveis', range: '41–60', color: '#eab308' },
  { label: 'Ruim', range: '61–80', color: '#f97316' },
  { label: 'Muito Ruim', range: '81–100', color: '#ef4444' },
  { label: 'Perigoso', range: '100+', color: '#a855f7' },
];

/* ─── Props ─── */
interface MapaTabProps {
  measurements: Measurement[];
  stats: DashboardStats | null;
  focus?: [number, number] | null;
}

/* ─── Component ─── */
export default function MapaTab({ measurements, stats, focus }: MapaTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  /* Computed stats for the status bar */
  const statusData = useMemo(() => {
    const valid = measurements.filter((m) => m.aqi !== null);
    const total = valid.length;
    if (total === 0) return null;

    const avg = Math.round(valid.reduce((s, m) => s + (m.aqi ?? 0), 0) / total);
    const criticos = valid.filter((m) => (m.aqi ?? 0) > 80).length;
    const bons = valid.filter((m) => (m.aqi ?? 0) <= 20).length;
    const worst = valid.reduce(
      (w, m) => ((m.aqi ?? 0) > (w.aqi ?? 0) ? m : w),
      valid[0],
    );

    return { avg, criticos, worst, bons };
  }, [measurements]);

  /* Init map once */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    /* Legend control */
    const legend = new L.Control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'mapa-legend');
      div.innerHTML = `
        <div style="
          background:var(--panel,#151e2e);border:1px solid var(--border,#233047);
          border-radius:8px;padding:10px 14px;font-size:11px;
          color:var(--text,#e2e8f0);min-width:130px;
          box-shadow:0 2px 12px rgba(0,0,0,.4);
        ">
          <div style="font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;font-size:10px;color:var(--text-muted,#94a3b8)">Índice AQI</div>
          ${AQI_LEGEND.map(
            (item) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0"></span>
              <span>${item.label}</span>
              <span style="margin-left:auto;color:var(--text-dim,#64748b)">${item.range}</span>
            </div>
          `,
          ).join('')}
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  /* Sync Markers with measurements */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    const markers = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const children = cluster.getAllChildMarkers();
        let sumAqi = 0;
        let countAqi = 0;
        let maxAqi = 0;

        children.forEach((child: any) => {
          if (child.options && child.options.aqi !== undefined && child.options.aqi !== null) {
            sumAqi += child.options.aqi;
            countAqi++;
            if (child.options.aqi > maxAqi) {
              maxAqi = child.options.aqi;
            }
          }
        });

        // Use the worst AQI in the cluster to color the cluster marker to highlight danger areas
        const clusterAqi = maxAqi > 0 ? maxAqi : (countAqi > 0 ? Math.round(sumAqi / countAqi) : 0);
        const color = clusterAqi > 0 ? aqiColor(clusterAqi) : '#475569';
        
        return L.divIcon({
          html: `<div style="background-color: ${color}dd; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid rgba(255,255,255,0.5); box-shadow: 0 0 10px rgba(0,0,0,0.5);">${children.length}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
        });
      }
    });
    
    clusterGroupRef.current = markers;

    measurements.forEach((m) => {
      if (m.latitude == null || m.longitude == null) return;

      const center: [number, number] = [m.latitude, m.longitude];

      if (m.aqi !== null) {
        // Criar ponto pulsante
        const markerHtml = `
          <div class="glowing-point-wrapper">
             <div class="glowing-point-pulse" style="background:${aqiColor(m.aqi)}"></div>
             <div class="glowing-point-core" style="background:${aqiColor(m.aqi)}"></div>
          </div>
        `;
        const customIcon = L.divIcon({
          className: 'custom-glowing-icon',
          html: markerHtml,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          tooltipAnchor: [0, -15]
        });

        const marker = L.marker(center, {
          icon: customIcon,
          aqi: m.aqi, // custom property for cluster aggregation
        } as any);

        marker.bindTooltip(
          `<div class="animated-popup">
            <div class="popup-header">
              <div class="popup-title">${m.locationName}</div>
              <div class="popup-aqi" style="background:${aqiColor(m.aqi)}22; color:${aqiColor(m.aqi)}; border: 1px solid ${aqiColor(m.aqi)}55;">
                AQI: <strong>${m.aqi ?? '–'}</strong>
              </div>
            </div>
            <div class="popup-grid">
              <div class="popup-item"><span>PM2.5</span><strong>${formatNumber(m.pm2_5)}</strong></div>
              <div class="popup-item"><span>PM10</span><strong>${formatNumber(m.pm10)}</strong></div>
              <div class="popup-item"><span>NO₂</span><strong>${formatNumber(m.no2)}</strong></div>
              <div class="popup-item"><span>O₃</span><strong>${formatNumber(m.ozone)}</strong></div>
              <div class="popup-item"><span>CO</span><strong>${formatNumber(m.co)}</strong></div>
              <div class="popup-item"><span>SO₂</span><strong>${formatNumber(m.so2)}</strong></div>
              <div class="popup-item"><span>NH₃</span><strong>${formatNumber(m.nh3)}</strong></div>
              <div class="popup-item"><span>NO</span><strong>${formatNumber(m.no)}</strong></div>
            </div>
            <div class="popup-footer">
              <span class="live-indicator"></span> Atualizado: ${formatTime(m.measuredAt)}
            </div>
          </div>`,
          {
            direction: 'top',
            className: 'mapa-tooltip-rich',
          },
        );

        markers.addLayer(marker);

      } else {
        // Sem dados: exibir um ponto cinza menor
        const customIcon = L.divIcon({
          className: 'custom-glowing-icon no-data',
          html: `<div class="glowing-point-wrapper" style="width:16px;height:16px;"><div class="glowing-point-core" style="background:#475569;width:8px;height:8px;"></div></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          tooltipAnchor: [0, -10]
        });

        const marker = L.marker(center, { icon: customIcon, aqi: null } as any);
        marker.bindTooltip(
          `<div style="font-size:12px;padding:4px;"><strong>${m.locationName}</strong><br/>Sem dados recentes</div>`,
          { className: 'mapa-tooltip-rich', direction: 'top' }
        );
        markers.addLayer(marker);
      }
    });

    map.addLayer(markers);
  }, [measurements]);

  /* Handle focus changes */
  useEffect(() => {
    if (focus && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(focus, 12, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [focus]);

  return (
    <div className="mapa-tab-root">
      <div ref={mapContainerRef} className="mapa-container" />

      {/* Status bar */}
      {statusData && (
        <div className="mapa-status-bar">
          <StatusItem
            label="AQI Médio"
            value={String(statusData.avg)}
            color={aqiColor(statusData.avg)}
          />
          <StatusItem
            label="Localidades Críticas"
            value={String(statusData.criticos)}
            color={statusData.criticos > 0 ? '#ef4444' : '#22c55e'}
          />
          <StatusItem
            label="Pior Localidade"
            value={statusData.worst.locationName}
            sub={`AQI ${statusData.worst.aqi ?? '–'}`}
            color={aqiColor(statusData.worst.aqi)}
          />
          <StatusItem
            label="Localidades Boas"
            value={String(statusData.bons)}
            color="#22c55e"
          />
        </div>
      )}

      <style jsx>{`
        .mapa-tab-root {
          display: flex;
          flex-direction: column;
          flex: 1;
          height: 100%;
          position: relative;
        }
        .mapa-container {
          flex: 1;
          min-height: 75vh;
          width: 100%;
          border-radius: var(--radius, 10px);
          overflow: hidden;
          border: 1px solid var(--border, #233047);
        }
        .mapa-status-bar {
          display: flex;
          gap: 12px;
          padding: 12px 0 0;
          flex-wrap: wrap;
        }
      `}</style>

      {/* Global Leaflet overrides scoped to this component */}
      <style>{`
        .mapa-tooltip-rich {
          background: var(--bg-elevated) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid var(--border) !important;
          border-radius: 12px !important;
          color: var(--text) !important;
          box-shadow: var(--shadow) !important;
          padding: 16px !important;
          margin: 0 !important;
          pointer-events: none !important;
        }
        .mapa-tooltip-rich::before {
          border-top-color: var(--border) !important;
        }

        /* Glowing Point Animations */
        .glowing-point-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .glowing-point-core {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          z-index: 2;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
          border: 1.5px solid rgba(255,255,255,0.6);
        }
        .glowing-point-pulse {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          z-index: 1;
          opacity: 0.6;
          animation: mapPulse 2s infinite ease-out;
        }
        @keyframes mapPulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .custom-glowing-icon {
          background: none;
          border: none;
        }
        .custom-glowing-icon.no-data {
          opacity: 0.6;
          filter: grayscale(100%);
        }

        /* Popup Animations & Styling */
        @keyframes popupEnter {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animated-popup {
          animation: popupEnter 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          min-width: 220px;
          font-family: inherit;
        }
        .popup-header {
          display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; padding-right: 12px;
        }
        .popup-title {
          font-weight: 700; font-size: 15px; color: var(--text); line-height: 1.2;
        }
        .popup-aqi {
          padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap;
        }
        .popup-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px;
        }
        .popup-item {
          display: flex; justify-content: space-between; align-items: center; background: var(--panel-2); padding: 4px 8px; border-radius: 6px; font-size: 11px; border: 1px solid var(--border);
        }
        .popup-item span {
          color: var(--text-muted); font-weight: 500;
        }
        .popup-item strong {
          color: var(--text); font-family: monospace; font-size: 12px;
        }
        .popup-footer {
          margin-top: 8px; border-top: 1px solid var(--border); padding-top: 10px; color: var(--text-dim); font-size: 10.5px; display: flex; align-items: center; gap: 6px; font-weight: 500;
        }
        @keyframes pulseDot {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        .live-indicator {
          display: inline-block; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 4px #22c55e; animation: pulseDot 2s infinite;
        }
      `}</style>
    </div>
  );
}

/* ─── Status bar item ─── */
function StatusItem({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        background: 'var(--panel, #151e2e)',
        border: '1px solid var(--border, #233047)',
        borderRadius: 'var(--radius, 10px)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          color: 'var(--text-muted, #94a3b8)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
      {sub && (
        <span style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
