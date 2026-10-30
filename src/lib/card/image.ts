export const MAX_IMAGE_BYTES = 1_000_000;
/** The browser compressor never emits a longer side, so nothing legitimate is larger. */
export const MAX_IMAGE_SIDE = 1600;
// 4/3 of the byte limit plus the data URL prefix; rejected before any decoding.
const MAX_DATA_URL_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 32;

export type ParsedImage = { format: "jpg"; bytes: Uint8Array; width: number; height: number };

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // SOF0..SOF15 except DHT, JPG and DAC, which share the number range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const components = b[i + 9];
      // CMYK JPEGs print inverted, so only gray and RGB/YCbCr are accepted.
      if (components !== 1 && components !== 3) return null;
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

/**
 * Accepts only base64 data URLs of real JPEG files, the one format the browser compressor
 * emits. The magic bytes must match, so a remote URL can never reach the PDF renderer,
 * which would fetch it, and PNG, which the renderer decodes in full, never does either.
 */
export function parseImageDataUrl(url: string): ParsedImage | null {
  if (url.length > MAX_DATA_URL_CHARS) return null;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  const size = jpegSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return null;
  if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) return null;
  return { format: "jpg", bytes, ...size };
}
