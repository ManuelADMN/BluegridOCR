/**
 * Servicio de preprocesamiento de imágenes para la digitalización de tablillas.
 *
 * Extraído de App.tsx para poder probarlo de forma aislada. La línea base de calidad
 * (1920px / 0.92) es deliberada: comprimir más agresivamente desatura los 4 puntos rojos
 * de las esquinas y rompe la detección/rectificado (warp) en el backend. NO reducir sin
 * comparar imágenes de referencia.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Debe coincidir con el backend (operations.py MAX_UPLOAD_SIZE_BYTES = 8MB).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MIN_UPLOAD_BYTES = 8 * 1024; // por debajo de 8KB casi seguro es una captura fallida
// Resolución mínima util para leer una grilla 5x5 con 4 esquinas.
export const MIN_DIMENSION = 640;

// Línea base de compresión (ver nota arriba).
export const COMPRESS_MAX_PX = 1920;
export const COMPRESS_QUALITY = 0.92;

// Umbrales de análisis de píxel (0-255). Son heurísticos: generan avisos, no bloqueos.
const DARK_LUMA = 45;
const BRIGHT_LUMA = 215;
const BLUR_GRADIENT = 6; // gradiente medio bajo ⇒ probable desenfoque

export interface ImageMeta {
  width: number;
  height: number;
  /** Luminancia media 0-255 (undefined si no se pudo muestrear). */
  luma?: number;
  /** Gradiente medio como proxy de nitidez (undefined si no se pudo muestrear). */
  gradient?: number;
}

export interface ImageAnalysis {
  ok: boolean;
  /** Bloquean el envío. */
  errors: string[];
  /** No bloquean, pero se muestran al usuario. */
  warnings: string[];
  meta?: ImageMeta;
}

// ── Chequeos puros (fáciles de testear sin decodificar imágenes) ─────────────

export const checkFormat = (type: string): string | null =>
  (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)
    ? null
    : 'Formato no permitido. Usa una foto JPG, PNG o WEBP.';

export const checkSize = (bytes: number): string | null => {
  if (bytes > MAX_UPLOAD_BYTES) return 'La imagen supera los 8 MB. Reduce la resolución o vuelve a capturar.';
  if (bytes < MIN_UPLOAD_BYTES) return 'La imagen es demasiado pequeña o está vacía. Vuelve a capturar.';
  return null;
};

export const checkResolution = (width: number, height: number): string | null =>
  width < MIN_DIMENSION || height < MIN_DIMENSION
    ? 'Resolución insuficiente. Acércate a la tablilla para que la grilla se vea nítida.'
    : null;

/**
 * Sólo conoce el formato del archivo, no la orientación de la tablilla dentro de la foto.
 * Por eso el aviso pide revisión visual y nunca ordena rotar automáticamente.
 */
export const checkOrientation = (width: number, height: number): string | null =>
  height > width * 1.1
    ? 'La foto está en formato vertical. Confirma que la tablilla se vea horizontal; no la gires si ya está correctamente orientada.'
    : null;

export const checkExposure = (luma?: number): string | null => {
  if (luma === undefined) return null;
  if (luma < DARK_LUMA) return 'La foto está muy oscura. Mejora la iluminación y evita sombras.';
  if (luma > BRIGHT_LUMA) return 'La foto está sobreexpuesta o con reflejos. Evita el flash directo y los brillos.';
  return null;
};

export const checkSharpness = (gradient?: number): string | null =>
  gradient !== undefined && gradient < BLUR_GRADIENT
    ? 'La imagen parece desenfocada. Mantén firme la cámara y vuelve a enfocar.'
    : null;

// ── Análisis con decodificación (requiere DOM/canvas) ────────────────────────

/**
 * Muestrea la imagen en un canvas reducido y devuelve dimensiones reales,
 * luminancia media y un proxy de nitidez. Best-effort: si el navegador no permite
 * leer los píxeles, devuelve solo width/height.
 */
export const loadImageMeta = (file: File): Promise<ImageMeta> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      try {
        const sample = 64;
        const canvas = document.createElement('canvas');
        canvas.width = sample;
        canvas.height = sample;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ width, height });
        ctx.drawImage(img, 0, 0, sample, sample);
        const { data } = ctx.getImageData(0, 0, sample, sample);

        const gray: number[] = new Array(sample * sample);
        let sum = 0;
        for (let i = 0; i < sample * sample; i++) {
          const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
          const y = 0.299 * r + 0.587 * g + 0.114 * b;
          gray[i] = y;
          sum += y;
        }
        const luma = sum / (sample * sample);

        // Gradiente medio (diferencia con el vecino derecho e inferior).
        let gradSum = 0, gradCount = 0;
        for (let y = 0; y < sample; y++) {
          for (let x = 0; x < sample; x++) {
            const idx = y * sample + x;
            if (x + 1 < sample) { gradSum += Math.abs(gray[idx] - gray[idx + 1]); gradCount++; }
            if (y + 1 < sample) { gradSum += Math.abs(gray[idx] - gray[idx + sample]); gradCount++; }
          }
        }
        const gradient = gradCount ? gradSum / gradCount : undefined;
        resolve({ width, height, luma, gradient });
      } catch {
        // getImageData puede fallar por CORS/seguridad: devolvemos lo básico.
        resolve({ width, height });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });

/**
 * Valida un archivo antes de enviarlo al motor OCR. Errores bloquean; los avisos no.
 * No decide por el usuario: nunca envía automáticamente algo claramente inválido, pero
 * permite continuar ante avisos (orientación, exposición, posible desenfoque).
 */
export const analyzeImage = async (file: File): Promise<ImageAnalysis> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const formatError = checkFormat(file.type);
  if (formatError) errors.push(formatError);
  const sizeError = checkSize(file.size);
  if (sizeError) errors.push(sizeError);

  // Sin formato/tamaño válidos no tiene sentido decodificar.
  if (errors.length) return { ok: false, errors, warnings };

  let meta: ImageMeta | undefined;
  try {
    meta = await loadImageMeta(file);
  } catch (e: any) {
    errors.push(e?.message || 'No se pudo procesar la imagen.');
    return { ok: false, errors, warnings };
  }

  const resolutionError = checkResolution(meta.width, meta.height);
  if (resolutionError) errors.push(resolutionError);

  [
    checkOrientation(meta.width, meta.height),
    checkExposure(meta.luma),
    checkSharpness(meta.gradient),
  ].forEach(msg => { if (msg) warnings.push(msg); });

  return { ok: errors.length === 0, errors, warnings, meta };
};

/**
 * Comprime y (opcionalmente) rota la imagen. Mantiene 1920px / 0.92 como línea base.
 * `rotation` en grados (0/90/180/270). No bloquea el hilo perceptiblemente: el trabajo
 * pesado ocurre en `canvas.toBlob` de forma asíncrona.
 */
export const compressImage = (file: File, rotation = 0): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const swapped = rotation === 90 || rotation === 270;

      let drawW = img.width;
      let drawH = img.height;
      if (drawW > COMPRESS_MAX_PX || drawH > COMPRESS_MAX_PX) {
        const scale = Math.min(COMPRESS_MAX_PX / drawW, COMPRESS_MAX_PX / drawH);
        drawW = Math.round(drawW * scale);
        drawH = Math.round(drawH * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = swapped ? drawH : drawW;
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
        COMPRESS_QUALITY
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al leer imagen')); };
    img.src = url;
  });
