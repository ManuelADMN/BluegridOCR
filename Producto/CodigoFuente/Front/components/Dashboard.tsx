import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Droplets, Home, Activity, Anchor, X, FileText, Calendar, Loader2, ChevronDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DashboardResponse, BackendMapData } from '../types';
import { authFetch } from '../services/apiClient';

const Dashboard = ({ isDarkMode }: { isDarkMode?: boolean }) => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(!data);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch Real Data from Backend
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    setError(null);
    const baseUrl = localStorage.getItem('bluegrid_api_url') || (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';
    
    const mockData: DashboardResponse = {
      kpis: [
        { id: 'kpi1', label: 'Total Pulpos', value: 1085, unit: '' },
        { id: 'kpi2', label: '% Ocupacion', value: 73.7, unit: '%' },
        { id: 'kpi3', label: 'Tasa Reprod.', value: 0, unit: '%' },
        { id: 'kpi4', label: 'Resumen de Nidos', value: 19.6, unit: '%' }
      ],
      barData: [
        { name: 'Mon', value: 120 },
        { name: 'Tue', value: 150 },
        { name: 'Wed', value: 180 },
        { name: 'Thu', value: 140 },
        { name: 'Fri', value: 200 },
        { name: 'Sat', value: 250 },
        { name: 'Sun', value: 220 }
      ],
      lineData: [],
      mapData: [
        { id: 1, name: 'Fiordo Aysén', region: 'Aysén', lat: 0, lon: 0, total_captura: 450, total_cazas: 0 },
        { id: 2, name: 'Puerto Cisnes', region: 'Aysén', lat: 0, lon: 0, total_captura: 320, total_cazas: 0 },
        { id: 3, name: 'Bahía Coliumo', region: 'Biobío', lat: 0, lon: 0, total_captura: 280, total_cazas: 0 },
        { id: 4, name: 'Punta Lavapié', region: 'Biobío', lat: 0, lon: 0, total_captura: 190, total_cazas: 0 },
        { id: 5, name: 'Bahía de Concepción', region: 'Biobío', lat: 0, lon: 0, total_captura: 80, total_cazas: 0 }
      ]
    };

    const ENABLE_MOCK_DATA = (import.meta as any).env?.VITE_ENABLE_MOCK_DATA === 'true';

    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const response = await authFetch(`${cleanUrl}/api/v1/dashboard/data`);

      if (!response.ok) {
        if (response.status === 403) throw new Error('No tienes permisos para ver el dashboard');
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result: DashboardResponse = await response.json();
      setData(result);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      if (ENABLE_MOCK_DATA) {
        console.warn("Usando datos de prueba debido a error de conexión.");
        setData(mockData);
      } else {
        setError(err.message || 'Error al cargar datos del dashboard');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds in background (coroutines-like behavior)
    const interval = setInterval(() => fetchDashboardData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const getIconForKPI = (id: string) => {
    switch (id) {
      case 'kpi1': return <Anchor className="w-5 h-5" />;   // Captura Total
      case 'kpi2': return <Home className="w-5 h-5" />;     // Ocupación
      case 'kpi3': return <Droplets className="w-5 h-5" />; // Tasa Reproductiva
      case 'kpi4': return <Activity className="w-5 h-5" />; // Eficiencia
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getTrendIcon = (id: string, trendStr: string) => {
    const isPositive = trendStr.startsWith('+');
    const isNegative = trendStr.startsWith('-');
    if (isPositive) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (isNegative) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = (trendStr: string) => {
    if (trendStr.startsWith('+')) return 'text-green-500';
    if (trendStr.startsWith('-')) return 'text-red-500';
    return 'text-gray-400';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-zinc-800 p-3 rounded-xl shadow-lg text-sm">
          {label && <p className="font-bold text-gray-500 dark:text-gray-400 mb-1 text-[10px] uppercase tracking-widest">{label}</p>}
          <p className="font-mono font-bold text-black dark:text-white text-lg">
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading && !data) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="mb-2 font-bold text-lg text-black dark:text-white">No se pudieron cargar los datos.</p>
        <p className="text-sm mb-6 max-w-md">{error}</p>
        <button 
          onClick={() => fetchDashboardData()}
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Prepare horizontal bar data from mapData
  const horizontalBarData = data.mapData.map(p => ({
    name: p.name,
    capturas: p.total_captura,
    cazas: p.total_cazas
  })).sort((a, b) => b.capturas - a.capturas).slice(0, 5); // Top 5

  return (
    <div className="animate-in fade-in zoom-in duration-300 w-full h-full flex flex-col gap-4 pb-20 md:pb-0 max-w-6xl mx-auto pt-2 px-4 md:px-8">
      
      {/* Header / Title Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tighter text-black dark:text-white">Análisis de Capturas</h2>
          {isRefreshing && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Esta Semana</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">hasta</span>
          <button className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <span>Semana Pasada</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Container - 3x2 Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* TOP ROW: 3 KPI Cards with Sparklines */}
        {data.kpis.slice(0, 3).map((kpi, index) => {
          // Mock trend for visual effect since backend doesn't provide it yet
          const mockTrends = ['-10%', '+5%', '-3%'];
          const trendStr = mockTrends[index] || '+0%';
          
          // Generate a mock sparkline based on the KPI value for visual effect
          const baseVal = kpi.value || 100;
          const sparkData = Array.from({length: 7}, (_, i) => ({
            day: i,
            current: baseVal * (0.8 + Math.random() * 0.4),
            previous: baseVal * (0.6 + Math.random() * 0.5)
          }));

          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

          return (
            <div key={kpi.id} className="bg-white dark:bg-[#121212] rounded-none p-4 flex flex-col min-h-[240px] border border-gray-100 dark:border-zinc-900 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {getIconForKPI(kpi.id)}
                  {kpi.label}
                </div>
              </div>
              
              <div className="flex justify-between items-end mb-1.5 gap-2">
                <div className="text-2xl font-bold tracking-tight text-black dark:text-white overflow-x-auto whitespace-nowrap scrollbar-hide min-w-0">
                  {kpi.value.toLocaleString()}{kpi.id === 'kpi3' ? '%' : ''}
                </div>
                <div className={`flex items-center gap-1 text-sm font-bold shrink-0 ${getTrendColor(trendStr)}`}>
                  {trendStr.startsWith('+') ? '↑' : '↓'} {trendStr.replace(/[+-]/, '')}
                </div>
              </div>

              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-4 border-b border-dotted border-gray-300 dark:border-zinc-700 pb-0.5 inline-block max-w-full truncate">
                {kpi.label} Over Time
              </div>

              <div className="flex-1 w-full min-h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#27272a" : "#f3f4f6"} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fill: '#9ca3af'}} 
                      tickFormatter={(val) => days[val]}
                      dy={8} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fill: '#9ca3af'}} 
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Line 
                      type="monotone" 
                      dataKey="current" 
                      stroke="#6366f1" // Indigo
                      strokeWidth={2} 
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="previous" 
                      stroke="#a5b4fc" // Light Indigo
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-center items-center gap-3 mt-3 text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-0.5 bg-indigo-500 rounded-full"></div>
                  <span>14 - 21 Sep 2023</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-0.5 bg-indigo-300 rounded-full border-t border-dashed border-indigo-300 bg-transparent"></div>
                  <span>6 - 13 Sep 2023</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* BOTTOM ROW */}
        
        {/* Card 4: Stats List (Resumen de Nidos) */}
        <div className="bg-white dark:bg-[#121212] rounded-none p-4 flex flex-col min-h-[240px] border border-gray-100 dark:border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              Resumen de Nidos
            </h4>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-end border-b border-gray-100 dark:border-zinc-800 pb-4 shrink-0">
              <div>
                <p className="text-2xl font-bold tracking-tight text-black dark:text-white">{data.kpis[3]?.value || 94.2}%</p>
              </div>
            </div>

            <div className="space-y-3 pt-1 overflow-y-auto flex-1 pr-1 scrollbar-hide">
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-black dark:text-white block truncate">Nidos Encontrados</span>
                  <span className="text-[10px] text-gray-500 block truncate">2341 nidos</span>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[11px] font-bold text-black dark:text-white">87.2%</span>
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-black dark:text-white block truncate">Cuevas Cubiertas</span>
                  <span className="text-[10px] text-gray-500 block truncate">1253 cuevas</span>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[11px] font-bold text-black dark:text-white">47.8%</span>
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-black dark:text-white block truncate">Hembras c/ Huevos</span>
                  <span className="text-[10px] text-gray-500 block truncate">208 hembras</span>
                </div>
                <div className="flex items-center shrink-0">
                  <span className="text-[11px] font-bold text-black dark:text-white">23.9%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Bar Chart (Capturas por Día) */}
        <div className="bg-white dark:bg-[#121212] rounded-none p-4 flex flex-col min-h-[240px] border border-gray-100 dark:border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Capturas por Día
            </h4>
          </div>
          
          <div className="mb-4">
            <div className="text-2xl font-bold tracking-tight text-black dark:text-white mb-0.5">1234</div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Capturas per 6 hour</div>
          </div>

          <div className="w-full flex-1 min-h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 9, fontWeight: 600, fill: '#9ca3af'}} 
                  dy={8} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: isDarkMode ? '#18181b' : '#f9fafb', radius: 8}} />
                <Bar 
                  dataKey="value" 
                  fill="#22c55e" // Green bars
                  radius={[2, 2, 0, 0]} 
                  barSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 6: Horizontal Bar Chart (Distribución por Zona) */}
        <div className="bg-white dark:bg-[#121212] rounded-none p-4 flex flex-col min-h-[240px] border border-gray-100 dark:border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5" />
              Top Zonas de Captura
            </h4>
          </div>

          <div className="w-full flex-1 min-h-0 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={horizontalBarData} 
                layout="vertical" 
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 9, fontWeight: 600, fill: '#9ca3af'}} 
                  width={64}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: isDarkMode ? '#18181b' : '#f9fafb', radius: 8}} />
                <Bar 
                  dataKey="capturas" 
                  fill="#8b5cf6" // Purple accent
                  radius={[2, 2, 2, 2]} 
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
