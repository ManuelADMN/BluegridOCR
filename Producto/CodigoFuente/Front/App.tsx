import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Upload, FileImage, AlertCircle, CheckCircle2,
  Grid2X2, ScanLine, ShieldCheck,
  Loader2, Moon, Sun, LogOut, Camera, Plus, X, Sparkles, Activity, FileClock,
  RotateCw, Info, ChevronDown, Ship, Table2, Users
} from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import MatrixEditor from './components/MatrixEditor';
import Dashboard from './components/Dashboard';
import NotificationToast, { NotificationTone } from './components/NotificationToast';
import { BluegridLogo } from './components/BluegridLogo';
import AdminUsersPanel from './components/AdminUsersPanel';
import BuzoAnalytics from './components/BuzoAnalytics';
import HistoryReport from './components/HistoryReport';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader } from './components/ui/card';
import { SelectControl } from './components/ui/form-controls';
import { authFetch } from './services/apiClient';
import { getApiBaseUrl } from './services/runtimeConfig';
import { bgoLog } from './services/logger';
import { 
  OCRResponse, MOCK_ZONES, AppView, User, UserRole, MatrixCell, ZoneOption,
  Permission, hasRolePermission 
} from './types';

const STORAGE_KEY_URL   = 'bluegrid_api_url';
const STORAGE_KEY_THEME = 'bluegrid_theme';
const DEFAULT_API_URL   = getApiBaseUrl();

