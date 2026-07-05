import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Alert, Measurement } from './types';
import { formatDateTime } from './format';

const formatExportData = (data: Measurement[]) => {
  return data.map((m) => ({
    Localidade: m.locationName,
    AQI: m.aqi ?? '-',
    'Nível': m.level,
    'PM2.5 (µg/m³)': m.pm2_5 ?? '-',
    'PM10 (µg/m³)': m.pm10 ?? '-',
    'NO2 (µg/m³)': m.no2 ?? '-',
    'O3 (µg/m³)': m.ozone ?? '-',
    'CO (µg/m³)': m.co ?? '-',
    'SO2 (µg/m³)': m.so2 ?? '-',
    'NH3 (µg/m³)': m.nh3 ?? '-',
    'NO (µg/m³)': m.no ?? '-',
    'Data/Hora da Medição': formatDateTime(m.measuredAt),
  }));
};

export const exportToXlsx = (data: Measurement[], filename: string) => {
  const formattedData = formatExportData(data);
  const worksheet = xlsx.utils.json_to_sheet(formattedData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados');
  xlsx.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToCsv = (data: Measurement[], filename: string) => {
  const formattedData = formatExportData(data);
  const worksheet = xlsx.utils.json_to_sheet(formattedData);
  const csvOutput = xlsx.utils.sheet_to_csv(worksheet);

  // Download CSV
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPdf = async (
  data: Measurement[],
  filename: string,
  title: string,
  chartElementId?: string
) => {
  const formattedData = formatExportData(data);
  if (formattedData.length === 0) return;

  const doc = new jsPDF('landscape');

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 28);

  let startY = 35;

  if (chartElementId) {
    const el = document.getElementById(chartElementId);
    if (el) {
      try {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth() - 28;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // If image is too tall, scale it down to fit on the first page
        const maxHeight = doc.internal.pageSize.getHeight() - 40;
        const finalHeight = pdfHeight > maxHeight ? maxHeight : pdfHeight;
        const finalWidth = (imgProps.width * finalHeight) / imgProps.height;
        
        doc.addImage(imgData, 'PNG', 14, 35, finalWidth, finalHeight);
        startY = 35 + finalHeight + 10;
        if (startY > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          startY = 20;
        }
      } catch (err) {
        console.error('Failed to capture chart image', err);
      }
    }
  }

  const head = [Object.keys(formattedData[0])];
  const body = formattedData.map((row) => Object.values(row).map(String));

  autoTable(doc, {
    head: head,
    body: body,
    startY: startY,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [56, 189, 248] }, // var(--accent) aprox
  });

  doc.save(`${filename}.pdf`);
};

/* ─── ALERTS EXPORT ─── */
const formatAlertsData = (data: Alert[]) => {
  return data.map((a) => ({
    Localidade: a.locationName,
    Estado: a.state,
    Mensagem: a.message,
    Gravidade: a.severity,
    AQI: a.aqi,
    Ativo: a.status === 'active' ? 'Sim' : 'Não',
    'Data/Hora da Emissão': formatDateTime(a.triggeredAt),
    'Data/Hora da Resolução': a.resolvedAt ? formatDateTime(a.resolvedAt) : '-',
  }));
};

export const exportAlertsToXlsx = (data: Alert[], filename: string) => {
  const formattedData = formatAlertsData(data);
  const worksheet = xlsx.utils.json_to_sheet(formattedData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Alertas');
  xlsx.writeFile(workbook, `${filename}.xlsx`);
};

export const exportAlertsToCsv = (data: Alert[], filename: string) => {
  const formattedData = formatAlertsData(data);
  const worksheet = xlsx.utils.json_to_sheet(formattedData);
  const csvOutput = xlsx.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const exportAlertsToPdf = (data: Alert[], filename: string, title: string) => {
  const formattedData = formatAlertsData(data);
  if (formattedData.length === 0) return;

  const doc = new jsPDF('landscape');
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 28);

  const head = [Object.keys(formattedData[0])];
  const body = formattedData.map((row) => Object.values(row).map(String));

  autoTable(doc, {
    head,
    body,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [239, 68, 68] }, // Red for alerts
  });
  doc.save(`${filename}.pdf`);
};

/* ─── CHARTS (DASHBOARD) EXPORT ─── */
export const exportChartsDataToXlsx = (datasets: Record<string, any[]>, filename: string) => {
  const workbook = xlsx.utils.book_new();
  for (const [sheetName, data] of Object.entries(datasets)) {
    if (data.length > 0) {
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  }
  xlsx.writeFile(workbook, `${filename}.xlsx`);
};

export const exportChartsDataToCsv = (datasets: Record<string, any[]>, filename: string) => {
  // Consolidates all datasets in one CSV with empty rows between them
  let csvString = '';
  for (const [sheetName, data] of Object.entries(datasets)) {
    if (data.length > 0) {
      csvString += `--- ${sheetName} ---\n`;
      const worksheet = xlsx.utils.json_to_sheet(data);
      csvString += xlsx.utils.sheet_to_csv(worksheet);
      csvString += '\n\n';
    }
  }
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const exportChartsToPdf = async (
  containerId: string,
  filename: string,
  title: string
) => {
  const el = document.getElementById(containerId);
  if (!el) return;

  const doc = new jsPDF('portrait');
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 28);

  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const imgProps = doc.getImageProperties(imgData);
    
    // Scale to fit page width
    const pdfWidth = doc.internal.pageSize.getWidth() - 28;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    let currentY = 35;
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Support pagination if the chart is very tall
    let heightLeft = pdfHeight;
    let position = currentY;

    doc.addImage(imgData, 'PNG', 14, position, pdfWidth, pdfHeight);
    heightLeft -= (pageHeight - position);

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 14, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

  } catch (err) {
    console.error('Failed to capture charts', err);
  }

  doc.save(`${filename}.pdf`);
};
