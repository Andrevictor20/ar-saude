import { useState, useRef, useEffect } from 'react';
import { Measurement } from '@/lib/types';

interface Props {
  measurements: Measurement[];
  selectedId: string;
  onSelect: (m: Measurement) => void;
}

export default function LocationSelect({ measurements, selectedId, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMeasurement = measurements.find(m => m.locationId === selectedId);
  
  const filtered = measurements
    .filter(m => m.locationName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.locationName.localeCompare(b.locationName));

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--panel-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{selectedMeasurement ? selectedMeasurement.locationName : '-- Escolha uma localidade --'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow)',
          zIndex: 50,
          maxHeight: 300,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '8px' }}>
            <input 
              type="text" 
              placeholder="Pesquisar localidade..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '8px 12px',
                borderRadius: 6,
                outline: 'none',
                fontFamily: "'Inter', sans-serif",
                fontSize: 13
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 4px 8px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                Nenhuma localidade encontrada
              </div>
            ) : (
              filtered.map(m => (
                <div 
                  key={m.locationId}
                  onClick={() => {
                    onSelect(m);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="location-select-item"
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: m.locationId === selectedId ? 'var(--accent)' : 'transparent',
                    color: m.locationId === selectedId ? 'var(--bg)' : 'var(--text)'
                  }}
                >
                  {m.locationName}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <style>{`
        .location-select-item:hover {
          background: rgba(56, 189, 248, 0.1) !important;
          color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
}
