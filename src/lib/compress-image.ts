import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from "./card/image";

const MAX_INPUT_BYTES = 30 * 1024 * 1024;

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Re-encodes any image the browser can decode as a JPEG of at most 1MB. */
export async function compressImage(file: File): Promise<string> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("too-large");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 6; round += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas");
      ctx.fillStyle = "#fff"; // JPEG has no alpha
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
        if (blob && blob.size <= MAX_IMAGE_BYTES) return toDataUrl(blob);
      }
      scale *= 0.7;
    }
    throw new Error("too-large");
  } finally {
    bitmap.close();
  }
}
