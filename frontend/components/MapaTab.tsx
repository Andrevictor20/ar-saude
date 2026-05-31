'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Measurement, DashboardStats } from '@/lib/types';
import { aqiColor, aqiLevel, formatNumber, formatTime } from '@/lib/format';

/* ─── Leaflet dynamic import (SSR-safe) ─── */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ─── Constants ─── */
const MAP_CENTER: [number, number] = [-2.5307, -44.3068];
const MAP_ZOOM = 13;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
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
}

/* ─── Helpers ─── */
function createCircleIcon(aqi: number | null, size: number): L.DivIcon {
  const color = aqiColor(aqi);
  const label = aqi !== null ? String(aqi) : '–';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:#0b1120;
      box-shadow:0 0 0 3px ${color}44, 0 2px 8px rgba(0,0,0,.5);
      transition: transform .15s ease;
    ">${label}</div>`,
  });
}

/* ─── Component ─── */
export default function MapaTab({ measurements, stats }: MapaTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

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

  /* Sync markers with measurements */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    /* Remove old markers */
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    measurements.forEach((m) => {
      if (m.latitude === null || m.longitude === null) return;

      const marker = L.marker([m.latitude, m.longitude], {
        icon: createCircleIcon(m.aqi, 32),
      });

      /* Tooltip on hover */
      marker.bindTooltip(
        `<div style="font-size:12px;line-height:1.6">
          <strong>${m.neighborhoodName}</strong><br/>
          AQI: <strong style="color:${aqiColor(m.aqi)}">${m.aqi ?? '–'}</strong> · ${aqiLevel(m.aqi)}<br/>
          PM2.5: ${formatNumber(m.pm2_5)} · PM10: ${formatNumber(m.pm10)}
        </div>`,
        {
          direction: 'top',
          offset: [0, -18],
          className: 'mapa-tooltip',
        },
      );

      /* Popup on click */
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.7;min-width:160px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${m.neighborhoodName}</div>
          <div>AQI: <strong style="color:${aqiColor(m.aqi)}">${m.aqi ?? '–'}</strong></div>
          <div>PM2.5: ${formatNumber(m.pm2_5)}</div>
          <div>PM10: ${formatNumber(m.pm10)}</div>
          <div>NO₂: ${formatNumber(m.no2)}</div>
          <div>O₃: ${formatNumber(m.ozone)}</div>
          <div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;"></div>
          <div>CO: ${formatNumber(m.co)}</div>
          <div>SO₂: ${formatNumber(m.so2)}</div>
          <div>NH₃: ${formatNumber(m.nh3)}</div>
          <div>NO: ${formatNumber(m.no)}</div>
          <div style="margin-top:6px;color:var(--text-dim,#64748b);font-size:11px">
            Atualizado: ${formatTime(m.measuredAt)}
          </div>
        </div>`,
        { className: 'mapa-popup' },
      );

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [measurements]);

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
            label="Bairros Críticos"
            value={String(statusData.criticos)}
            color={statusData.criticos > 0 ? '#ef4444' : '#22c55e'}
          />
          <StatusItem
            label="Pior Bairro"
            value={statusData.worst.neighborhoodName}
            sub={`AQI ${statusData.worst.aqi ?? '–'}`}
            color={aqiColor(statusData.worst.aqi)}
          />
          <StatusItem
            label="Bairros Bons"
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
          min-height: 0;
          position: relative;
        }
        .mapa-container {
          flex: 1;
          min-height: 500px;
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
        .mapa-tooltip {
          background: var(--panel, #151e2e) !important;
          border: 1px solid var(--border, #233047) !important;
          border-radius: 8px !important;
          color: var(--text, #e2e8f0) !important;
          box-shadow: 0 4px 16px rgba(0,0,0,.5) !important;
          padding: 8px 12px !important;
        }
        .mapa-tooltip::before {
          border-top-color: var(--border, #233047) !important;
        }
        .mapa-popup .leaflet-popup-content-wrapper {
          background: var(--panel, #151e2e) !important;
          border: 1px solid var(--border, #233047) !important;
          border-radius: 10px !important;
          color: var(--text, #e2e8f0) !important;
          box-shadow: 0 4px 20px rgba(0,0,0,.5) !important;
        }
        .mapa-popup .leaflet-popup-tip {
          background: var(--panel, #151e2e) !important;
          border: 1px solid var(--border, #233047) !important;
        }
        .mapa-popup .leaflet-popup-close-button {
          color: var(--text-muted, #94a3b8) !important;
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
