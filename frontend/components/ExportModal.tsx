'use client';

import { useState } from 'react';
import { Measurement } from '@/lib/types';
import { exportToCsv, exportToXlsx, exportToPdf } from '@/lib/exportUtils';
import { exportMeasurements } from '@/lib/api';

interface ExportModalProps {
  onClose: () => void;
  currentMeasurements: Measurement[];
}

export default function ExportModal({ onClose, currentMeasurements }: ExportModalProps) {
  const [scope, setScope] = useState<'current' | 'all' | 'period'>('current');
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      let dataToExport: Measurement[] = [];
      let filename = 'qualidade_ar_bairros';

      if (scope === 'current') {
        dataToExport = currentMeasurements;
        filename += '_atual';
      } else {
        const start = scope === 'period' && startDate ? startDate : undefined;
        const end = scope === 'period' && endDate ? endDate : undefined;
        dataToExport = await exportMeasurements(start, end);
        filename += '_historico';
        if (start) filename += `_desde_${start}`;
        if (end) filename += `_ate_${end}`;
      }

      if (dataToExport.length === 0) {
        setError('Nenhum dado encontrado para o período selecionado.');
        return;
      }

      if (format === 'csv') {
        exportToCsv(dataToExport, filename);
      } else if (format === 'xlsx') {
        exportToXlsx(dataToExport, filename);
      } else if (format === 'pdf') {
        let pdfData = dataToExport;
        if (dataToExport.length > 1000) {
          // Ordena pelo pior AQI para garantir que os dados críticos entrem no PDF
          pdfData = [...dataToExport].sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1)).slice(0, 1000);
          alert('Devido ao alto volume de dados (mais de 5000 municípios), o PDF foi limitado aos 1000 piores registros (maior AQI) para evitar travamentos.\n\nPara acessar o histórico completo, recomendamos utilizar CSV ou XLSX.');
        }
        exportToPdf(pdfData, filename, 'Relatório de Qualidade do Ar - Dados Exportados');
      }

      onClose();
    } catch (err) {
      console.error('Failed to export:', err);
      setError('Erro ao baixar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Exportar Dados</h3>
          <button onClick={onClose} className="close-btn" aria-label="Fechar" disabled={loading}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>Escopo dos Dados</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              disabled={loading}
              className="select-input"
            >
              <option value="current">Dados Atuais (Última Leitura)</option>
              <option value="period">Selecionar Período</option>
              <option value="all">Histórico Completo (Pode ser grande)</option>
            </select>
          </div>

          {scope === 'period' && (
            <div className="date-range">
              <div className="form-group">
                <label>Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                  className="date-input"
                />
              </div>
              <div className="form-group">
                <label>Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                  className="date-input"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Formato do Arquivo</label>
            <div className="format-buttons">
              <button
                className={`format-btn ${format === 'csv' ? 'active' : ''}`}
                onClick={() => setFormat('csv')}
                disabled={loading}
              >
                CSV
              </button>
              <button
                className={`format-btn ${format === 'xlsx' ? 'active' : ''}`}
                onClick={() => setFormat('xlsx')}
                disabled={loading}
              >
                XLSX
              </button>
              <button
                className={`format-btn ${format === 'pdf' ? 'active' : ''}`}
                onClick={() => setFormat('pdf')}
                disabled={loading}
              >
                PDF
              </button>
            </div>
            {format === 'pdf' && (
              <span className="warning-text" style={{ lineHeight: 1.4 }}>
                Nota: Para evitar lentidão com os 5000+ municípios, a exportação em PDF é limitada aos 1000 registros mais críticos (maior AQI). Para obter todos os dados, utilize CSV ou XLSX.
              </span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-confirm" onClick={handleExport} disabled={loading}>
            {loading ? 'Baixando...' : 'Confirmar e Baixar'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease;
        }
        .modal-content {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text);
        }
        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: color 0.2s;
        }
        .close-btn:hover {
          color: var(--text);
        }
        .modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .select-input, .date-input {
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .select-input:focus, .date-input:focus {
          border-color: var(--accent);
        }
        .date-range {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .format-buttons {
          display: flex;
          gap: 8px;
        }
        .format-btn {
          flex: 1;
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .format-btn.active {
          background: var(--accent);
          color: var(--bg);
          border-color: var(--accent);
        }
        .format-btn:hover:not(.active) {
          color: var(--text);
          border-color: var(--text-muted);
        }
        .error-msg {
          color: #ef4444;
          font-size: 13px;
          background: rgba(239, 68, 68, 0.1);
          padding: 8px 12px;
          border-radius: 6px;
        }
        .warning-text {
          color: #f59e0b;
          font-size: 12px;
          margin-top: 4px;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: var(--panel-2);
        }
        .btn-cancel, .btn-confirm {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-cancel {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }
        .btn-cancel:hover {
          background: rgba(255,255,255,0.05);
        }
        .btn-confirm {
          background: var(--accent);
          color: var(--bg);
          border: none;
        }
        .btn-confirm:hover {
          opacity: 0.9;
        }
        .btn-confirm:disabled, .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
