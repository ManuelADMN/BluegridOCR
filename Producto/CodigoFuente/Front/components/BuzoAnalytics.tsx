import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authFetch } from '../services/apiClient';
import { BarChart3, Users, ClipboardCheck, Clock, Loader2, TrendingUp } from 'lucide-react';

type Props = {
  apiUrl: string;
  currentUser: User | null;
  isDarkMode: boolean;
  onNotify: (message: string, type?: 'success' | 'error') => void;
};

export default function BuzoAnalytics({ apiUrl, currentUser, onNotify }: Props) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${apiUrl}/api/v1/analytics/buzos`);
      if (!response.ok) throw new Error('Error al cargar analíticas');
      const json = await response.json();
      setData(json);
    } catch (error: any) {
      onNotify(error.message || 'Error al cargar analíticas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tighter text-black dark:text-white">
            Análisis de Desempeño
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Seguimiento de digitalizaciones y validaciones por buzo operador.
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </button>
      </div>

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
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Ranking de Digitalización</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-zinc-900">
                <th className="px-6 py-4">Buzo</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Validadas</th>
                <th className="px-6 py-4">Pendientes</th>
                <th className="px-6 py-4">Última Actividad</th>
                <th className="px-6 py-4 w-40">Progreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-900">
              {por_buzo.map((b: any) => (
                <tr key={b.id_buzo} className="text-sm hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-black dark:text-white">{b.nombre_buzo}</td>
                  <td className="px-6 py-4 font-mono">{b.total_plantillas}</td>
                  <td className="px-6 py-4 text-green-500 font-medium">{b.plantillas_validadas}</td>
                  <td className="px-6 py-4 text-amber-500 font-medium">{b.plantillas_pendientes}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {b.ultima_digitalizacion ? new Date(b.ultima_digitalizacion).toLocaleDateString() : 'N/A'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
