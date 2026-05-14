import React, { useEffect, useState } from 'react';
import { Download, Eye, FileText, Loader2, RefreshCw } from 'lucide-react';
import { ReportRecord } from '../types';
import { authFetch } from '../services/apiClient';
import { formatChileDateTime, monthAgoChileISO, todayChileISO } from '../lib/time';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TBody, TD, TH, THead, TR } from './ui/table';
import { DateRangePickerControl, SelectControl } from './ui/form-controls';

type Props = {
  apiUrl: string;
  onNotify: (message: string, type?: 'success' | 'error') => void;
};

const statusTone = (status: string) => {
  const normalized = status?.toUpperCase();
  if (normalized === 'VALIDADO' || normalized === 'APROBADO') return 'success';
  if (normalized === 'RECHAZADO') return 'danger';
  if (normalized === 'PENDIENTE_VALIDACION') return 'warning';
  return 'muted';
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'PENDIENTE_VALIDACION', label: 'Pendiente de validación' },
  { value: 'VALIDADO', label: 'Validado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
];

const formatOptions = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
];

export default function HistoryReport({ apiUrl, onNotify }: Props) {
  const [items, setItems] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState(monthAgoChileISO);
  const [fechaHasta, setFechaHasta] = useState(todayChileISO);
  const [formato, setFormato] = useState<'csv' | 'xlsx'>('xlsx');

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (estado) params.set('estado', estado);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      params.set('limit', '150');

      const response = await authFetch(`${apiUrl}/api/v1/reports/history?${params.toString()}`);
      if (!response.ok) throw new Error(`Error al cargar historial (${response.status})`);

      const data = await response.json();
      setItems(data.items || []);
    } catch (error: any) {
      onNotify(error.message || 'Error al cargar historial', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [estado, fechaDesde, fechaHasta]);

  const buildExportParams = () => {
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (fechaDesde) params.set('fecha_desde', fechaDesde);
    if (fechaHasta) params.set('fecha_hasta', fechaHasta);
    params.set('formato', formato);
    return params;
  };

  const handleExport = async (download = true) => {
    try {
      const params = buildExportParams();

      const response = await authFetch(`${apiUrl}/api/v1/reports/export?${params.toString()}`);
      if (!response.ok) throw new Error(`Error al exportar datos (${response.status})`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (!download) {
        window.open(url, '_blank', 'noopener,noreferrer');
        onNotify(`Vista previa ${formato.toUpperCase()} generada`, 'success');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = `bluegridocr_registros.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onNotify(`Exportación ${formato.toUpperCase()} generada`, 'success');
    } catch (error: any) {
      onNotify(error.message || 'Error al exportar datos', 'error');
    }
  };

  const openDataPreview = () => {
    const headers = [
      'ID Registro',
      'ID Usuario',
      'Tipo Usuario',
      'Nombre Usuario',
      'Nidos con Huevos',
      'Cuevas Cubiertas',
      'Captura Hembras',
      'Total Pulpos',
      'Confianza OCR',
      'Estado',
      'Fecha de carga',
      'Centro',
      'Región',
    ];

    const rows = items.map(item => [
      item.id_registro,
      item.usuario_id || '',
      item.tipo_usuario || 'Sin rol',
      item.usuario || item.buzo || 'Sin usuario',
      item.nidos || 0,
      item.cuevas_cubiertas || 0,
      item.hembras || 0,
      item.total_pulpos || 0,
      `${Math.round(Number(item.promedio_confianza || 0) * 100)}%`,
      item.estado_validacion,
      formatChileDateTime(item.fecha_carga),
      item.sector,
      item.region,
    ]);

    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char] || char));

    const table = `
      <table>
        <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
    const params = buildExportParams().toString();
    const exportUrl = `${apiUrl}/api/v1/reports/export?${params}`;
    const token = localStorage.getItem('bluegridocr_token') || '';
    const win = window.open('', '_blank');
    if (!win) {
      onNotify('El navegador bloqueó la pestaña de previsualización', 'error');
      return;
    }

    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>BluegridOCR - Vista previa de exportación</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #f6f8fb; color: #111827; }
            header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; background: #fff; border-bottom: 1px solid #d1d5db; }
            h1 { margin: 0; font-size: 18px; }
            p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
            button { height: 38px; border: 0; background: #000; color: #fff; padding: 0 16px; font-weight: 700; cursor: pointer; }
            main { padding: 18px; }
            table { width: 100%; border-collapse: collapse; background: #fff; }
            th { border: 1px solid #111827; background: #e5e7eb; color: #111827; text-align: center; vertical-align: middle; padding: 10px; font-size: 12px; }
            td { border: 1px solid #d1d5db; text-align: center; vertical-align: middle; padding: 9px; font-size: 12px; }
            tr:nth-child(even) td { background: #f9fafb; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>BluegridOCR - Vista previa ${formato.toUpperCase()}</h1>
              <p>${items.length} filas | ${fechaDesde || 'inicio'} a ${fechaHasta || 'actual'} | ${estado || 'Todos los estados'}</p>
            </div>
            <button id="download">Descargar ${formato.toUpperCase()}</button>
          </header>
          <main>${table}</main>
          <script>
            document.getElementById('download').addEventListener('click', async () => {
              const response = await fetch(${JSON.stringify(exportUrl)}, { headers: { Authorization: 'Bearer ${token}' } });
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'bluegridocr_registros.${formato}';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            });
          </script>
        </body>
      </html>`);
    win.document.close();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8fb] px-5 pb-8 pt-5 dark:bg-[#0a0a0a]">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
              <FileText className="h-6 w-6" />
              Historial de registros
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Registros OCR, sectores, estados y captura consolidada desde la base de datos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DateRangePickerControl
              className="w-44"
              startValue={fechaDesde}
              endValue={fechaHasta}
              onChange={(start, end) => {
                setFechaDesde(start);
                setFechaHasta(end);
              }}
            />
            <SelectControl className="w-52" value={estado} onChange={setEstado} options={statusOptions} />
            <SelectControl className="w-28" value={formato} onChange={value => setFormato(value as 'csv' | 'xlsx')} options={formatOptions} />
            <Button variant="outline" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={openDataPreview}>
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button size="sm" onClick={() => handleExport(true)}>
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <span className="text-sm font-bold text-gray-950 dark:text-white">Registros</span>
            <Badge tone="muted">{items.length} filas</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-72 items-center justify-center text-sm font-semibold text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando historial
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>ID</TH>
                      <TH>ID Usuario</TH>
                      <TH>Tipo</TH>
                      <TH>Fecha</TH>
                      <TH>Sector</TH>
                      <TH>Usuario</TH>
                      <TH>Estado</TH>
                      <TH>Confianza</TH>
                      <TH>Nidos</TH>
                      <TH>Cuevas</TH>
                      <TH>Pulpos</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.length ? (
                      items.map(item => (
                        <TR key={item.id_registro}>
                          <TD className="font-mono text-xs">#{item.id_registro}</TD>
                          <TD>{item.usuario_id || '-'}</TD>
                          <TD>{item.tipo_usuario || 'Sin rol'}</TD>
                          <TD>{formatChileDateTime(item.fecha_carga)}</TD>
                          <TD>
                            <div className="font-semibold text-gray-900 dark:text-white">{item.sector}</div>
                            <div className="text-xs text-gray-400">{item.region}</div>
                          </TD>
                          <TD>{item.usuario || item.buzo || 'Sin usuario'}</TD>
                          <TD>
                            <Badge tone={statusTone(item.estado_validacion) as any}>{item.estado_validacion}</Badge>
                          </TD>
                          <TD>{Math.round(Number(item.promedio_confianza || 0) * 100)}%</TD>
                          <TD>{item.nidos || 0}</TD>
                          <TD>{item.cuevas_cubiertas || 0}</TD>
                          <TD>{item.total_pulpos || 0}</TD>
                        </TR>
                      ))
                    ) : (
                      <TR>
                        <TD colSpan={11} className="h-40 text-center text-gray-400">
                          Sin registros para los filtros seleccionados.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
