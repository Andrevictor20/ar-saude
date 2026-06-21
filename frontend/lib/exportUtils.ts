import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Measurement } from './types';
import { formatDateTime } from './format';

const formatExportData = (data: Measurement[]) => {
  return data.map((m) => ({
    Bairro: m.neighborhoodName,
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

export const exportToPdf = (
  data: Measurement[],
  filename: string,
  title: string,
) => {
  const formattedData = formatExportData(data);
  if (formattedData.length === 0) return;

  const doc = new jsPDF('landscape');

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 28);

  const head = [Object.keys(formattedData[0])];
  const body = formattedData.map((row) => Object.values(row).map(String));

  autoTable(doc, {
    head: head,
    body: body,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [56, 189, 248] }, // var(--accent) aprox
  });

  doc.save(`${filename}.pdf`);
};
