import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw, AlertCircle, AlertTriangle, ZoomIn, ZoomOut, Eye, EyeOff, Image as ImageIcon, Maximize, Ship, Table2 } from 'lucide-react';
import { MatrixCell, OCRResponse, User } from '../types';
import { authFetch } from '../services/apiClient';
import { getApiBaseUrl } from '../services/runtimeConfig';
import { bgoLog } from '../services/logger';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface MatrixEditorProps {
  data: OCRResponse;
  imageUrl: string | null;
  imageRotation?: number;
  currentUser: User | null;
  onSave: (validatedCells: MatrixCell[]) => Promise<void>;
  onNotify: (message: string, type: 'success' | 'error') => void;
  onCancel: () => void;
}

const MatrixEditor: React.FC<MatrixEditorProps> = ({ data, imageUrl, imageRotation = 0, currentUser, onSave, onNotify, onCancel }) => {
  const [cells, setCells] = useState<MatrixCell[]>([]);
  const [originalCells, setOriginalCells] = useState<MatrixCell[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const tablillaMeta = data.resultado_ia?.tablilla_detectada;
  const embarcacionDetectada = tablillaMeta?.embarcacion;

  // Initialize cells when data loads - Adaptation for Bluegrid_OCRv2
  useEffect(() => {
    // Check if data has the nested structure (v2) or flat (legacy safety)
    let initialCells: MatrixCell[] = [];
    
    if (data && data.resultado_ia && data.resultado_ia.matriz) {
      initialCells = data.resultado_ia.matriz.map(c => ({...c}));
    } else if (data && (data as any).matriz) {
      // Fallback for legacy structure if backend reverts
      initialCells = (data as any).matriz.map((c: any) => ({...c}));
    }

    setCells(initialCells);
    // Deep copy for original reference
    setOriginalCells(JSON.parse(JSON.stringify(initialCells)));
  }, [data]);

  // Helper function to parse "Fila X" to an integer 0-based index
  const parseRowIndex = (rowLabel: string | number): number => {
    if (typeof rowLabel === 'number') return rowLabel;
    
    // Check if it matches "Fila X" format specifically
    const matchFila = rowLabel.match(/Fila\s*(\d+)/i);
    if (matchFila) {
      // "Fila 1" -> 0, "Fila 10" -> 9
      return parseInt(matchFila[1], 10) - 1;
    }

    // If it's just a raw number string "0", "1", "10"
    const matchNum = rowLabel.match(/^(\d+)$/);
    if (matchNum) {
      // Treat as 0-based index directly
      return parseInt(matchNum[1], 10);
    }

    return -1; // Invalid row, will be filtered out
  };

  // --- ROBUST RENDERING LOGIC ---
  const gridRows = useMemo(() => {
    // 1. Map cells to a dictionary for quick lookup: rowMap[rowIndex][colIndex] = cell
    const rowMap = new Map<number, Map<number, MatrixCell>>();
    
    // FIX: Enforce STRICTLY 5 rows (0 to 4).
    const FIXED_ROW_COUNT = 5;
    
    cells.forEach(cell => {
      const rIndex = parseRowIndex(cell.fila);
      
      // Safety: Only map cells that fit within our fixed visual grid
      if (rIndex >= 0 && rIndex < FIXED_ROW_COUNT) {
        if (!rowMap.has(rIndex)) {
          rowMap.set(rIndex, new Map());
        }
        // Ensure col is treated as number for lookup
        const cIndex = Number(cell.col);
        rowMap.get(rIndex)!.set(cIndex, cell);
      }
    });

    // 2. Build the normalized 2D array
    const rows = [];
    for (let r = 0; r < FIXED_ROW_COUNT; r++) {
      const cols: (MatrixCell | null)[] = [];
      // We strictly iterate columns 0 to 4
      for (let c = 0; c <= 4; c++) {
        const cell = rowMap.get(r)?.get(c);
        cols.push(cell || null);
      }
      rows.push({ index: r, columns: cols });
    }
    return rows;
  }, [cells]);

  const handleValueChange = (rowIndex: number, colIndex: number, newValue: string) => {
    setCells(prev => {
      const existingIndex = prev.findIndex(c => parseRowIndex(c.fila) === rowIndex && Number(c.col) === colIndex);
      if (existingIndex >= 0) {
        const newCells = [...prev];
        newCells[existingIndex] = { ...newCells[existingIndex], valor: newValue };
        return newCells;
      } else {
        return [...prev, { fila: rowIndex, col: colIndex, valor: newValue, confianza: 1.0 }];
      }
    });
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    bgoLog.step('EDITOR', `Confirmando registro id=${data.id_registro ?? data.id}  celdas_totales=${cells.length}`);
    try {
      // Detectar celdas que cambiaron respecto al OCR original y tienen recorte
      const correccionesConRecorte = cells
        .filter(cell => {
          const original = originalCells.find(
            oc => parseRowIndex(oc.fila) === parseRowIndex(cell.fila) && Number(oc.col) === Number(cell.col)
          );
          const cambio = original && cell.valor !== original.valor;
          const recorte = cell.recorte_b64 || cell.recorte_base64;
          return cambio && cell.ref_id && recorte;
        })
        .map(cell => {
          const original = originalCells.find(
            oc => parseRowIndex(oc.fila) === parseRowIndex(cell.fila) && Number(oc.col) === Number(cell.col)
          );
          return {
            ref_id: cell.ref_id!,
            valor_original: original!.valor,
            valor_corregido: cell.valor,
            recorte_b64: cell.recorte_b64 || cell.recorte_base64 || '',
          };
        });

      if (correccionesConRecorte.length > 0) {
        bgoLog.info('EDITOR', `Enviando ${correccionesConRecorte.length} correcciones con imagen al servidor:`);
        correccionesConRecorte.forEach(c =>
          bgoLog.data('EDITOR', `  ${c.ref_id}`, { original: c.valor_original, corregido: c.valor_corregido, imagen: c.recorte_b64 ? `${Math.round(c.recorte_b64.length/1024)}KB` : 'sin imagen' })
        );
        const baseUrl = localStorage.getItem('bluegrid_api_url') || getApiBaseUrl();
        authFetch(`${baseUrl}/api/v1/training/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_registro: data.id_registro ?? data.id,
            zona_id: Number(data.zona_id) || 1,
            correcciones: correccionesConRecorte,
          }),
        })
          .then(r => bgoLog.info('EDITOR', `Feedback guardado en Supabase: HTTP ${r.status}`))
          .catch(e => bgoLog.error('EDITOR', `Feedback falló: ${e.message}`));
      } else {
        bgoLog.info('EDITOR', 'Sin correcciones con imagen — no se envía feedback');
      }

      await onSave(cells);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="animate-in fade-in zoom-in duration-300 pb-20 w-full">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 pb-6 border-b border-gray-200 dark:border-zinc-800 transition-colors sticky top-16 md:static bg-gray-50 dark:bg-[#050505] z-30 md:z-auto pt-4 md:pt-0">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tighter text-black dark:text-white">Planilla Digitalizada</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="bg-white dark:bg-zinc-900 text-black dark:text-white px-3 py-1 rounded-full text-[10px] font-mono border border-gray-200 dark:border-zinc-800 font-bold uppercase tracking-widest">
              ID: {data.id}
            </span>
            {data.resultado_ia?.tablilla_id && (
              <>
                <span className="hidden md:inline text-gray-300 dark:text-zinc-700">•</span>
                <span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-[10px] font-mono border border-gray-800 dark:border-gray-200 font-bold uppercase tracking-widest">
                  Tabla: {data.resultado_ia.tablilla_id}
                </span>
              </>
            )}
            {data.resultado_ia?.tablilla_id_raw && data.resultado_ia.tablilla_id_raw !== data.resultado_ia.tablilla_id && (
              <span className="text-gray-400 dark:text-zinc-500 text-[10px] font-mono font-bold uppercase tracking-widest">
                Leído: {data.resultado_ia.tablilla_id_raw}
              </span>
            )}
            <span className="hidden md:inline text-gray-300 dark:text-zinc-700">•</span>
            <span className="text-yellow-600 dark:text-yellow-500 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-widest">
              <AlertTriangle className="w-3.5 h-3.5" />
              Validación Requerida
            </span>
            <span className="hidden md:inline text-gray-300 dark:text-zinc-700">•</span>
            <button 
              onClick={() => setShowImage(!showImage)}
              className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-colors"
            >
               {showImage ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
               {showImage ? "Ocultar Imagen" : "Ver Imagen"}
            </button>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto fixed bottom-20 right-4 md:static md:bottom-auto md:right-auto z-40 justify-end md:justify-start pointer-events-none md:pointer-events-auto">
           {/* Mobile Floating Action Buttons or Desktop Static Buttons */}
          <button 
            onClick={onCancel}
            className="pointer-events-auto inline-flex items-center justify-center rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#050505] shadow-lg md:shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white dark:text-gray-200 h-12 md:h-12 w-12 md:w-auto md:px-6 md:py-2"
            title="Descartar"
          >
            <RotateCcw className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Descartar</span>
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="pointer-events-auto inline-flex items-center justify-center rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black dark:focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50 bg-black dark:bg-white text-white dark:text-black shadow-xl hover:bg-gray-800 dark:hover:bg-gray-200 h-12 md:h-12 px-8 md:px-8 py-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 md:mr-2 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4 md:mr-2" />
            )}
            <span className="hidden md:inline">Confirmar</span>
            <span className="md:hidden">Guardar</span>
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#050505]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <Table2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">ID tabla detectado</p>
            <p className="mt-1 text-lg font-bold text-black dark:text-white">
              {data.resultado_ia?.tablilla_id || 'No identificado'}
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-zinc-400">
              {tablillaMeta?.tablilla_encontrada
                ? 'Coincide con una tabla disponible en la BDD.'
                : 'No existe en la BDD. Créala o asígnala desde Usuarios > Tablas asignadas.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#050505]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Ship className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Embarcación asociada</p>
            <p className="mt-1 text-lg font-bold text-black dark:text-white">
              {embarcacionDetectada ? embarcacionDetectada.nombre : 'Sin asociación'}
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-zinc-400">
              {embarcacionDetectada
                ? `Matrícula ${embarcacionDetectada.matricula}`
                : 'La relación no se crea automáticamente; debes asociarla manualmente.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        
        {/* Left Column: Image Reference (Sticky on Desktop) */}
        {showImage && imageUrl && (
          <div className="w-full xl:w-[480px] shrink-0 flex flex-col gap-0 xl:sticky xl:top-24 transition-all duration-300 shadow-sm rounded-[2rem] overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#050505] mb-6 xl:mb-0">
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, resetTransform, state }) => (
                <>
                  <div className="flex items-center justify-between bg-white dark:bg-[#050505] border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
                    <span className="text-[10px] font-bold text-black dark:text-white flex items-center gap-2 uppercase tracking-widest">
                      <ImageIcon className="w-4 h-4" />
                      Referencia Original
                    </span>
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-900 rounded-full p-1 border border-gray-200 dark:border-zinc-800">
                      <button onClick={() => zoomOut()} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors" title="Alejar">
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] text-gray-600 dark:text-gray-300 font-mono w-10 text-center font-bold">
                        {Math.round(state.scale * 100)}%
                      </span>
                      <button onClick={() => zoomIn()} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors" title="Acercar">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => resetTransform()} className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors ml-1 border-l border-gray-200 dark:border-zinc-700 pl-2" title="Ajustar">
                        <Maximize className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-100/50 dark:bg-zinc-900/50 h-[250px] md:h-[300px] xl:h-[calc(100vh-280px)] max-h-[600px] relative overflow-hidden cursor-grab active:cursor-grabbing">
                    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img
                        src={imageUrl}
                        alt="Referencia de Planilla"
                        style={{
                          transform: `rotate(${imageRotation}deg)`,
                          maxWidth: imageRotation === 90 || imageRotation === 270 ? '80%' : '100%',
                          maxHeight: imageRotation === 90 || imageRotation === 270 ? '80%' : '100%',
                          objectFit: 'contain',
                        }}
                        className="pointer-events-none"
                      />
                    </TransformComponent>
                  </div>
                </>
              )}
            </TransformWrapper>
          </div>
        )}

        {/* Right Column: Data Editor */}
        <div className="flex-1 w-full min-w-0">
          
          {/* --- MOBILE CARD VIEW (Block on md-, Hidden on md+) --- */}
          <div className="md:hidden space-y-4">
            {gridRows.map((row) => (
              <div key={`mob-row-${row.index}`} className="bg-white dark:bg-[#050505] border border-gray-200 dark:border-zinc-800 rounded-[2rem] shadow-sm p-6">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-4">
                  <span className="font-semibold text-xl text-black dark:text-white tracking-tighter">Fila {row.index + 1}</span>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-zinc-900 px-2 py-1 rounded-full">R#{row.index}</span>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">N° Nidos</label>
                      {renderMobileInput(row, 0, handleValueChange, originalCells)}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">N° Cuevas</label>
                      {renderMobileInput(row, 1, handleValueChange, originalCells)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                    <label className="text-[10px] font-bold uppercase text-black dark:text-white tracking-widest mb-3 block">Captura Hembras</label>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Nido</label>
                          {renderMobileInput(row, 2, handleValueChange, originalCells)}
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Cueva</label>
                          {renderMobileInput(row, 3, handleValueChange, originalCells)}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Captura Total</label>
                    {renderMobileInput(row, 4, handleValueChange, originalCells)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* --- DESKTOP TABLE VIEW (Hidden on md-, Block on md+) --- */}
          <div className="hidden md:block rounded-[2rem] border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#050505] shadow-sm overflow-hidden transition-colors">
            <table className="w-full border-collapse min-w-[800px] lg:min-w-full">
              <thead className="bg-gray-50/50 dark:bg-zinc-900/50 text-gray-700 dark:text-gray-300">
                <tr>
                  <th rowSpan={2} className="border-b border-r border-gray-200 dark:border-zinc-800 p-4 align-middle w-[18%]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black dark:text-white">N° NIDOS</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      (Hembras c/ Huevos)
                    </div>
                  </th>
                  <th rowSpan={2} className="border-b border-r border-gray-200 dark:border-zinc-800 p-4 align-middle w-[18%]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black dark:text-white">N° CUEVAS<br/>CUBIERTAS</div>
                  </th>
                  <th colSpan={2} className="border-b border-r border-gray-200 dark:border-zinc-800 p-3 align-middle w-[40%]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black dark:text-white">CAPTURA HEMBRAS</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">(Marque)</div>
                  </th>
                  <th rowSpan={2} className="border-b border-gray-200 dark:border-zinc-800 p-4 align-middle w-[24%]">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black dark:text-white">CAPTURA<br/>N° TOTAL PULPOS</div>
                  </th>
                </tr>
                <tr>
                  <th className="border-b border-r border-gray-200 dark:border-zinc-800 p-3 align-middle w-[20%] bg-gray-100/50 dark:bg-zinc-900/80">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">NIDO</div>
                  </th>
                  <th className="border-b border-r border-gray-200 dark:border-zinc-800 p-3 align-middle w-[20%] bg-gray-100/50 dark:bg-zinc-900/80">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">CUEVA</div>
                  </th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                {gridRows.map((row) => (
                  <tr key={`row-${row.index}`} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/30 transition-colors group">
                    {row.columns.map((cell, colIndex) => {
                      // Check strictly for low confidence
                      const isLowConfidence = cell ? cell.confianza < 0.85 : false;
                      const cellValue = cell ? cell.valor : "";
                      const isLastCol = colIndex === 4;
                      
                      // Find original value for data-original attribute
                      const originalCell = originalCells.find(oc => 
                         (typeof oc.fila === 'string' ? parseInt(oc.fila.match(/(\d+)/)?.[1] || "0") - 1 : oc.fila) === row.index && 
                         Number(oc.col) === colIndex
                      );

                      return (
                        <td 
                          key={`cell-${row.index}-${colIndex}`} 
                          className={`
                            border-b ${!isLastCol ? 'border-r' : ''} border-gray-200 dark:border-zinc-800 p-0 h-20 relative
                            ${isLowConfidence ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'bg-white dark:bg-[#050505]'}
                          `}
                        >
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) => handleValueChange(row.index, colIndex, e.target.value)}
                            // Metadata for DOM scraping / Training feedback
                            data-fila={row.index}
                            data-col={colIndex}
                            data-original={originalCell?.valor || ""}
                            data-ref-id={cell?.ref_id || ""}
                            // Removed data-img as per new lightweight architecture
                            className={`
                              w-full h-full text-center text-2xl font-semibold font-mono bg-transparent 
                              border-none outline-none focus:ring-2 focus:ring-inset focus:ring-black dark:focus:ring-white focus:bg-white dark:focus:bg-zinc-900
                              transition-all placeholder-gray-200 dark:placeholder-zinc-800
                              ${isLowConfidence ? 'text-yellow-600 dark:text-yellow-500 bg-yellow-100/20 dark:bg-yellow-900/10' : 'text-black dark:text-white'}
                              ${cellValue.toUpperCase() === 'X' ? 'text-3xl text-gray-400 dark:text-zinc-600' : ''}
                            `}
                          />
                          {isLowConfidence && cellValue !== "" && (
                            <div className="absolute top-2 right-2 z-10" title={`Confianza baja: ${Math.round((cell?.confianza || 0) * 100)}%`}>
                              <AlertCircle className="w-4 h-4 text-yellow-500" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-[2rem] border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#050505] p-6 flex items-start gap-4 shadow-sm transition-colors">
            <div className="p-3 bg-gray-50 dark:bg-zinc-900 rounded-2xl shrink-0">
               <AlertCircle className="h-5 w-5 text-black dark:text-white" />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 pt-1">
              <p className="font-semibold text-black dark:text-white mb-2">Guía de Validación Visual</p>
              <p className="leading-relaxed">
                Compare los datos extraídos con la imagen de referencia.
                Las celdas marcadas en <span className="inline-flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-md border border-yellow-200 dark:border-yellow-700 font-bold text-[10px] uppercase tracking-widest mx-1">AMARILLO</span> indican baja confianza del sistema OCR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for mobile inputs to keep JSX clean
function renderMobileInput(
  row: {index: number, columns: (MatrixCell | null)[]}, 
  colIndex: number, 
  onChange: (r: number, c: number, v: string) => void,
  originalCells: MatrixCell[]
) {
  const cell = row.columns[colIndex];
  const isLowConfidence = cell ? cell.confianza < 0.85 : false;
  const val = cell ? cell.valor : "";
  
  // Find original value for data-original attribute
  const originalCell = originalCells.find(oc => 
     (typeof oc.fila === 'string' ? parseInt(oc.fila.match(/(\d+)/)?.[1] || "0") - 1 : oc.fila) === row.index && 
     Number(oc.col) === colIndex
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={val}
        onChange={(e) => onChange(row.index, colIndex, e.target.value)}
        // Metadata for DOM scraping / Training feedback
        data-fila={row.index}
        data-col={colIndex}
        data-original={originalCell?.valor || ""}
        data-ref-id={cell?.ref_id || ""}
        // Removed data-img for lightweight architecture
        className={`
          w-full h-14 text-center text-xl font-semibold font-mono rounded-2xl border 
          focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all
          ${isLowConfidence 
            ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-500' 
            : 'bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-black dark:text-white'
          }
        `}
      />
      {isLowConfidence && val !== "" && (
        <div className="absolute top-2 right-2">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        </div>
      )}
    </div>
  );
}

export default MatrixEditor;
