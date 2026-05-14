import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  ClipboardList,
  Eye,
  Droplets,
  FileText,
  Home,
  Loader2,
  MapPin,
  MessageSquareText,
  Minus,
  RefreshCw,
  Trash2,
  X,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Waves,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BackendKPI, DashboardResponse, ReportRecord, User } from '../types';
import { authFetch } from '../services/apiClient';
import { getApiBaseUrl } from '../services/runtimeConfig';
import { formatChileDate, formatChileDateTime, monthAgoChileISO, todayChileISO } from '../lib/time';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { DateRangePickerControl } from './ui/form-controls';

const CHART_COLORS = {
  blue: '#1478f2',
  blueSoft: '#9ec9ff',
  teal: '#12a6a6',
  tealSoft: '#b8dfdf',
  amber: '#f59e0b',
  rose: '#f43f5e',
  green: '#16a34a',
  gridLight: '#e9edf3',
  gridDark: '#2a2a2d',
};

const emptyDashboard: DashboardResponse = {
  kpis: [],
  barData: [],
  lineData: [],
  mapData: [],
};

const numberFormatter = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

const formatNumber = (value?: number | null, unit?: string) => {
  const safeValue = Number(value || 0);
  return unit === '%' ? `${percentFormatter.format(safeValue)}%` : numberFormatter.format(safeValue);
};

const trendLabel = (value?: number | null) => {
  if (value === null || value === undefined) return 's/d';
  const sign = value > 0 ? '+' : '';
  return `${sign}${percentFormatter.format(value)}%`;
};

const trendTone = (value?: number | null) => {
  if (value === null || value === undefined || value === 0) return 'text-gray-400';
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';
};

const statusLabel = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'VALIDADO') return 'VALIDADO';
  if (normalized.includes('PENDIENTE')) return 'PENDIENTE';
  return normalized || 'SIN ESTADO';
};

const TrendIcon = ({ value }: { value?: number | null }) => {
  if (value === null || value === undefined || value === 0) return <Minus className="h-3.5 w-3.5" />;
  return value > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />;
};

const iconForKPI = (id: string) => {
  switch (id) {
    case 'total_pulpos':
      return <Waves className="h-6 w-6" />;
    case 'ocupacion':
      return <Home className="h-6 w-6" />;
    case 'tasa_reproductiva':
      return <Droplets className="h-6 w-6" />;
    case 'registros_validados':
      return <ShieldCheck className="h-6 w-6" />;
    case 'eficiencia_validacion':
      return <ShieldCheck className="h-6 w-6" />;
    default:
      return <Activity className="h-6 w-6" />;
  }
};

