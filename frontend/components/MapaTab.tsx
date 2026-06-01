'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { Measurement, DashboardStats } from '@/lib/types';
import { aqiColor, aqiLevel, formatNumber, formatTime } from '@/lib/format';

/* ─── Leaflet dynamic import (SSR-safe) ─── */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ─── Constants ─── */
const MAP_CENTER: [number, number] = [-2.5307, -44.3068];
const MAP_ZOOM = 13;
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
}

/* ─── Component ─── */
export default function MapaTab({ measurements, stats }: MapaTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  useEffect(() => {
    fetch('/bairros_slz.geojson?v=' + new Date().getTime())
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar geojson');
        return res.json();
      })
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.error('Erro ao carregar bairros_slz.geojson:', err));
  }, []);

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

  /* Sync GeoJSON with measurements */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!geoJsonData || !geoJsonData.features) {
      console.log('GeoJSON Data não carregado ou sem features:', geoJsonData);
      return;
    }

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    console.log('Adicionando GeoJSON com', geoJsonData.features.length, 'bairros.');

    geoJsonLayerRef.current = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const name = feature?.properties?.name;
        const m = measurements.find((x) => x.neighborhoodName === name);
        if (!m || m.aqi === null) {
          return {
            color: '#233047',
            weight: 1,
            fillColor: '#000000',
            fillOpacity: 0.1,
          };
        }
        return {
          color: '#233047',
          weight: 1,
          fillColor: aqiColor(m.aqi),
          fillOpacity: 0.45,
          className: 'geojson-polygon',
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature?.properties?.name;
        const m = measurements.find((x) => x.neighborhoodName === name);

        if (m && m.aqi !== null) {
          layer.bindTooltip(
            `<div style="font-size:12px;line-height:1.6;min-width:180px;">
              <strong>${m.neighborhoodName}</strong><br/>
              AQI: <strong style="color:${aqiColor(m.aqi)}">${m.aqi ?? '–'}</strong> · ${aqiLevel(m.aqi)}<br/>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:6px;">
                <div>PM2.5: <strong style="color:var(--text)">${formatNumber(m.pm2_5)}</strong></div>
                <div>PM10: <strong style="color:var(--text)">${formatNumber(m.pm10)}</strong></div>
                <div>NO₂: <strong style="color:var(--text)">${formatNumber(m.no2)}</strong></div>
                <div>O₃: <strong style="color:var(--text)">${formatNumber(m.ozone)}</strong></div>
                <div>CO: <strong style="color:var(--text)">${formatNumber(m.co)}</strong></div>
                <div>SO₂: <strong style="color:var(--text)">${formatNumber(m.so2)}</strong></div>
                <div>NH₃: <strong style="color:var(--text)">${formatNumber(m.nh3)}</strong></div>
                <div>NO: <strong style="color:var(--text)">${formatNumber(m.no)}</strong></div>
              </div>
            </div>`,
            {
              direction: 'auto',
              sticky: true,
              className: 'mapa-tooltip',
            },
          );

          layer.bindPopup(
            `<div class="animated-popup">
              <div class="popup-header">
                <div class="popup-title">${m.neighborhoodName}</div>
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
            { className: 'mapa-popup' },
          );

          // Add interactive hover effects
          layer.on({
            mouseover: (e) => {
              const target = e.target as L.Path;
              target.setStyle({
                fillOpacity: 0.65,
                weight: 2,
                color: '#ffffff'
              });
              if (!L.Browser.ie && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              geoJsonLayerRef.current?.resetStyle(e.target);
            }
          });
        } else {
          layer.bindTooltip(
            `<div style="font-size:12px;"><strong>${name}</strong><br/>Sem dados recentes</div>`,
            { className: 'mapa-tooltip', sticky: true }
          );
        }
      },
    }).addTo(map);
  }, [measurements, geoJsonData]);

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
        /* GeoJSON Animations */
        .geojson-polygon {
          transition: fill-opacity 0.2s ease, stroke-width 0.2s ease, stroke 0.2s ease;
        }

        .mapa-tooltip {
          background: var(--panel) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          color: var(--text) !important;
          box-shadow: var(--shadow) !important;
          padding: 8px 12px !important;
        }
        .mapa-tooltip::before {
          border-top-color: var(--border, #233047) !important;
        }
        .mapa-popup .leaflet-popup-content-wrapper {
          padding: 16px !important;
          background: var(--bg-elevated) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid var(--border) !important;
          border-radius: 12px !important;
          color: var(--text) !important;
          box-shadow: var(--shadow) !important;
        }
        .mapa-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .mapa-popup .leaflet-popup-tip {
          background: var(--bg-elevated) !important;
          border: 1px solid var(--border) !important;
        }
        .mapa-popup .leaflet-popup-close-button {
          color: var(--text-muted, #94a3b8) !important;
          top: 10px !important;
          right: 10px !important;
        }

        /* Marker Animations */
        @keyframes pulseMarker {
          0% { box-shadow: 0 0 0 0 var(--marker-color), 0 2px 8px rgba(0,0,0,.5); }
          70% { box-shadow: 0 0 0 14px rgba(0,0,0,0), 0 2px 8px rgba(0,0,0,.5); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0), 0 2px 8px rgba(0,0,0,.5); }
        }
        .pulse-marker {
          animation: pulseMarker 3s infinite ease-in-out;
        }
        .pulse-marker:hover {
          transform: scale(1.15) !important;
          z-index: 1000 !important;
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
