import React, { useEffect } from 'react';
import { RotateCw, Check, X, Info, AlertCircle, Loader2 } from 'lucide-react';
import { ImageAnalysis } from '../services/imageProcessing';

interface ImageConfirmModalProps {
  open: boolean;
  previewUrl: string | null;
  rotationDeg: number;
  onRotate: () => void;
  analysis: ImageAnalysis | null;
  isAnalyzing: boolean;
  isUploading: boolean;
  onConfirm: () => void;
  onExit: () => void;
}

/** Ilustración de referencia de orientación (tablilla horizontal + 4 puntos rojos). */
const OrientationGuide = () => (
  <svg width="160" height="96" viewBox="0 0 160 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded border border-blue-200 bg-white dark:border-blue-800 dark:bg-zinc-900">
    <rect x="10" y="8" width="140" height="80" rx="3" fill="#e8f4f8" stroke="#60a5fa" strokeWidth="1.5" />
    <circle cx="18" cy="16" r="4" fill="#ef4444" />
    <circle cx="142" cy="16" r="4" fill="#ef4444" />
    <circle cx="18" cy="80" r="4" fill="#ef4444" />
    <circle cx="142" cy="80" r="4" fill="#ef4444" />
    {[0, 1, 2, 3, 4, 5].map(i => (
      <line key={`v${i}`} x1={26 + i * 23} y1="22" x2={26 + i * 23} y2="74" stroke="#93c5fd" strokeWidth="0.8" />
    ))}
    {[0, 1, 2, 3, 4, 5].map(i => (
      <line key={`h${i}`} x1="26" y1={22 + i * 10.4} x2="141" y2={22 + i * 10.4} stroke="#93c5fd" strokeWidth="0.8" />
    ))}
    <text x="80" y="91" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="bold">↔ HORIZONTAL</text>
  </svg>
);

/**
 * Panel emergente animado que aparece al subir/capturar una imagen. Muestra la imagen,
 * permite rotarla en el sitio y confirma la orientación antes de enviarla al motor OCR.
 * "Sí, digitalizar plantilla" envía de inmediato; "No, Salir" cierra sin perder la captura.
 */
export default function ImageConfirmModal({
  open,
  previewUrl,
  rotationDeg,
  onRotate,
  analysis,
  isAnalyzing,
  isUploading,
  onConfirm,
  onExit,
}: ImageConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) onExit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isUploading, onExit]);

  if (!open || !previewUrl) return null;

  const blocked = analysis ? !analysis.ok : false;

  return (
    <div className="fixed inset-0 z-[2400] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => { if (!isUploading) onExit(); }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar orientación de la imagen"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-gray-200 bg-white shadow-2xl animate-in slide-in-from-bottom-8 fade-in duration-300 ease-out dark:border-zinc-800 dark:bg-[#0b0b0c] sm:rounded-[2rem] sm:zoom-in-95"
      >
        {/* Encabezado */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-zinc-900">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">Revisión de captura</p>
            <h3 className="mt-0.5 text-lg font-bold tracking-tight text-black dark:text-white">¿La vista está correcta?</h3>
          </div>
          <button
            onClick={() => { if (!isUploading) onExit(); }}
            disabled={isUploading}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-black disabled:opacity-40 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Imagen + rotar */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-[#050505]">
            <div className="flex max-h-[46vh] min-h-[200px] items-center justify-center p-3">
              <img
                src={previewUrl}
                alt="Previsualización de plantilla"
                style={{ transform: `rotate(${rotationDeg}deg)`, transition: 'transform 0.3s ease' }}
                className="max-h-[42vh] w-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={onRotate}
              disabled={isUploading}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-700 shadow-md backdrop-blur transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
              title="Rotar imagen 90°"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotar {rotationDeg > 0 ? `(${rotationDeg}°)` : ''}
            </button>
          </div>

          {/* Referencia de orientación */}
          <div className="flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">Orientación correcta</p>
              <p className="mt-1 text-xs font-medium leading-5 text-blue-600 dark:text-blue-300">
                La tablilla debe quedar <strong>horizontal</strong>, con los 4 puntos rojos visibles en las esquinas y la grilla completa dentro del encuadre. Usa <strong>Rotar</strong> si la foto quedó girada.
              </p>
              <div className="mt-2 flex justify-center">
                <OrientationGuide />
              </div>
            </div>
          </div>

          {/* Validación */}
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analizando calidad de la imagen…
            </div>
          )}
          {analysis?.errors.map(msg => (
            <div key={msg} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="font-medium leading-relaxed">{msg}</div>
            </div>
          ))}
          {analysis?.ok && analysis.warnings.map(msg => (
            <div key={msg} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="font-medium leading-relaxed">{msg}</div>
            </div>
          ))}
        </div>

        {/* Acciones fijas */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-100 p-4 dark:border-zinc-900 sm:flex-row-reverse">
          <button
            onClick={onConfirm}
            disabled={isUploading || blocked}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Sí, digitalizar plantilla
          </button>
          <button
            onClick={onExit}
            disabled={isUploading}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-[#050505] dark:text-gray-200 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
            No, salir
          </button>
        </div>
      </div>
    </div>
  );
}
