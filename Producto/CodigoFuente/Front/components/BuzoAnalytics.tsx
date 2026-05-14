import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authFetch } from '../services/apiClient';
import { formatChileDate } from '../lib/time';
import { BarChart3, Users, ClipboardCheck, Clock, Loader2, TrendingUp, Filter, X } from 'lucide-react';
import { DatePickerControl, SelectControl } from './ui/form-controls';

type Props = {
  apiUrl: string;
  currentUser: User | null;
  isDarkMode: boolean;
  onNotify: (message: string, type?: 'success' | 'error') => void;
};

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE_VALIDACION', label: 'Pendiente de validación' },
  { value: 'VALIDADO', label: 'Validado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'BORRADOR', label: 'Borrador' },
];

export default function BuzoAnalytics({ apiUrl, currentUser, onNotify }: Props) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [buzosList, setBuzosList] = useState<any[]>([]);

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [buzoId, setBuzoId] = useState('');
  const [estadoValidacion, setEstadoValidacion] = useState('');

  const buildUrl = (fd: string, fh: string, bid: string, ev: string) => {
    const params = new URLSearchParams();
    if (fd) params.set('fecha_desde', fd);
    if (fh) params.set('fecha_hasta', fh);
    if (bid) params.set('buzo_id', bid);
    if (ev) params.set('estado_validacion', ev);
    const qs = params.toString();
    return `${apiUrl}/api/v1/analytics/buzos${qs ? `?${qs}` : ''}`;
  };

  const fetchData = async (fd: string, fh: string, bid: string, ev: string) => {
    setIsLoading(true);
    try {
      const response = await authFetch(buildUrl(fd, fh, bid, ev));
      if (!response.ok) throw new Error('Error al cargar analíticas');
      const json = await response.json();
      setData(json);
      if (!bid && json.por_buzo?.length) {
        setBuzosList(json.por_buzo);
      }
    } catch (error: any) {
      onNotify(error.message || 'Error al cargar analíticas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData('', '', '', '');
  }, []);

  const handleApply = () => fetchData(fechaDesde, fechaHasta, buzoId, estadoValidacion);

  const handleClear = () => {
    setFechaDesde('');
    setFechaHasta('');
    setBuzoId('');
    setEstadoValidacion('');
    fetchData('', '', '', '');
  };

  const hasFilters = !!(fechaDesde || fechaHasta || buzoId || estadoValidacion);

  if (isLoading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) return null;

  const { resumen, por_buzo } = data;

  return (
    <div className="animate-in fade-in duration-500 p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-black dark:text-white">
            Análisis de desempeño
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Seguimiento de digitalizaciones y validaciones por buzo operador.
          </p>
        </div>
        <button
          onClick={() => fetchData(fechaDesde, fechaHasta, buzoId, estadoValidacion)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Desde</label>
            <DatePickerControl
              value={fechaDesde}
              onChange={setFechaDesde}
              buttonClassName="h-10 bg-gray-50 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Hasta</label>
            <DatePickerControl
              value={fechaHasta}
              onChange={setFechaHasta}
              buttonClassName="h-10 bg-gray-50 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Buzo</label>
            <SelectControl
              value={buzoId}
              onChange={setBuzoId}
              options={[
                { value: '', label: 'Todos' },
                ...buzosList.map((b: any) => ({ value: String(b.id_buzo), label: b.nombre_buzo })),
              ]}
              buttonClassName="h-10 bg-gray-50 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Estado</label>
            <SelectControl
              value={estadoValidacion}
              onChange={setEstadoValidacion}
              options={ESTADOS}
              buttonClassName="h-10 bg-gray-50 dark:bg-zinc-900"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Aplicar
          </button>
          {hasFilters && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Contenido filtrado */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="Total Plantillas"
              value={resumen.total_plantillas}
            />
            <KPICard
              icon={<Users className="w-4 h-4" />}
              label="Buzos Activos"
              value={resumen.total_buzos}
            />
            <KPICard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Validadas"
              value={resumen.plantillas_validadas}
              sub={`${Math.round((resumen.plantillas_validadas / resumen.total_plantillas) * 100) || 0}%`}
            />
            <KPICard
              icon={<Clock className="w-4 h-4" />}
              label="Promedio / Buzo"
              value={resumen.promedio_plantillas_por_buzo.toFixed(1)}
            />
          </div>

          {/* Tabla por Buzo */}
          <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-900">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Ranking de digitalización</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-zinc-900">
                    <th className="px-6 py-4">Buzo</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Validadas</th>
                    <th className="px-6 py-4">Pendientes</th>
                    <th className="px-6 py-4">Última actividad</th>
                    <th className="px-6 py-4 w-40">Progreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-900">
                  {por_buzo.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">
                        Sin resultados para los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    por_buzo.map((b: any) => (
                      <tr key={b.id_buzo} className="text-sm hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-black dark:text-white">{b.nombre_buzo}</td>
                        <td className="px-6 py-4 font-mono">{b.total_plantillas}</td>
                        <td className="px-6 py-4 text-green-500 font-medium">{b.plantillas_validadas}</td>
                        <td className="px-6 py-4 text-amber-500 font-medium">{b.plantillas_pendientes}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {b.ultima_digitalizacion ? formatChileDate(b.ultima_digitalizacion) : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black dark:bg-white"
                              style={{ width: `${(b.total_plantillas / resumen.total_plantillas) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, sub }: any) {
  return (
    <div className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm space-y-4">
      <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-zinc-900 flex items-center justify-center text-black dark:text-white">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-2xl font-semibold text-black dark:text-white">{value}</p>
          {sub && <span className="text-[10px] font-bold text-green-500">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