const ringToneForKPI = (id: string) => {
  switch (id) {
    case 'total_pulpos':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300';
    case 'ocupacion':
      return 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300';
    case 'tasa_reproductiva':
      return 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300';
    case 'registros_validados':
    case 'eficiencia_validacion':
      return 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-zinc-900 dark:text-zinc-300';
  }
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 p-3 text-sm shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-[#18181b]/95">
      {label && <p className="mb-2 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6 text-xs">
            <span className="text-gray-500 dark:text-gray-400">{item.name}</span>
            <span className="font-bold text-black dark:text-white">
              {Number(item.value || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmptyChart = ({ label }: { label: string }) => (
  <div className="flex h-full min-h-[140px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs font-semibold text-gray-400 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-500">
    {label}
  </div>
);

type EditableDetalle = {
  fila_index: number;
  n_nidos: number;
  n_cuevas: number;
  hembra: number;
  pulpos: number;
};

const emptyDetalles = (): EditableDetalle[] =>
  Array.from({ length: 5 }, (_, index) => ({
    fila_index: index,
    n_nidos: 0,
    n_cuevas: 0,
    hembra: 0,
    pulpos: 0,
  }));

const normalizeDetalles = (detalles?: any[]): EditableDetalle[] => {
  const rows = emptyDetalles();
  (detalles || []).forEach(detalle => {
    const index = Number(detalle.fila_index);
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
    rows[index] = {
      fila_index: index,
      n_nidos: Number(detalle.n_nidos || 0),
      n_cuevas: Number(detalle.n_cuevas || 0),
      hembra: Number(detalle.hembra || 0),
      pulpos: Number(detalle.pulpos || 0),
    };
  });
  return rows;
};

const Panel = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <Card className={className} onClick={onClick}>
    {children}
  </Card>
);

const SectionHeader = ({
  icon,
  title,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
}) => (
  <div className="mb-3 flex items-center justify-between gap-3">
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
      {icon}
      {title}
    </h3>
    {meta && <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{meta}</span>}
  </div>
);

const KpiCard = ({
  icon,
  label,
  value,
  unit,
  trend,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number | null;
  unit?: string;
  trend?: number | null;
  tone: string;
  onClick?: () => void;
}) => (
  <Panel className={`p-3 ${onClick ? 'cursor-pointer transition-colors hover:border-blue-300 dark:hover:border-blue-500/50' : ''}`} onClick={onClick}>
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-gray-600 dark:text-gray-300">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-black dark:text-white">{formatNumber(value, unit)}</p>
        <p className="mt-1.5 truncate text-[11px] text-gray-400 dark:text-zinc-500">Periodo filtrado</p>
      </div>
    </div>
  </Panel>
);

export default function Dashboard({
  isDarkMode,
  currentUser,
  onNotify,
}: {
  isDarkMode?: boolean;
  currentUser?: User | null;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaDesde, setFechaDesde] = useState(monthAgoChileISO);
  const [fechaHasta, setFechaHasta] = useState(todayChileISO);
  const [selectedRecord, setSelectedRecord] = useState<ReportRecord | null>(null);
  const [recordDetail, setRecordDetail] = useState<any | null>(null);
  const [editableDetails, setEditableDetails] = useState<EditableDetalle[]>(emptyDetalles);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [recordListOpen, setRecordListOpen] = useState(false);
  const [actionIntent, setActionIntent] = useState<'validar' | 'rechazar' | 'eliminar' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deletedRecordIds, setDeletedRecordIds] = useState<Set<number>>(() => new Set());

  const isAdmin = currentUser?.role === 'admin';
  const canModerate = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const fetchDashboardData = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);
    const baseUrl = localStorage.getItem('bluegrid_api_url') || getApiBaseUrl();
    const enableMockData = import.meta.env.VITE_ENABLE_MOCK_DATA === 'true';

    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const params = new URLSearchParams();
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      const query = params.toString();
      const response = await authFetch(`${cleanUrl}/api/v1/dashboard/data${query ? `?${query}` : ''}`);

      if (!response.ok) {
        if (response.status === 403) throw new Error('No tienes permisos para ver el dashboard');
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      setData(await response.json());
    } catch (err: any) {
      if (enableMockData) setData(emptyDashboard);
      else setError(err.message || 'Error al cargar datos del dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(true), 30000);
    return () => clearInterval(interval);
  }, [fechaDesde, fechaHasta]);

  const getKpi = (id: string) => data?.kpis.find(kpi => kpi.id === id);

  const totalPulposKpi = getKpi('total_pulpos') || data?.kpis[0];
  const ocupacionKpi = getKpi('ocupacion') || data?.kpis[1];

  const dashboardKpis = useMemo(() => {
    const preferredOrder = ['total_pulpos', 'ocupacion', 'registros_validados', 'tasa_reproductiva', 'eficiencia_validacion'];
    const incoming = data?.kpis || [];
    const ordered = preferredOrder
      .map(id => incoming.find(kpi => kpi.id === id))
      .filter(Boolean) as BackendKPI[];
    const remaining = incoming.filter(kpi => !preferredOrder.includes(kpi.id));
    return [...ordered, ...remaining];
  }, [data?.kpis]);

  const horizontalBarData = useMemo(
    () =>
      (data?.mapData || [])
        .filter(zone => zone.total_captura > 0 || zone.total_cazas > 0)
        .sort((a, b) => b.total_captura - a.total_captura)
        .slice(0, 5)
        .map((zone, index) => ({
          rank: index + 1,
          name: zone.name,
          region: zone.region,
          capturas: zone.total_captura,
          registros: zone.total_cazas,
        })),
    [data?.mapData]
  );

  const validationRows = useMemo(
    () =>
      (data?.recentRecords || []).slice(0, 7).map(record => ({
        raw: record,
        sector: record.sector,
        buzo: record.usuario || record.buzo || 'Sin usuario',
        confidence: Math.round(Number(record.promedio_confianza || 0) * 100),
        status: statusLabel(record.estado_validacion),
        date: formatChileDate(record.fecha_carga),
      })),
    [data?.recentRecords]
  );

  const pendingRows = useMemo(
    () =>
      (data?.pendingRecords || []).slice(0, 5).map(record => ({
        raw: record,
        id: `BG_${record.id_registro}`,
        detail: `${record.sector} - ${record.usuario || record.buzo || 'Sin usuario'}`,
        confidence: Math.round(Number(record.promedio_confianza || 0) * 100),
      })),
    [data?.pendingRecords]
  );

  const chartGrid = isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.gridLight;
  const chartCursor = { fill: isDarkMode ? '#18181b' : '#f5f8fc', radius: 8 };

  const openRecord = async (record: ReportRecord) => {
    const recordId = Number(record.id_registro);
    if (deletedRecordIds.has(recordId)) {
      onNotify?.('El registro ya fue eliminado.', 'success');
      return;
    }
    setSelectedRecord(record);
    setRecordDetail(null);
    setEditableDetails(emptyDetalles());
    try {
      const baseUrl = localStorage.getItem('bluegrid_api_url') || getApiBaseUrl();
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const response = await authFetch(`${cleanUrl}/api/v1/registros/${record.id_registro}`);
      if (response.status === 404) {
        setDeletedRecordIds(current => new Set(current).add(recordId));
        setSelectedRecord(null);
        setActionIntent(null);
        setRecordDetail(null);
        onNotify?.('El registro ya no existe en la base de datos.', 'success');
        fetchDashboardData(true);
        return;
      }
      if (response.ok) {
        const detail = await response.json();
        setRecordDetail(detail);
        setEditableDetails(normalizeDetalles(detail.detalles));
      }
    } catch {
      setRecordDetail(null);
    }
  };

  const updateEditableDetail = (rowIndex: number, field: keyof Omit<EditableDetalle, 'fila_index'>, value: string) => {
    const numericValue = Math.max(0, Number.parseInt(value || '0', 10) || 0);
    setEditableDetails(current =>
      current.map(row =>
        row.fila_index === rowIndex
          ? { ...row, [field]: field === 'hembra' ? Math.min(numericValue, 2) : numericValue }
          : row
      )
    );
  };

  const runRecordAction = async (action: 'validar' | 'rechazar' | 'eliminar', reason?: string) => {
    if (!selectedRecord) return;
    if (isActionLoading) return;
    const recordId = Number(selectedRecord.id_registro);
    if (action === 'eliminar' && deletedRecordIds.has(recordId)) {
      setSelectedRecord(null);
      setActionIntent(null);
      setRejectReason('');
      onNotify?.('El registro ya fue eliminado.', 'success');
      return;
    }
    const baseUrl = (localStorage.getItem('bluegrid_api_url') || getApiBaseUrl()).replace(/\/+$/, '');
    let url = `${baseUrl}/api/v1/registros/${selectedRecord.id_registro}/validacion`;
    let options: RequestInit = { method: 'PATCH' };
    if (action === 'validar') {
      options = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalles: editableDetails,
          comentarios: `Validado por ${currentUser?.username || 'Dashboard'}`,
        }),
      };
    }
    if (action === 'rechazar') {
      const motivo = reason?.trim();
      if (!motivo) {
        onNotify?.('Ingresa una descripción para rechazar el reporte.', 'error');
        return;
      }
      url = `${baseUrl}/api/v1/registros/${selectedRecord.id_registro}/rechazo`;
      options = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }) };
    }
    if (action === 'eliminar') {
      url = `${baseUrl}/api/v1/registros/${selectedRecord.id_registro}`;
      options = { method: 'DELETE' };
    }
    setIsActionLoading(true);
    try {
      const response = await authFetch(url, options);
      if (!response.ok && !(action === 'eliminar' && response.status === 404)) {
        throw new Error(`Error ${response.status}`);
      }
      const actionLabel = action === 'validar' ? 'validado' : action === 'rechazar' ? 'rechazado' : 'eliminado';
      if (action === 'eliminar') {
        setDeletedRecordIds(current => new Set(current).add(recordId));
        setData(current => {
          if (!current) return current;
          return {
            ...current,
            recentRecords: (current.recentRecords || []).filter(record => Number(record.id_registro) !== recordId),
            pendingRecords: (current.pendingRecords || []).filter(record => Number(record.id_registro) !== recordId),
          };
        });
      }
      onNotify?.(
        action === 'eliminar' && response.status === 404
          ? 'El registro ya había sido eliminado.'
          : `Registro ${actionLabel} correctamente.`,
        'success'
      );
      setSelectedRecord(null);
      setRecordDetail(null);
      setActionIntent(null);
      setRejectReason('');
      fetchDashboardData(true);
    } catch (error: any) {
      onNotify?.(error.message || 'No se pudo actualizar el registro', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-500 shadow-sm dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando métricas
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-96 w-full flex-col items-center justify-center p-8 text-center text-gray-500">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
        <p className="mb-2 text-lg font-bold text-black dark:text-white">No se pudieron cargar los datos.</p>
        <p className="mb-6 max-w-md text-sm">{error}</p>
        <Button
          onClick={() => fetchDashboardData()}
          className="shadow-lg active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const context = data.context;
  const summary = data.summary;
  const totalCurrentPulpos = data.barData.reduce((total, day) => total + Number(day.value || 0), 0);
  const validatedPct = summary?.eficiencia_validacion_pct || 0;
  const validatedCount = summary?.registros_validados || 0;
  const pendingCount = summary?.registros_pendientes ?? Math.max((summary?.registros || 0) - (summary?.registros_validados || 0), 0);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f6f8fb] px-4 pb-5 pt-4 dark:bg-[#0a0a0a]">
      <div className="mx-auto flex max-w-[1480px] animate-in fade-in slide-in-from-bottom-3 duration-500 flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              Análisis de capturas
            </h2>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePickerControl
                className="w-44"
                buttonClassName="h-9 text-xs shadow-sm"
                startValue={fechaDesde}
                endValue={fechaHasta}
                onChange={(start, end) => {
                  setFechaDesde(start);
                  setFechaHasta(end);
                }}
              />
              <div className="inline-flex h-9 max-w-full items-center gap-2 rounded-none border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm dark:border-zinc-800 dark:bg-[#111113] dark:text-gray-300">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate">{context?.current_period.label || 'Periodo actual'}</span>
              </div>
            </div>

            {isAdmin && (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                Última actualización: {isRefreshing ? 'actualizando' : 'hace instantes'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDashboardData(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </Button>
            </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {dashboardKpis.map(kpi => (
            <KpiCard
              key={kpi.id}
              icon={iconForKPI(kpi.id)}
              label={kpi.label}
              value={kpi.value}
              unit={kpi.unit}
              trend={kpi.trend_pct}
              tone={ringToneForKPI(kpi.id)}
              onClick={kpi.id === 'registros_validados' ? () => setRecordListOpen(true) : undefined}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Panel className="p-3 xl:col-span-4">
            <SectionHeader
              icon={<Waves className="h-4 w-4 text-blue-600" />}
              title="Total Pulpos"
            />
            <div className="h-[195px]">
              {totalPulposKpi?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={totalPulposKpi.series} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                    <XAxis dataKey="name" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} />
                    <Tooltip content={<ChartTooltip />} cursor={false} />
                    <Line name="Periodo actual" type="monotone" dataKey="current" stroke={CHART_COLORS.blue} strokeWidth={2.6} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sin serie de pulpos" />
              )}
            </div>
          </Panel>

          <Panel className="p-3 xl:col-span-5">
            <SectionHeader
              icon={<Home className="h-4 w-4 text-teal-600" />}
              title="Nidos encontrados"
            />
            <div className="h-[195px]">
              {ocupacionKpi?.series?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ocupacionKpi.series} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                    <XAxis dataKey="name" interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} />
                    <Tooltip content={<ChartTooltip />} cursor={false} />
                    <Line name="Periodo actual" type="monotone" dataKey="current" stroke={CHART_COLORS.teal} strokeWidth={2.6} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sin serie de ocupación" />
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden xl:col-span-3">
            <div className="border-b border-gray-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-950 dark:text-white">Pendientes de validación</h3>
                <Badge tone="warning">{pendingCount}</Badge>
              </div>
              <div className="mt-3 flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <span>Plantilla OCR</span>
                <span>Confianza OCR</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-900">
              {pendingRows.map(row => (
                <button key={row.id} onClick={() => openRecord(row.raw)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-7 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-400 dark:border-zinc-800 dark:bg-zinc-950">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">{row.id}</p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{row.detail}</p>
                    </div>
                  </div>
                  <Badge tone="warning">
                    {row.confidence}%
                  </Badge>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Panel className="p-3 xl:col-span-4">
            <SectionHeader icon={<Calendar className="h-4 w-4 text-blue-600" />} title="Capturas por día" meta="Capturas" />
            <div className="h-[205px]">
              {data.barData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.barData} margin={{ top: 14, right: 6, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7b8493' }} />
                    <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                    <Bar name="Capturas" dataKey="value" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sin capturas en el periodo" />
              )}
            </div>
          </Panel>

          <Panel className="p-3 xl:col-span-3">
            <SectionHeader icon={<MapPin className="h-4 w-4 text-teal-600" />} title="Top Sectores" meta="Pulpos capturados" />
            <div className="h-[205px]">
              {horizontalBarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horizontalBarData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#606976' }} width={92} />
                    <Tooltip content={<ChartTooltip />} cursor={chartCursor} />
                    <Bar name="Pulpos capturados" dataKey="capturas" fill={CHART_COLORS.teal} radius={[2, 2, 2, 2]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Sin sectores con captura" />
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden xl:col-span-5">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_88px_108px_86px] gap-2 border-b border-gray-200 bg-white px-3 py-3 text-[11px] font-bold text-gray-700 dark:border-zinc-800 dark:bg-[#111113] dark:text-gray-300">
              <span className="truncate">Sector</span>
              <span className="truncate">Buzo</span>
              <span className="truncate">Confianza</span>
              <span className="truncate">Estado</span>
              <span className="truncate text-right">Fecha</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-900">
              {validationRows.length ? (
                validationRows.map((row, index) => (
                  <button key={`${row.sector}-${index}`} onClick={() => openRecord(row.raw)} className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_88px_108px_86px] items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                    <span className="truncate font-semibold text-gray-800 dark:text-gray-100">{row.sector}</span>
                    <span className="truncate text-gray-600 dark:text-gray-300">{row.buzo}</span>
                    <span className="min-w-0">
                      <Badge tone={row.confidence >= 84 ? 'success' : 'warning'} className="whitespace-nowrap">{row.confidence}%</Badge>
                    </span>
                    <span className="min-w-0">
                      <Badge tone={String(row.status).toUpperCase() === 'VALIDADO' ? 'success' : 'warning'} className="max-w-full truncate whitespace-nowrap">{row.status}</Badge>
                    </span>
                    <span className="truncate text-right text-gray-500 dark:text-gray-400">{row.date}</span>
                  </button>
                ))
              ) : (
                <div className="flex h-[205px] items-center justify-center text-xs font-semibold text-gray-400">
                  Sin registros validados para mostrar
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 text-center dark:border-zinc-900">
              <button className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                Ver todos los registros
              </button>
            </div>
          </Panel>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ClipboardList className="h-4 w-4" />
          Los indicadores se calculan con base en registros validados.
        </div>
      </div>
      {recordListOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-[#111113]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-black dark:text-white">Registros guardados</h3>
              <button onClick={() => setRecordListOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-900">
              {(data.recentRecords || []).map(record => (
                <button key={record.id_registro} onClick={() => { setRecordListOpen(false); openRecord(record); }} className="flex w-full justify-between py-2 text-left text-sm hover:text-blue-600">
                  <span>#{record.id_registro} {record.sector}</span>
                  <span>{statusLabel(record.estado_validacion)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {selectedRecord && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl border border-gray-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-[#111113]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-gray-400">Registro #{selectedRecord.id_registro}</p>
                <h3 className="text-lg font-bold text-black dark:text-white">{selectedRecord.sector}</h3>
                <p className="text-sm text-gray-500">{selectedRecord.usuario || selectedRecord.buzo || 'Sin usuario'} · {formatChileDateTime(selectedRecord.fecha_carga)}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="flex min-h-40 items-center justify-center border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-zinc-800">
                {selectedRecord.url_imagen_original && selectedRecord.url_imagen_original !== 'url_pendiente'
                  ? 'Imagen asociada disponible para futura integración.'
                  : 'Imagen no disponible por ahora. Se incorporará Blob Storage más adelante.'}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500"><th>Fila</th><th>Nidos</th><th>Cuevas</th><th>Hembra</th><th>Pulpos</th></tr></thead>
                  <tbody>
                    {editableDetails.map(d => (
                      <tr key={d.fila_index} className="border-t border-gray-100 dark:border-zinc-900">
                        <td className="py-2 pr-2 text-xs font-bold text-gray-500">Fila {d.fila_index + 1}</td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={d.n_nidos}
                            onChange={event => updateEditableDetail(d.fila_index, 'n_nidos', event.target.value)}
                            disabled={!canModerate}
                            className="h-9 w-20 border border-gray-200 bg-white px-2 text-sm font-semibold text-black outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={d.n_cuevas}
                            onChange={event => updateEditableDetail(d.fila_index, 'n_cuevas', event.target.value)}
                            disabled={!canModerate}
                            className="h-9 w-20 border border-gray-200 bg-white px-2 text-sm font-semibold text-black outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <select
                            value={d.hembra}
                            onChange={event => updateEditableDetail(d.fila_index, 'hembra', event.target.value)}
                            disabled={!canModerate}
                            className="h-9 w-28 border border-gray-200 bg-white px-2 text-sm font-semibold text-black outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white"
                          >
                            <option value={0}>Sin marca</option>
                            <option value={1}>Nido</option>
                            <option value={2}>Cueva</option>
                          </select>
                        </td>
                        <td className="py-1">
                          <input
                            type="number"
                            min={0}
                            value={d.pulpos}
                            onChange={event => updateEditableDetail(d.fila_index, 'pulpos', event.target.value)}
                            disabled={!canModerate}
                            className="h-9 w-20 border border-gray-200 bg-white px-2 text-sm font-semibold text-black outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {recordDetail?.rechazo_motivo && (
                  <div className="mt-3 border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                    Motivo de rechazo: {recordDetail.rechazo_motivo}
                  </div>
                )}
              </div>
            </div>
            {canModerate && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setActionIntent('rechazar')} disabled={isActionLoading}>
                  <MessageSquareText className="h-4 w-4" />
                  Rechazar
                </Button>
                <Button variant="danger" size="sm" onClick={() => setActionIntent('eliminar')} disabled={isActionLoading}><Trash2 className="h-4 w-4" />Eliminar</Button>
                <Button size="sm" onClick={() => setActionIntent('validar')} disabled={isActionLoading}><ShieldCheck className="h-4 w-4" />Validar</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {selectedRecord && actionIntent && (
        <div className="fixed inset-0 z-[3200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0b0b0c]">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    {actionIntent === 'validar' ? 'Confirmar validación' : actionIntent === 'rechazar' ? 'Motivo de rechazo' : 'Eliminar reporte'}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-black dark:text-white">
                    Registro #{selectedRecord.id_registro}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setActionIntent(null);
                    setRejectReason('');
                  }}
                  className="flex h-8 w-8 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              {actionIntent === 'rechazar' ? (
                <>
                  <p className="text-sm leading-6 text-gray-500 dark:text-zinc-400">
                    Deja una descripción clara para que el historial explique por qué este reporte no fue aceptado.
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={event => setRejectReason(event.target.value)}
                    rows={4}
                    className="w-full resize-none border border-gray-200 bg-white p-3 text-sm font-medium text-black outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-[#050505] dark:text-white dark:focus:border-blue-400"
                    placeholder="Ej: imagen borrosa, tabla incompleta o conteo inconsistente."
                  />
                </>
              ) : (
                <div className="border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
                  {actionIntent === 'validar'
                    ? 'El reporte pasará a estado validado y actualizará KPIs, historial y exportaciones.'
                    : 'Esta acción eliminará el reporte seleccionado. Úsala solo cuando el registro no deba quedar en trazabilidad.'}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionIntent(null);
                    setRejectReason('');
                  }}
                  disabled={isActionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant={actionIntent === 'eliminar' ? 'danger' : actionIntent === 'rechazar' ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => runRecordAction(actionIntent, rejectReason)}
                  disabled={isActionLoading || (actionIntent === 'rechazar' && !rejectReason.trim())}
                >
                  {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : actionIntent === 'validar' ? <ShieldCheck className="h-4 w-4" /> : actionIntent === 'eliminar' ? <Trash2 className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                  {actionIntent === 'validar' ? 'Validar' : actionIntent === 'rechazar' ? 'Rechazar' : 'Eliminar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
