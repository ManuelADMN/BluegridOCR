import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, XCircle, Save, Activity } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  currentUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
  canClose: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUrl,
  onSave,
  onClose,
  canClose,
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  if (!isOpen) return null;

  const handleSmokeTest = async () => {
    setStatus('testing');
    setStatusMsg('Conectando con el servidor...');

    // Remove ANY trailing slashes using regex
    const cleanUrl = urlInput.replace(/\/+$/, '');

    try {
      console.log(`[Config] Probando conexión: ${cleanUrl}/`);
      
      const response = await fetch(`${cleanUrl}/`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      if (response.ok) {
        setStatus('success');
        setStatusMsg('Sistema En Línea: 200 OK');
      } else {
        setStatus('error');
        setStatusMsg(`Error: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      setStatus('error');
      console.error("Error de conexión:", err);
      
      let displayMsg = 'Falló la conexión.';
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        displayMsg = "Error de conexión. Verifica Colab y la URL.";
      }
      setStatusMsg(displayMsg);
    }
  };

  const handleSave = () => {
    const cleanUrl = urlInput.replace(/\/+$/, '');
    
    if (status !== 'success') {
      if (!confirm("La prueba de conexión no fue exitosa. ¿Guardar de todos modos?")) return;
    }
    
    onSave(cleanUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#050505] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-zinc-800 transition-colors">
        <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#050505]">
          <h2 className="text-xl font-semibold tracking-tighter text-black dark:text-white flex items-center gap-3">
            <Server className="w-5 h-5 text-black dark:text-white" />
            Configuración
          </h2>
          {canClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full">
              ✕
            </button>
          )}
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              URL Base (Ngrok)
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setStatus('idle');
              }}
              placeholder="https://xxxx.ngrok-free.app"
              className="flex h-12 w-full rounded-xl border-b-2 border-gray-200 dark:border-zinc-800 bg-transparent px-0 py-2 text-lg font-mono text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-zinc-700 focus-visible:outline-none focus-visible:border-black dark:focus-visible:border-white transition-all"
            />
            <p className="text-[10px] text-gray-400">
              Ingresa la URL pública generada por Ngrok.
            </p>
          </div>

          {/* Status Indicator */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest border ${
            status === 'idle' ? 'bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-gray-400' :
            status === 'testing' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' :
            status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' :
            'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          }`}>
             {status === 'idle' && <Activity className="w-4 h-4" />}
             {status === 'testing' && <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />}
             {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
             {status === 'error' && <XCircle className="w-4 h-4" />}
             <span>{statusMsg || "Listo para probar"}</span>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSmokeTest}
              disabled={!urlInput || status === 'testing'}
              className="inline-flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white disabled:opacity-50 disabled:pointer-events-none border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#050505] hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white h-12 px-6 w-full text-gray-700 dark:text-gray-300"
            >
              Probar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white disabled:opacity-50 disabled:pointer-events-none bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 h-12 px-6 w-full gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;