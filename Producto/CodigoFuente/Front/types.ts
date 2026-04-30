


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
  fila: string | number; // Backend now sends "Fila 1", but we support number for legacy/internal use
  col: number;
  valor: string;
  confianza: number;
  // New fields for Human-in-the-Loop training
  ref_id?: string;     // Unique ID from backend (e.g., "R0_C1") to map specific cropped files
  recorte_base64?: string; // Legacy: Base64 image crop
  valor_original?: string; // To store the initial prediction if needed explicitly
}

export interface IA_Result {
  status: string; // 'procesado_ia_tablilla' | 'simulacion' | 'error'
  promedio_confianza: number;
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
}

export interface BackendChartData {
  name: string;
  value: number;
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
  kpis: BackendKPI[];
  barData: BackendChartData[];
  lineData: BackendChartData[];
  mapData: BackendMapData[];
}

// Helper for initial state to avoid null checks everywhere before load
export const INITIAL_DASHBOARD_STATE: DashboardResponse = {
  kpis: [],
  barData: [],
  lineData: [],
  mapData: []
};
