


// Definitions based on the provided API Contract (Bluegrid_OCRv2)

export type UserRole = 'admin' | 'supervisor' | 'buzo';

export type Permission =
  | 'dashboard:view'
  | 'ocr:digitalize'
  | 'records:validate'
  | 'users:create'
  | 'settings:manage'
  | 'analytics:buzo_view'
  | 'admin:all';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'admin:all',
    'dashboard:view',
    'ocr:digitalize',
    'records:validate',
    'users:create',
    'settings:manage',
    'analytics:buzo_view',
  ],
  supervisor: [
    'dashboard:view',
    'ocr:digitalize',
    'analytics:buzo_view',
  ],
  buzo: [
    'ocr:digitalize',
  ],
};

export const hasRolePermission = (
  role: UserRole | undefined | null,
  permission: Permission
): boolean => {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('admin:all') || permissions.includes(permission);
};

export interface User {
  id: number; // DB Foreign Key: 1=Admin, 2=Buzo, 3=Supervisor. CRITICAL for integrity.
  username: string;
  name: string;
  role: UserRole;
}

export interface MatrixCell {
  fila: string | number;
  col: number;
  valor: string;
  confianza: number;
  ref_id?: string;
  recorte_base64?: string; // alias del campo recorte_b64 que devuelve el backend
  recorte_b64?: string;    // campo que devuelve el backend (motor_ia)
  valor_original?: string;
}

export interface IA_Result {
  status: string; // 'procesado_ia_tablilla' | 'simulacion' | 'error'
  promedio_confianza: number;
  tablilla_id?: string | null;
  tablilla_id_raw?: string | null;
  tablilla_detectada?: {
    tablilla_id_normalizado?: string | null;
    tablilla_encontrada: boolean;
    tablilla?: {
      id: number;
      codigo: string;
    } | null;
    embarcacion?: {
      id: number;
      nombre: string;
      matricula: string;
    } | null;
  };
  matriz: MatrixCell[];
}

export interface OCRResponse {
  id: number;
  id_registro?: number; // Backend Patch: Contains the real DB ID (e.g. 12). Priority over 'id' if 'id' is null.
  estado: string; // e.g., 'pendiente_validacion'
  zona_id: number;
  resultado_ia: IA_Result;
}

export interface ValidationRequest {
  cambios: MatrixCell[];
  comentarios?: string;
}

export type AppView = 'setup' | 'upload' | 'editor' | 'success';

export interface ZoneOption {
  id: string;
  name: string;
}

// Mock zones translated to Spanish
export const MOCK_ZONES: ZoneOption[] = [
  { id: '1', name: 'Zona Norte - Jaula 101' },
  { id: '2', name: 'Zona Sur - Jaula 205' },
  { id: '3', name: 'Laboratorio Central' },
  { id: '4', name: 'Área de Cuarentena' },
];

// --- DASHBOARD TYPES (REAL API) ---

export interface BackendKPI {
  id: string;
  label: string;
  value: number;
  unit: string;
  description?: string;
  current_period_value?: number;
  previous_period_value?: number;
  trend_pct?: number | null;
  series?: BackendSeriesData[];
}

export interface BackendChartData {
  name: string;
  value: number;
  date?: string;
  registros?: number;
}

export interface BackendSeriesData {
  name: string;
  current: number;
  previous: number;
  current_date: string;
  previous_date: string;
}

export interface BackendMapData {
  id: number;
  name: string;
  region: string;
  lat: number;
  lon: number;
  total_captura: number;
  total_cazas: number;
}

export interface DashboardResponse {
  context?: {
    latest_day: string;
    current_period: {
      start: string;
      end: string;
      label: string;
    };
    previous_period: {
      start: string;
      end: string;
      label: string;
    };
  };
  summary?: {
    nidos: number;
    cuevas_cubiertas: number;
    hembras_con_huevos: number;
    registros: number;
    registros_validados: number;
    registros_pendientes?: number;
    registros_rechazados?: number;
    sectores?: number;
    buzos?: number;
    promedio_confianza_ocr?: number;
    ocupacion_pct: number;
    tasa_reproductiva_pct: number;
    eficiencia_validacion_pct: number;
  };
  kpis: BackendKPI[];
  barData: BackendChartData[];
  lineData: BackendChartData[];
  mapData: BackendMapData[];
  recentRecords?: ReportRecord[];
  pendingRecords?: ReportRecord[];
}

export interface ReportRecord {
  id_registro: number;
  fecha_carga: string;
  estado_validacion: string;
  promedio_confianza: number;
  url_imagen_original?: string;
  sector: string;
  region: string;
  usuario_id?: number;
  tipo_usuario?: string;
  usuario?: string;
  buzo?: string;
  nidos?: number;
  cuevas_cubiertas?: number;
  hembras?: number;
  total_pulpos?: number;
}

// Helper for initial state to avoid null checks everywhere before load
export const INITIAL_DASHBOARD_STATE: DashboardResponse = {
  context: undefined,
  summary: undefined,
  kpis: [],
  barData: [],
  lineData: [],
  mapData: []
};
