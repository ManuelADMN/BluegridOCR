import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Upload, FileImage, AlertCircle, CheckCircle2,
  Droplets, LayoutDashboard, ClipboardList, ChevronRight,
  Loader2, Moon, Sun, LogOut, Camera, Plus, X, Sparkles, FileText, Users, BarChart3
} from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import MatrixEditor from './components/MatrixEditor';
import Dashboard from './components/Dashboard';
import NotificationToast from './components/NotificationToast';
import { BluegridLogo } from './components/BluegridLogo';
import AdminUsersPanel from './components/AdminUsersPanel';
import BuzoAnalytics from './components/BuzoAnalytics';
import { authFetch } from './services/apiClient';
import { 
  OCRResponse, MOCK_ZONES, AppView, User, UserRole, MatrixCell, 
  Permission, hasRolePermission 
} from './types';

const STORAGE_KEY_URL   = 'bluegrid_api_url';
const STORAGE_KEY_THEME = 'bluegrid_theme';
const DEFAULT_API_URL   =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
        <p className="text-sm text-gray-500 dark:text-gray-400">Leyendo la tablilla con IA…</p>
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
  const [currentModule,   setCurrentModule]   = useState<'ocr' | 'dashboard' | 'users' | 'buzoAnalytics'>('dashboard');
  const [view,            setView]            = useState<AppView>('upload');
  const [isSettingsOpen,  setIsSettingsOpen]  = useState(false);

  // Upload
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [selectedZone,   setSelectedZone]   = useState<string>('');
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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showNotification = (message: string, type: 'success' | 'error' = 'success') =>
    setNotification({ message, type });

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
  }, [currentModule, user]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (passwordInput.trim().length < 6) {
      setLoginError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsUploading(true); // Reutilizar overlay de carga si es necesario, o añadir uno específico

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Credenciales inválidas');
      }

      const data = await response.json();
      
      // Guardar token real
      localStorage.setItem('bluegridocr_token', data.access_token);

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
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadError(null);
      setCurrentModule('ocr');
      setView('upload');
      setIsMobileMenuOpen(false);
    }
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Compresión de imagen ──────────────────────────────────────────────────
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const MAX_PX  = 1600;
        const QUALITY = 0.85;

        let { width, height } = img;

        if (width > height && width > MAX_PX) {
          height = Math.round((height * MAX_PX) / width);
          width  = MAX_PX;
        } else if (height > width && height > MAX_PX) {
          width  = Math.round((width * MAX_PX) / height);
          height = MAX_PX;
        } else if (width > MAX_PX) {
          height = Math.round((height * MAX_PX) / width);
          width  = MAX_PX;
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas no disponible')); return; }

        ctx.drawImage(img, 0, 0, width, height);

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
    setIsUploading(true);
    setUploadError(null);

    try {
      const originalKB   = Math.round(selectedFile.size / 1024);
      const compressed   = await compressImage(selectedFile);
      const compressedKB = Math.round(compressed.size / 1024);
      console.log(`[Upload] Compresión: ${originalKB}KB → ${compressedKB}KB`);

      const formData = new FormData();
      formData.append('file', compressed, 'tablilla.jpg');
      formData.append('zona_id', selectedZone || '1');

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
        throw new Error(`Error (${response.status}): ${msg}`);
      }

      const data: OCRResponse = await response.json();
      if ((!data.id || data.id === 0) && data.id_registro) data.id = data.id_registro;

      setOcrData(data);
      setView('editor');

    } catch (err: any) {
      let msg = err.message || 'Error desconocido.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
        msg = 'Error de conexión. Verifica que el servidor esté activo.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Validación final ──────────────────────────────────────────────────────
  const handleValidationSave = async (cells: MatrixCell[]) => {
    if (!ocrData) return;
    const id = ocrData.id_registro ?? ocrData.id;
    if (!id) { showNotification('Error: sin ID de registro', 'error'); return; }

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
      throw new Error(`Validación fallida (${response.status}): ${txt}`);
    }

    showNotification('Matriz validada y guardada correctamente', 'success');
    setView('success');
    setSuccessMsg('¡Registro guardado correctamente!');
  };

  const resetFlow = () => {
    setSelectedFile(null);
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
        <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
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
          <div className="px-4 py-6 shrink-0">
            <button
              onClick={() => {
                setCurrentModule('ocr');
                setView('upload');
              }}
              className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Nueva Digitalización
            </button>
          </div>
        )}

        <nav className="flex-1 px-4 space-y-8 overflow-y-auto pb-6">
          
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Principal</p>
            <div className="space-y-1">
              {canViewDashboard && (
                <button
                  onClick={() => setCurrentModule('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    currentModule === 'dashboard'
                      ? 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </button>
              )}
              {canDigitalize && (
                <button
                  onClick={() => {
                    setCurrentModule('ocr');
                    setView('upload');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    currentModule === 'ocr'
                      ? 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" /> Digitalizar
                </button>
              )}
              {canManageUsers && (
                <button
                  onClick={() => setCurrentModule('users')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    currentModule === 'users'
                      ? 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" /> Usuarios
                </button>
              )}

              {canViewBuzoAnalytics && (
                <button
                  onClick={() => setCurrentModule('buzoAnalytics')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    currentModule === 'buzoAnalytics'
                      ? 'bg-gray-100 dark:bg-zinc-900 text-black dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" /> Análisis por Buzo
                </button>
              )}
            </div>
          </div>

          {(canViewDashboard || canManageUsers) && (
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Reportes</p>
              <div className="space-y-1">
                <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 dark:text-zinc-600 cursor-not-allowed transition-all">
                  <FileText className="w-4 h-4" /> Historial <span className="text-[9px] font-bold bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">PRÓXIMAMENTE</span>
                </button>
                <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 dark:text-zinc-600 cursor-not-allowed transition-all">
                  <Upload className="w-4 h-4" /> Exportar Datos <span className="text-[9px] font-bold bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">PRÓXIMAMENTE</span>
                </button>
              </div>
            </div>
          )}

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
              <Dashboard isDarkMode={isDarkMode} />
            </div>

            {/* User Management Module */}
            {canManageUsers && user && (
              <div className={currentModule === 'users' ? 'block h-full' : 'hidden'}>
                <AdminUsersPanel apiUrl={apiUrl} currentUser={user} onNotify={showNotification} />
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

            {/* OCR Digitalization Module */}
            <div className={currentModule === 'ocr' ? 'block h-full' : 'hidden'}>
              {view === 'upload' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out max-w-2xl mx-auto pt-8 md:pt-2 flex flex-col justify-start md:justify-center h-full px-4 md:px-0">
                    <div className="mb-6 md:mb-3 text-center mt-4 md:mt-0">
                      <h2 className="text-3xl md:text-3xl font-semibold tracking-tighter text-black dark:text-white mb-1">
                        Digitalizar Matriz
                      </h2>
                    </div>

                    <div className="bg-white dark:bg-[#050505] rounded-[2rem] shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                      <div className="p-4 space-y-3">

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                            Zona Acuícola
                            <span className="text-[9px] bg-gray-100 dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 px-2 py-1 rounded-full">REQUERIDO</span>
                          </label>
                          <div className="relative">
                            <select
                              value={selectedZone}
                              onChange={e => setSelectedZone(e.target.value)}
                              className="flex h-11 w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-transparent px-4 py-2 text-sm font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors appearance-none"
                            >
                              <option value="" className="dark:bg-[#050505]">— Seleccionar Centro de Cultivo —</option>
                              {MOCK_ZONES.map(z => (
                                <option key={z.id} value={z.id} className="dark:bg-[#050505]">{z.name}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                            Imagen de Tablilla
                          </label>
                          <label className={`flex flex-col items-center justify-center w-full border border-dashed rounded-2xl cursor-pointer transition-all group relative overflow-hidden ${
                            selectedFile
                              ? 'border-black dark:border-white bg-gray-50 dark:bg-zinc-900/30 p-2'
                              : 'h-32 md:h-36 border-gray-300 dark:border-zinc-700 bg-transparent hover:border-black dark:hover:border-white'
                          }`}>
                            <div className="flex flex-col items-center justify-center text-center z-10 w-full h-full">
                              {selectedFile ? (
                                <div className="flex flex-col items-center gap-3 w-full">
                                  {previewUrl && (
                                    <div className="w-full h-48 md:h-64 shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm bg-black/5 dark:bg-white/5">
                                      <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                    </div>
                                  )}
                                  <div className="flex flex-col items-center text-center overflow-hidden w-full pb-2 px-4">
                                    <p className="text-sm font-semibold text-black dark:text-white truncate w-full">{selectedFile.name}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <p className="text-[10px] text-gray-500 font-mono bg-white dark:bg-[#050505] px-2 py-1 rounded-md border border-gray-200 dark:border-zinc-800 inline-block">
                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                      </p>
                                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest group-hover:text-black dark:group-hover:text-white transition-colors flex items-center gap-1.5">
                                        <Upload className="w-3 h-3" /> Reemplazar
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="p-2.5 bg-gray-100 dark:bg-zinc-900 rounded-full mb-2 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black text-gray-400 transition-all duration-300">
                                    <Camera className="w-4 h-4" />
                                  </div>
                                  <p className="mb-1 text-sm font-semibold text-black dark:text-white tracking-wide">Capturar o Subir Imagen</p>
                                  <p className="text-xs text-gray-400 font-medium">Asegúrate de que la grilla sea visible</p>
                                </>
                              )}
                            </div>
                            <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" />
                          </label>
                        </div>

                        {uploadError && (
                          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl flex items-start gap-3 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="font-medium leading-relaxed">{uploadError}</div>
                          </div>
                        )}

                        <button
                          onClick={handleUpload}
                          disabled={isUploading || !selectedFile}
                          className="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-11 px-8 w-full shadow-md hover:shadow-lg active:scale-[0.98] tracking-wide mt-2"
                        >
                          {isUploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-3" /> PROCESANDO…</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" /> INICIAR ANÁLISIS</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {view === 'editor' && ocrData && (
                  <MatrixEditor
                    data={ocrData}
                    imageFile={selectedFile}
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
              <h3 className="text-black dark:text-white text-center font-semibold text-xl tracking-tight mb-4">Nueva Captura</h3>
              <button
                onClick={() => { cameraInputRef.current?.click(); setIsMobileMenuOpen(false); }}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-black dark:text-white font-medium h-14 rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all gap-3"
              >
                <Camera className="w-5 h-5" /> Tomar Foto
              </button>
              <button
                onClick={() => { fileInputRef.current?.click(); setIsMobileMenuOpen(false); }}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-black dark:text-white font-medium h-14 rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all gap-3"
              >
                <FileImage className="w-5 h-5" /> Cargar Imagen
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
