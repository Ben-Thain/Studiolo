/**
 * Client-side image preparation (prompt 06). Decode, orient, resize, encode.
 * HEIC/HEIF goes through a lazy converter; a failed conversion is unsupported.
 */

export const UNSUPPORTED_PHOTO =
  "This photo type isn't supported. Try a JPG or PNG.";
export const PHOTO_TOO_LARGE =
  "This photo is too large, even after compressing.";

const MAX_EDGE = 2560;
const MAX_BYTES = 8 * 1024 * 1024;

export type PreparedImage = {
  blob: Blob;
  mime: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
  blurDataUrl: string;
};

export function assertEncodedSize(bytes: number): void {
  if (bytes > MAX_BYTES) throw new Error(PHOTO_TOO_LARGE);
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

function isRaster(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.startsWith("image/") && type !== "image/svg+xml" && !isHeic(file);
}

async function convertHeic(file: File): Promise<Blob> {
  // Resolved at runtime so the editor chunk does not require the package
  // to exist when the page is compiled.
  const load = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{
    default: (options: {
      blob: Blob;
      toType?: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;
  }>;
  const result = await (
    await load("heic2any")
  ).default({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  return Array.isArray(result) ? result[0]! : result;
}

function fittedSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function encode(canvas: HTMLCanvasElement): Promise<{
  blob: Blob;
  mime: "image/webp" | "image/jpeg";
}> {
  const webp = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.82);
  });
  if (webp) return { blob: webp, mime: "image/webp" };
  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
  });
  if (!jpeg) throw new Error(UNSUPPORTED_PHOTO);
  return { blob: jpeg, mime: "image/jpeg" };
}

function blurDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 20;
  canvas.height = Math.max(1, Math.round((20 * height) / Math.max(1, width)));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.5);
}

/** Decode, resize the long edge to 2560px, strip metadata by re-encoding. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let source: Blob = file;
  if (isHeic(file)) {
    try {
      source = await convertHeic(file);
    } catch {
      throw new Error(UNSUPPORTED_PHOTO);
    }
  } else if (!isRaster(file)) {
    throw new Error(UNSUPPORTED_PHOTO);
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error(UNSUPPORTED_PHOTO);
  }
  const bitmap = await createImageBitmap(source);
  const size = fittedSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(UNSUPPORTED_PHOTO);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  const encoded = await encode(canvas);
  assertEncodedSize(encoded.blob.size);
  return {
    blob: encoded.blob,
    mime: encoded.mime,
    width: size.width,
    height: size.height,
    bytes: encoded.blob.size,
    blurDataUrl: blurDataUrl(canvas, size.width, size.height),
  };
}
