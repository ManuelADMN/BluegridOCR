import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  checkFormat,
  checkSize,
  checkResolution,
  checkOrientation,
  checkExposure,
  checkSharpness,
  compressImage,
  analyzeImage,
} from "../../services/imageProcessing";

// Genera un File real (JPEG) desde un canvas con un color/patrón dado.
function makeImageFile(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(new File([blob!], "tablilla.jpg", { type: "image/jpeg" })), "image/jpeg", 0.95);
  });
}

describe("image validation (pure checks)", () => {
  it("accepts the allowed formats and rejects others", () => {
    ALLOWED_IMAGE_TYPES.forEach(type => expect(checkFormat(type)).toBeNull());
    expect(checkFormat("image/gif")).not.toBeNull();
    expect(checkFormat("application/pdf")).not.toBeNull();
  });

  it("rejects files above the backend size limit and empty ones", () => {
    expect(checkSize(MAX_UPLOAD_BYTES + 1)).not.toBeNull();
    expect(checkSize(10)).not.toBeNull();
    expect(checkSize(500 * 1024)).toBeNull();
  });

  it("rejects resolutions below the readable minimum", () => {
    expect(checkResolution(MIN_DIMENSION - 1, 1000)).not.toBeNull();
    expect(checkResolution(1000, MIN_DIMENSION - 1)).not.toBeNull();
    expect(checkResolution(1000, 800)).toBeNull();
  });

  it("asks for visual confirmation for portrait photos without assuming the tablilla is rotated", () => {
    const warning = checkOrientation(800, 1200);
    expect(warning).toContain("Confirma que la tablilla se vea horizontal");
    expect(warning).toContain("no la gires si ya está correctamente orientada");
    expect(checkOrientation(1200, 800)).toBeNull();
    expect(checkOrientation(1000, 1000)).toBeNull();
  });

  it("warns on dark and overexposed images only", () => {
    expect(checkExposure(10)).not.toBeNull();
    expect(checkExposure(250)).not.toBeNull();
    expect(checkExposure(128)).toBeNull();
    expect(checkExposure(undefined)).toBeNull();
  });

  it("warns on low-gradient (blurry) images only", () => {
    expect(checkSharpness(1)).not.toBeNull();
    expect(checkSharpness(50)).toBeNull();
    expect(checkSharpness(undefined)).toBeNull();
  });
});

describe("image analysis (canvas)", () => {
  it("flags a low-resolution image as not sendable", async () => {
    const file = await makeImageFile(320, 240, ctx => {
      ctx.fillStyle = "#888";
      ctx.fillRect(0, 0, 320, 240);
    });
    const result = await analyzeImage(file);
    expect(result.ok).toBeFalse();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts a sufficiently large, well-exposed, detailed image", async () => {
    const file = await makeImageFile(1000, 800, ctx => {
      // Patrón de tablero para asegurar gradiente (nitidez) y luminancia media.
      for (let y = 0; y < 800; y += 20) {
        for (let x = 0; x < 1000; x += 20) {
          ctx.fillStyle = (x / 20 + y / 20) % 2 === 0 ? "#303030" : "#d0d0d0";
          ctx.fillRect(x, y, 20, 20);
        }
      }
    });
    const result = await analyzeImage(file);
    expect(result.ok).toBeTrue();
    expect(result.meta!.width).toBe(1000);
    expect(result.meta!.height).toBe(800);
  });
});

describe("image compression", () => {
  it("produces a JPEG blob and caps the long edge at 1920px", async () => {
    const file = await makeImageFile(4000, 2000, ctx => {
      ctx.fillStyle = "#123456";
      ctx.fillRect(0, 0, 4000, 2000);
    });
    const blob = await compressImage(file, 0);
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeGreaterThan(0);

    const bitmap = await createImageBitmap(blob);
    expect(Math.max(bitmap.width, bitmap.height)).toBeLessThanOrEqual(1920);
    expect(bitmap.width).toBe(1920);
    expect(bitmap.height).toBe(960);
  });

  it("swaps dimensions when rotating 90°", async () => {
    const file = await makeImageFile(1200, 600, ctx => {
      ctx.fillStyle = "#654321";
      ctx.fillRect(0, 0, 1200, 600);
    });
    const blob = await compressImage(file, 90);
    const bitmap = await createImageBitmap(blob);
    // La imagen original es apaisada; rotada 90° el alto pasa a ser el mayor.
    expect(bitmap.height).toBeGreaterThan(bitmap.width);
  });
});