// ── Partículas de fondo para el login ────────────────────────────────────────
const ParticleNetwork = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = canvas.width  = canvas.parentElement?.offsetWidth  || window.innerWidth;
    let H = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    const pts: P[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5,
      r: Math.random() * 2 + 1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(161,161,170,.5)';
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255,255,255,${.15 * (1 - d / 140)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => {
      W = canvas.width  = canvas.parentElement?.offsetWidth  || window.innerWidth;
      H = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-transparent" />;
};

// ── Indicador de procesamiento con Denoise ────────────────────────────────────
const DenoiseProcessingOverlay = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 max-w-xs w-full mx-4 border border-gray-200 dark:border-zinc-700">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-black via-gray-800 to-gray-600 dark:from-white dark:via-gray-200 dark:to-gray-400 flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-white dark:text-black" />
        </div>
        <div className="absolute inset-0 rounded-full bg-black/20 dark:bg-white/20 animate-ping" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-black text-black dark:text-white">Analizando con DENOISE</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Leyendo la tablilla digitalizada...</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-black dark:bg-white"
            style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  </div>
);

// ── App principal ─────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError,    setLoginError]    = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // App
  const [apiUrl,          setApiUrl]          = useState<string>(DEFAULT_API_URL);
  const [isInitializing,  setIsInitializing]  = useState(true);
  const [isDarkMode,      setIsDarkMode]      = useState(false);
  const [currentModule,   setCurrentModule]   = useState<'ocr' | 'dashboard' | 'users' | 'buzoAnalytics' | 'history'>('dashboard');
  const [adminSection,    setAdminSection]    = useState<'users' | 'boats' | 'tables'>('users');
  const [isUsersNavOpen,  setIsUsersNavOpen]  = useState(false);
  const [view,            setView]            = useState<AppView>('upload');
  const [isSettingsOpen,  setIsSettingsOpen]  = useState(false);

  // Upload
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [rotationDeg,    setRotationDeg]    = useState<number>(0);
  const [selectedZone,   setSelectedZone]   = useState<string>('');
  const [zones,          setZones]          = useState<ZoneOption[]>([]);
  const [zonesError,     setZonesError]     = useState<string | null>(null);
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);

  // Datos OCR
  const [ocrData,    setOcrData]    = useState<OCRResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Notificaciones
  const [notification, setNotification] = useState<{ message: string; type: NotificationTone; title?: string } | null>(null);
  const showNotification = (message: string, type: NotificationTone = 'success', title?: string) =>
    setNotification({ message, type, title });

  const loadZones = async (baseUrl = apiUrl) => {
    try {
      setZonesError(null);
      const response = await authFetch(`${baseUrl}/api/v1/context/zonas`);

      if (!response.ok) {
        throw new Error(`Error al cargar zonas (${response.status})`);
      }

      const apiZones: ZoneOption[] = await response.json();
      const normalizedZones = apiZones.map(zone => ({
        ...zone,
        id: zone.id.toString(),
      }));
      setZones(normalizedZones);
      setSelectedZone(current => current || normalizedZones[0]?.id || '');

      if (normalizedZones.length === 0) {
        setZonesError('No hay sectores registrados en la base de datos.');
      }
    } catch (error: any) {
      setZones([]);
      setSelectedZone('');
      setZonesError(error.message || 'No se pudieron cargar los sectores.');
    }
  };

  // ── Init tema ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    const dark  = saved === 'dark'; // Default to light mode
    setIsDarkMode(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem(STORAGE_KEY_THEME, next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  // ── Init conexión ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsInitializing(true);

      // Forzar siempre la URL del código, limpiar cualquier URL vieja en localStorage
      const clean = DEFAULT_API_URL.replace(/\/+$/, '');
      localStorage.setItem(STORAGE_KEY_URL, clean);
      setApiUrl(clean);

      try {
        const r = await fetch(`${clean}/`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (r.ok) {
          console.log('[Init] Conexión exitosa a:', clean);
        } else {
          console.warn('[Init] Servidor respondió con error:', r.status);
        }
      } catch (e) {
        console.warn('[Init] Falló la conexión automática:', e);
      } finally {
        setTimeout(() => setIsInitializing(false), 600);
      }
    })();
  }, []);

  // ── Control de Acceso ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    
    const canViewDashboard = hasRolePermission(user.role, 'dashboard:view');
    const canManageUsers   = hasRolePermission(user.role, 'users:create');
    const canDigitalize    = hasRolePermission(user.role, 'ocr:digitalize');
    const canViewBuzoAnalytics = hasRolePermission(user.role, 'analytics:buzo_view');

    if (currentModule === 'dashboard' && !canViewDashboard) {
      setCurrentModule(canDigitalize ? 'ocr' : 'dashboard'); // Fallback if no permissions
    }
    if (currentModule === 'users' && !canManageUsers) {
      setCurrentModule(canViewDashboard ? 'dashboard' : 'ocr');
    }
    if (currentModule === 'buzoAnalytics' && !canViewBuzoAnalytics) {
      setCurrentModule(canViewDashboard ? 'dashboard' : 'ocr');
    }
    if (currentModule === 'history' && !canViewDashboard) {
      setCurrentModule(canDigitalize ? 'ocr' : 'dashboard');
    }
  }, [currentModule, user]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (passwordInput.trim().length < 6) {
      setLoginError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    bgoLog.step('LOGIN', `Intentando login para: ${usernameInput}  apiUrl=${apiUrl}`);
    setIsUploading(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      if (!response.ok) {
        const errData = await response.json();
        bgoLog.error('LOGIN', `Falló: ${response.status} → ${errData.detail}`);
        throw new Error(errData.detail || 'Credenciales inválidas');
      }

      const data = await response.json();
      localStorage.setItem('bluegridocr_token', data.access_token);

      bgoLog.info('LOGIN', `OK  usuario=${data.username}  rol=${data.role}  id=${data.id}`);

      await loadZones(apiUrl);

      setUser({
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role as UserRole
      });

      if (data.role === 'buzo') {
        setCurrentModule('ocr');
      } else {
        setCurrentModule('dashboard');
      }

      showNotification(`Bienvenido, ${data.name}`, 'success');

    } catch (err: any) {
      bgoLog.error('LOGIN', `Excepción: ${err.message}`);
      setLoginError(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => { 
    localStorage.removeItem('bluegridocr_token');
    setUser(null); 
    setUsernameInput(''); 
    setPasswordInput(''); 
    setZones([]);
    setSelectedZone('');
    resetFlow(); 
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const handleSaveUrl = (url: string) => {
    setApiUrl(url);
    localStorage.setItem(STORAGE_KEY_URL, url);
    setIsSettingsOpen(false);
    setView('upload');
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      bgoLog.step('UPLOAD', `Archivo seleccionado: ${file.name}  tipo=${file.type}  tamaño=${Math.round(file.size/1024)}KB`);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
      setSelectedFile(file);
      setRotationDeg(0);
      setUploadError(null);
      setCurrentModule('ocr');
      setView('upload');
      setIsMobileMenuOpen(false);
      showNotification(`${file.name} quedo lista para previsualizar y enviar al motor OCR.`, 'info', 'Imagen cargada');
    }
  };

  // previewUrl se revoca explícitamente en resetFlow y handleFileSelect

  // ── Compresión de imagen ──────────────────────────────────────────────────
  const compressImage = (file: File, rotation: number = 0): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const MAX_PX  = 1600;
        const QUALITY = 0.85;
        const swapped = rotation === 90 || rotation === 270;

        // Escalar sobre las dimensiones originales
        let drawW = img.width;
        let drawH = img.height;
        if (drawW > MAX_PX || drawH > MAX_PX) {
          const scale = Math.min(MAX_PX / drawW, MAX_PX / drawH);
          drawW = Math.round(drawW * scale);
          drawH = Math.round(drawH * scale);
        }

        // El canvas tiene las dimensiones ya rotadas
        const canvas = document.createElement('canvas');
        canvas.width  = swapped ? drawH : drawW;
        canvas.height = swapped ? drawW : drawH;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas no disponible')); return; }

        ctx.save();
        if (rotation === 90) {
          ctx.translate(canvas.width, 0);
          ctx.rotate(Math.PI / 2);
        } else if (rotation === 180) {
          ctx.translate(canvas.width, canvas.height);
          ctx.rotate(Math.PI);
        } else if (rotation === 270) {
          ctx.translate(0, canvas.height);
          ctx.rotate(-Math.PI / 2);
        }
        ctx.drawImage(img, 0, 0, drawW, drawH);
        ctx.restore();

        canvas.toBlob(
          blob => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir imagen'));
          },
          'image/jpeg',
          QUALITY
        );
      };

      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al leer imagen')); };
      img.src = url;
    });
  };

  // ── Upload → Claude Vision ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) { setUploadError('Selecciona una imagen primero.'); return; }
    if (!selectedZone) { setUploadError('Selecciona un centro de cultivo válido.'); return; }
    setIsUploading(true);
    setUploadError(null);

    try {
      const originalKB   = Math.round(selectedFile.size / 1024);
      bgoLog.step('UPLOAD', `Comprimiendo imagen... tamaño_original=${originalKB}KB  rotación=${rotationDeg}°  zona_id=${selectedZone}`);
      const compressed   = await compressImage(selectedFile, rotationDeg);
      const compressedKB = Math.round(compressed.size / 1024);
      bgoLog.info('UPLOAD', `Compresión: ${originalKB}KB → ${compressedKB}KB`);

      const formData = new FormData();
      formData.append('file', compressed, 'tablilla.jpg');
      formData.append('zona_id', selectedZone);

      bgoLog.step('UPLOAD', 'Enviando al motor OCR...');
      const response = await authFetch(`${apiUrl}/api/v1/registros`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let msg = response.statusText;
        try {
          const body = await response.text();
          try { msg = JSON.parse(body).detail || msg; } catch { msg = body || msg; }
        } catch { /* ignore */ }
        bgoLog.error('UPLOAD', `OCR falló: ${response.status} → ${msg}`);
        throw new Error(`Error (${response.status}): ${msg}`);
      }

      const data: OCRResponse = await response.json();
      if ((!data.id || data.id === 0) && data.id_registro) data.id = data.id_registro;

      bgoLog.info('UPLOAD', `OCR completado  id_registro=${data.id}  estado=${data.estado}  confianza=${data.resultado_ia?.promedio_confianza}  tablilla_id=${data.resultado_ia?.tablilla_id}  celdas=${data.resultado_ia?.matriz?.length}`);
      bgoLog.data('UPLOAD', 'Respuesta OCR completa', data);

      setOcrData(data);
      setView('editor');
      showNotification('El motor OCR devolvio la matriz. Revisa las celdas antes de validar.', 'success', 'Plantilla procesada');

    } catch (err: any) {
      let msg = err.message || 'Error desconocido.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
        msg = 'Error de conexión. Verifica que el servidor esté activo.';
      bgoLog.error('UPLOAD', `Excepción: ${msg}`);
      setUploadError(msg);
      showNotification(msg, 'error', 'No se pudo procesar');
    } finally {
      setIsUploading(false);
    }
  };

  // ── Validación final ──────────────────────────────────────────────────────
  const handleValidationSave = async (cells: MatrixCell[]) => {
    if (!ocrData) return;
    const id = ocrData.id_registro ?? ocrData.id;
    if (!id) { showNotification('Error: sin ID de registro', 'error'); return; }
    bgoLog.step('VALIDATION', `Guardando validación  id_registro=${id}  celdas=${cells.length}`);

    // Group cells by row
    const rowMap = new Map<number, any>();
    cells.forEach(c => {
      const rIndex = typeof c.fila === 'string' ? parseInt(c.fila.match(/(\d+)/)?.[1] || "0") - 1 : c.fila;
      if (!rowMap.has(rIndex)) {
        rowMap.set(rIndex, { fila_index: rIndex, n_nidos: 0, n_cuevas: 0, hembra: 0, pulpos: 0 });
      }
      const row = rowMap.get(rIndex);
      const col = Number(c.col);
      const val = c.valor;
      if (col === 0) row.n_nidos = parseInt(val || '0', 10) || 0;
      if (col === 1) row.n_cuevas = parseInt(val || '0', 10) || 0;
      if (col === 2 && val.toUpperCase() === 'X') row.hembra = 1;
      if (col === 3 && val.toUpperCase() === 'X') row.hembra = 2;
      if (col === 4) row.pulpos = parseInt(val || '0', 10) || 0;
    });

    const detalles = Array.from(rowMap.values());

    const payload = {
      usuario_id:  user?.id || 1,
      zona_id:     ocrData.zona_id || 1,
      tablilla_id: null,
      detalles,
      comentarios: `Validado por ${user?.username || 'WebClient'}`,
    };

    const response = await authFetch(`${apiUrl}/api/v1/registros/${id}/validacion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text();
      bgoLog.error('VALIDATION', `Falló: ${response.status} → ${txt}`);
      throw new Error(`Validación fallida (${response.status}): ${txt}`);
    }

    bgoLog.info('VALIDATION', `Registro ${id} guardado como VALIDADO con ${detalles.length} filas de detalle`);
    showNotification('Matriz validada y guardada correctamente', 'success');
    setView('success');
    setSuccessMsg('¡Registro guardado correctamente!');
  };

  const resetFlow = () => {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setSelectedFile(null);
    setRotationDeg(0);
    setOcrData(null);
    setView('upload');
    setSuccessMsg(null);
  };

  const canViewDashboard = hasRolePermission(user?.role, 'dashboard:view');
  const canViewSettings  = hasRolePermission(user?.role, 'settings:manage');
  const canManageUsers   = hasRolePermission(user?.role, 'users:create');
  const canDigitalize    = hasRolePermission(user?.role, 'ocr:digitalize');
  const canViewBuzoAnalytics = hasRolePermission(user?.role, 'analytics:buzo_view');
  const isWideLayout     = currentModule === 'dashboard' || (currentModule === 'ocr' && view === 'editor');
  const sidebarItems = [
    canViewDashboard && {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: Grid2X2,
      onClick: () => setCurrentModule('dashboard'),
    },
    canDigitalize && {
      id: 'ocr' as const,
      label: 'Digitalización',
      icon: ScanLine,
      onClick: () => {
        setCurrentModule('ocr');
        setView('upload');
      },
    },
    canViewBuzoAnalytics && {
      id: 'buzoAnalytics' as const,
      label: 'Análisis',
      icon: Activity,
      onClick: () => setCurrentModule('buzoAnalytics'),
    },
    (canViewDashboard || canManageUsers) && {
      id: 'history' as const,
      label: 'Historial',
      icon: FileClock,
      onClick: () => setCurrentModule('history'),
    },
  ].filter(Boolean) as Array<{
    id: typeof currentModule;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
  }>;

  // ── Loading screen ────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-[#050505]">
        <div className="flex flex-col items-center gap-6">
          <div className="text-3xl font-bold tracking-tighter text-black dark:text-white">
            Bluegrid<span className="text-gray-500">OCR</span>
          </div>
          <div className="w-32 h-[1px] bg-gray-200 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-black dark:bg-white w-1/3 animate-[slide_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
        <style>{`@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
      </div>
    );
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex h-screen w-full bg-white dark:bg-[#050505] text-black dark:text-white overflow-hidden selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        <div className="w-full lg:w-[45%] flex items-center justify-center p-8 z-10 relative">
          <div className="w-full max-w-[320px] space-y-10 animate-in slide-in-from-left-4 duration-700 ease-out">
            <div className="space-y-4">
              <div className="text-3xl font-bold tracking-tighter text-black dark:text-white mb-8">
                Bluegrid<span className="text-gray-500">OCR</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tighter">Acceso</h1>
              <p className="text-gray-500 dark:text-zinc-400 text-sm font-medium tracking-wide">SISTEMA DE DIGITALIZACIÓN</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Identificador</label>
                <input
                  type="text" value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="admin, supervisor, buzo"
                  className="w-full h-12 bg-transparent border-b border-gray-200 dark:border-zinc-800 text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-zinc-700 focus:outline-none focus:border-black dark:focus:border-white transition-colors text-base font-medium rounded-none px-0"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Código de Seguridad</label>
                <input
                  type="password" value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 bg-transparent border-b border-gray-200 dark:border-zinc-800 text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-zinc-700 focus:outline-none focus:border-black dark:focus:border-white transition-colors text-base font-medium rounded-none px-0"
                />
              </div>
              {loginError && (
                <div className="text-red-500 text-xs font-medium flex items-center gap-2 pt-2">
                  <AlertCircle className="w-4 h-4" /> {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={isUploading}
                className="w-full h-12 bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black font-semibold rounded-full transition-all text-sm mt-4 tracking-wide shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    VERIFICANDO...
                  </>
                ) : (
                  "AUTENTICAR"
                )}
              </button>
            </form>
          </div>
        </div>
        <div className="hidden lg:flex flex-1 relative bg-gray-50 dark:bg-[#0a0a0a] items-center justify-center overflow-hidden border-l border-gray-100 dark:border-zinc-900">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02] pointer-events-none">
             <div className="w-[800px] h-[800px] border-[1px] border-black dark:border-white rounded-full absolute" />
             <div className="w-[600px] h-[600px] border-[1px] border-black dark:border-white rounded-full absolute" />
             <div className="w-[400px] h-[400px] border-[1px] border-black dark:border-white rounded-full absolute" />
          </div>
          <div className="relative z-10 text-center max-w-lg px-10 flex flex-col items-center">
            <div className="text-6xl font-bold tracking-tighter text-black dark:text-white mb-6">
              Bluegrid<span className="text-gray-500">OCR</span>
            </div>
            <p className="text-gray-500 dark:text-zinc-400 text-lg font-medium tracking-wide leading-relaxed">
              Infraestructura de análisis y digitalización de matrices acuícolas.
            </p>
            <div className="mt-12 flex justify-center gap-4">
              <div className="h-1 w-12 bg-black dark:bg-white rounded-full opacity-20" />
              <div className="h-1 w-4 bg-black dark:bg-white rounded-full opacity-20" />
              <div className="h-1 w-4 bg-black dark:bg-white rounded-full opacity-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── App principal ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black font-sans text-gray-800 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      {isUploading && <DenoiseProcessingOverlay />}

      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          title={notification.title}
          onClose={() => setNotification(null)}
        />
      )}
      {canViewSettings && (
        <SettingsModal
          isOpen={isSettingsOpen} currentUrl={apiUrl}
          onSave={handleSaveUrl} onClose={() => setIsSettingsOpen(false)}
          canClose={!!apiUrl}
        />
      )}

      <input type="file" ref={fileInputRef}   onChange={handleFileSelect} accept="image/*" className="hidden" />
      <input type="file" ref={cameraInputRef} onChange={handleFileSelect} accept="image/*" capture="environment" className="hidden" />

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-[#050505] border-r border-gray-200 dark:border-zinc-900 h-full shrink-0 z-20 transition-colors relative">
        <div className="h-20 flex items-center justify-center border-b border-gray-100 dark:border-zinc-900 shrink-0">
          <div
            className="flex items-center cursor-pointer group"
            onClick={() => canViewDashboard && setCurrentModule('dashboard')}
          >
            <span className="font-bold text-2xl tracking-tighter text-black dark:text-white">
              Bluegrid<span className="text-gray-500">OCR</span>
            </span>
          </div>
        </div>

        {canDigitalize && (
          <div className="px-4 py-4 shrink-0">
            <button
              onClick={() => {
                setCurrentModule('ocr');
                setView('upload');
              }}
              className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-10 rounded-none flex items-center justify-center gap-2 font-semibold text-sm transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Nueva digitalización
            </button>
          </div>
        )}

        <nav className="flex-1 px-3 pt-0 overflow-y-auto">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-1.5 dark:border-zinc-900 dark:bg-zinc-950/50">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const active = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`group relative mb-1 flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium transition-all last:mb-0 ${
                    active
                      ? 'bg-white text-black shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800'
                      : 'text-gray-500 hover:bg-white/80 hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-900/70 dark:hover:text-white'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                      : 'text-gray-400 group-hover:text-blue-600 dark:text-zinc-600 dark:group-hover:text-blue-300'
                  }`}>
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-300" />}
                </button>
              );
            })}
            {canManageUsers && (
              <div className="mt-1">
                <button
                  onClick={() => {
                    setIsUsersNavOpen(open => !open);
                    setCurrentModule('users');
                  }}
                  className={`group relative flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium transition-all ${
                    currentModule === 'users'
                      ? 'bg-white text-black shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800'
                      : 'text-gray-500 hover:bg-white/80 hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-900/70 dark:hover:text-white'
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    currentModule === 'users'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                      : 'text-gray-400 group-hover:text-blue-600 dark:text-zinc-600 dark:group-hover:text-blue-300'
                  }`}>
                    <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate">Usuarios</span>
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-300 ease-out ${isUsersNavOpen ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                    isUsersNavOpen ? 'mt-1 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1 pl-9 pt-1">
                    {[
                      { id: 'users' as const, label: 'Usuarios', icon: Users },
                      { id: 'boats' as const, label: 'Embarcaciones', icon: Ship },
                      { id: 'tables' as const, label: 'Tablas asignadas', icon: Table2 },
                    ].map(item => {
                      const Icon = item.icon;
                      const active = currentModule === 'users' && adminSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentModule('users');
                            setAdminSection(item.id);
                          }}
                          className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                              : 'text-gray-500 hover:bg-white hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </nav>

        {/* User Profile Menu (Bottom of Sidebar) */}
        <div className="p-4 shrink-0 border-t border-gray-100 dark:border-zinc-900 relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsUserMenuOpen(!isUserMenuOpen);
            }}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black dark:text-white truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mt-0.5 truncate">{user.role}</p>
            </div>
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-4 mb-2 w-56 bg-white dark:bg-[#18181b] rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 mb-2">
                <p className="text-sm font-semibold text-black dark:text-white truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mt-0.5 truncate">{user.role}</p>
              </div>
              
              <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
              </button>
              
              {canViewSettings && (
                <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <Settings className="w-4 h-4" />
                  Ajustes
                </button>
              )}
              
              <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2"></div>
              
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>

      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-white dark:bg-[#0a0a0a]" onClick={() => setIsUserMenuOpen(false)}>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth pt-4 md:pt-0">
          <div className="absolute inset-0">
            {/* Dashboard Module */}
            <div className={currentModule === 'dashboard' && canViewDashboard ? 'block h-full' : 'hidden'}>
              <Dashboard isDarkMode={isDarkMode} currentUser={user} onNotify={showNotification} />
            </div>

            {/* User Management Module */}
            {canManageUsers && user && (
              <div className={currentModule === 'users' ? 'block h-full' : 'hidden'}>
                <AdminUsersPanel
                  apiUrl={apiUrl}
                  currentUser={user}
                  onNotify={showNotification}
                  activeSection={adminSection}
                  onSectionChange={setAdminSection}
                />
              </div>
            )}

            {/* Buzo Analytics Module */}
            {canViewBuzoAnalytics && (
              <div className={currentModule === 'buzoAnalytics' ? 'block h-full' : 'hidden'}>
                <BuzoAnalytics
                  apiUrl={apiUrl}
                  currentUser={user}
                  isDarkMode={isDarkMode}
                  onNotify={showNotification}
                />
              </div>
            )}

            {canViewDashboard && (
              <div className={currentModule === 'history' ? 'block h-full' : 'hidden'}>
                <HistoryReport apiUrl={apiUrl} onNotify={showNotification} />
              </div>
            )}

            {/* OCR Digitalization Module */}
            <div className={currentModule === 'ocr' ? 'block h-full' : 'hidden'}>
              {view === 'upload' && (
                <div className="h-full overflow-hidden bg-[#f6f8fb] px-3 py-3 dark:bg-[#0a0a0a] md:px-5 md:py-4">
                  <div className="mx-auto flex h-full max-w-[1480px] animate-in fade-in slide-in-from-bottom-3 duration-500 flex-col gap-3">
                    <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
                          <ScanLine className="h-4 w-4" />
                          Registro de campo
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-white md:text-3xl">
                          Digitalizar matriz
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-gray-500 dark:text-zinc-400">
                          Selecciona el sector, revisa la plantilla y carga la digitalización cuando la grilla esté legible.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={selectedZone ? 'success' : 'warning'}>
                            {selectedZone ? 'Sector seleccionado' : 'Sector pendiente'}
                          </Badge>
                          <Badge tone={selectedFile ? 'success' : 'muted'}>
                            {selectedFile ? 'Imagen lista' : 'Sin imagen'}
                          </Badge>
                        </div>
                        <Button
                          onClick={handleUpload}
                          disabled={isUploading || !selectedFile || !selectedZone}
                          className="h-10 w-full px-5 text-xs tracking-wide sm:w-auto"
                        >
                          {isUploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> CARGANDO</>
                          ) : (
                            <><Upload className="h-4 w-4" /> CARGAR DIGITALIZACIÓN</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
                      <Card className="flex min-h-0 flex-col overflow-hidden">
                        <CardHeader className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
                                Contexto
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-black dark:text-white">
                                Datos de captura
                              </h3>
                            </div>
                            <FileImage className="h-5 w-5 text-gray-300 dark:text-zinc-600" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 overflow-y-auto">
                          <div className="space-y-2">
                            <label className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-zinc-500">
                              Zona acuícola
                              <Badge tone="warning">Requerido</Badge>
                            </label>
                            <SelectControl
                              value={selectedZone}
                              onChange={setSelectedZone}
                              options={[
                                { value: '', label: 'Seleccionar centro de cultivo' },
                                ...zones.map(z => ({ value: z.id, label: z.name })),
                              ]}
                              buttonClassName="h-11 bg-white font-semibold dark:bg-[#0b0b0c]"
                            />
                            {zonesError && (
                              <p className="text-xs font-medium text-red-500 dark:text-red-400">{zonesError}</p>
                            )}
                          </div>

                          <div className="space-y-2.5 border-t border-gray-100 pt-3 dark:border-zinc-900">
                            {[
                              { label: 'Sector asociado a BDD', done: Boolean(selectedZone) },
                              { label: 'Imagen cargada localmente', done: Boolean(selectedFile) },
                              { label: 'Previsualización verificada', done: Boolean(previewUrl) },
                            ].map(item => (
                              <div key={item.label} className="flex items-center gap-3">
                                <span className={`flex h-6 w-6 items-center justify-center border ${
                                  item.done
                                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                                    : 'border-gray-200 text-gray-300 dark:border-zinc-800 dark:text-zinc-700'
                                }`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-sm font-medium leading-5 text-gray-600 dark:text-zinc-300">{item.label}</span>
                              </div>
                            ))}
                          </div>

                          <div className="border border-gray-200 bg-gray-50 p-3 text-xs font-medium leading-5 text-gray-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                            El sector seleccionado mantiene la trazabilidad en historial, KPIs y reportes.
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="flex min-h-0 flex-col overflow-hidden">
                        <CardHeader className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
                              Imagen de plantilla
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-black dark:text-white">
                              Previsualización y envío
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedFile && (
                              <Badge tone="muted" className="max-w-full truncate">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                              </Badge>
                            )}
                            {selectedFile && (
                              <button
                                type="button"
                                onClick={() => setRotationDeg(d => (d + 90) % 360)}
                                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-600 transition-colors hover:border-black hover:bg-black hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                                title="Rotar imagen 90°"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                                Rotar {rotationDeg > 0 ? `(${rotationDeg}°)` : ''}
                              </button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
                          <label className={`group relative flex min-h-[260px] flex-1 cursor-pointer items-center justify-center overflow-hidden border transition-colors md:min-h-0 ${
                            selectedFile
                              ? 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-[#050505]'
                              : 'border-dashed border-gray-300 bg-gray-50 hover:border-black dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-white'
                          }`}>
                            {selectedFile && previewUrl ? (
                              <div className="flex h-full w-full flex-col">
                                <div className="flex min-h-0 flex-1 items-center justify-center bg-[linear-gradient(45deg,rgba(0,0,0,0.025)_25%,transparent_25%),linear-gradient(-45deg,rgba(0,0,0,0.025)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(0,0,0,0.025)_75%),linear-gradient(-45deg,transparent_75%,rgba(0,0,0,0.025)_75%)] bg-[length:22px_22px] bg-[position:0_0,0_11px,11px_-11px,-11px_0] p-2 dark:bg-none md:p-3">
                                  <img
                                    src={previewUrl}
                                    alt="Previsualización de plantilla"
                                    style={{ transform: `rotate(${rotationDeg}deg)`, transition: 'transform 0.3s ease' }}
                                    className="h-full max-h-[58vh] w-full object-contain"
                                  />
                                </div>
                                <div className="flex shrink-0 flex-col gap-2 border-t border-gray-100 p-2.5 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-black dark:text-white">{selectedFile.name}</p>
                                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">Click en el panel para reemplazar la imagen.</p>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 transition-colors group-hover:text-black dark:group-hover:text-white">
                                    <Upload className="h-3.5 w-3.5" />
                                    Reemplazar
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex max-w-sm flex-col items-center px-6 text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center border border-gray-200 bg-white text-gray-400 transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white dark:border-zinc-800 dark:bg-[#111113] dark:group-hover:border-white dark:group-hover:bg-white dark:group-hover:text-black">
                                  <Camera className="h-6 w-6" />
                                </div>
                                <p className="text-base font-semibold text-black dark:text-white">Capturar o subir imagen</p>
                                <p className="mt-2 text-sm font-medium leading-6 text-gray-400 dark:text-zinc-500">
                                  Usa una foto frontal y bien iluminada. La grilla completa debe quedar dentro del encuadre.
                                </p>
                              </div>
                            )}
                            <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" />
                          </label>

                          {/* Card de referencia de orientación */}
                          <div className="flex shrink-0 gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
                            <div className="shrink-0 pt-0.5">
                              <Info className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">Orientación correcta</p>
                              <p className="mt-1 text-xs font-medium leading-5 text-blue-600 dark:text-blue-300">
                                La tablilla debe quedar <strong>horizontal</strong>, con los 4 puntos rojos visibles en las esquinas y la grilla completamente dentro del encuadre.
                                Usa el botón <strong>Rotar</strong> si la foto quedó girada.
                              </p>
                              {/* Ilustración SVG de referencia */}
                              <div className="mt-2 flex justify-center">
                                <svg width="160" height="96" viewBox="0 0 160 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded border border-blue-200 bg-white dark:border-blue-800 dark:bg-zinc-900">
                                  {/* Marco tablilla */}
                                  <rect x="10" y="8" width="140" height="80" rx="3" fill="#e8f4f8" stroke="#60a5fa" strokeWidth="1.5"/>
                                  {/* Puntos rojos esquinas */}
                                  <circle cx="18" cy="16" r="4" fill="#ef4444"/>
                                  <circle cx="142" cy="16" r="4" fill="#ef4444"/>
                                  <circle cx="18" cy="80" r="4" fill="#ef4444"/>
                                  <circle cx="142" cy="80" r="4" fill="#ef4444"/>
                                  {/* Líneas de grilla 5x5 */}
                                  {[0,1,2,3,4,5].map(i => (
                                    <line key={`v${i}`} x1={26 + i*23} y1="22" x2={26 + i*23} y2="74" stroke="#93c5fd" strokeWidth="0.8"/>
                                  ))}
                                  {[0,1,2,3,4,5].map(i => (
                                    <line key={`h${i}`} x1="26" y1={22 + i*10.4} x2="141" y2={22 + i*10.4} stroke="#93c5fd" strokeWidth="0.8"/>
                                  ))}
                                  {/* Flecha orientación */}
                                  <text x="80" y="91" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="bold">↔ HORIZONTAL</text>
                                </svg>
                              </div>
                            </div>
                          </div>

                          {uploadError && (
                            <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-in fade-in dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <div className="font-medium leading-relaxed">{uploadError}</div>
                            </div>
                          )}

                          <div className="shrink-0 text-xs font-medium leading-5 text-gray-400 dark:text-zinc-500">
                            {selectedFile
                              ? 'La imagen está lista para cargar la digitalización y continuar con la validación.'
                              : 'Selecciona una imagen para habilitar la carga de digitalización.'}
                          </div>
                          <div className="grid gap-3 md:hidden">
                            <Button
                              onClick={handleUpload}
                              disabled={isUploading || !selectedFile || !selectedZone}
                              className="h-11 w-full px-5 text-xs tracking-wide"
                            >
                              {isUploading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> CARGANDO</>
                              ) : (
                                <><Upload className="h-4 w-4" /> CARGAR DIGITALIZACIÓN</>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}


                {view === 'editor' && ocrData && (
                  <MatrixEditor
                    data={ocrData}
                    imageUrl={previewUrl}
                    imageRotation={rotationDeg}
                    currentUser={user}
                    onSave={handleValidationSave}
                    onNotify={showNotification}
                    onCancel={resetFlow}
                  />
                )}

                {view === 'success' && (
                  <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500 ease-out text-center max-w-md mx-auto px-4">
                    <div className="relative mb-10">
                      <div className="absolute inset-0 bg-black/5 dark:bg-white/10 blur-2xl rounded-full" />
                      <div className="relative h-24 w-24 bg-black dark:bg-white rounded-full flex items-center justify-center shadow-xl">
                        <CheckCircle2 className="w-10 h-10 text-white dark:text-black" />
                      </div>
                    </div>
                    <h2 className="text-4xl font-semibold tracking-tighter text-black dark:text-white mb-4">Completado</h2>
                    <p className="text-gray-500 dark:text-zinc-400 text-base font-medium mb-10 leading-relaxed">
                      La matriz ha sido validada y sincronizada con el sistema central.
                    </p>
                    <button
                      onClick={resetFlow}
                      className="inline-flex items-center justify-center rounded-full text-sm font-semibold transition-all bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-12 px-10 shadow-md active:scale-[0.98] tracking-wide"
                    >
                      NUEVA DIGITALIZACIÓN
                    </button>
                  </div>
                )}
            </div>
          </div>
        </main>

        {/* Mobile FAB */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[2000] flex flex-col justify-end pb-28 items-center px-6 pointer-events-none">
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md pointer-events-auto transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
            <div
              className="pointer-events-auto w-full max-w-sm bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-300 ease-out flex flex-col gap-4 relative z-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto mb-4" />
              <h3 className="text-black dark:text-white text-center font-semibold text-xl tracking-tight mb-4">Nueva captura</h3>
              <button
                onClick={() => { cameraInputRef.current?.click(); setIsMobileMenuOpen(false); }}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-black dark:text-white font-medium h-14 rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all gap-3"
              >
                <Camera className="w-5 h-5" /> Tomar foto
              </button>
              <button
                onClick={() => { fileInputRef.current?.click(); setIsMobileMenuOpen(false); }}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-black dark:text-white font-medium h-14 rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all gap-3"
              >
                <FileImage className="w-5 h-5" /> Cargar imagen
              </button>
            </div>
          </div>
        )}

        {!selectedFile && (
          <div className="md:hidden fixed bottom-8 left-0 w-full z-[1001] flex justify-center pointer-events-none">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`pointer-events-auto h-12 w-12 rounded-none flex items-center justify-center transition-all duration-300 bg-black dark:bg-white text-white dark:text-black shadow-lg ${isMobileMenuOpen ? 'rotate-45 scale-105' : 'hover:scale-105 active:scale-95'}`}
            >
              <Plus className="w-6 h-6" strokeWidth={1} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
