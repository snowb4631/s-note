import { deflateSync } from "node:zlib";

/** Smallest structurally valid baseline JPEG header for parser tests (not decodable pixels). */
export function jpegDataUrl(width: number, height: number): string {
  const bytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ]);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A real decodable RGB PNG. Filled with `rgb`; pixel data is skipped for absurd dimensions. */
export function pngBuffer(width: number, height: number, rgb: [number, number, number] = [120, 170, 220]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const small = width * height < 4_000_000;
  const raw = Buffer.alloc(small ? (width * 3 + 1) * height : 1);
  if (small) {
    for (let y = 0; y < height; y += 1) {
      const row = y * (width * 3 + 1);
      for (let x = 0; x < width; x += 1) raw.set(rgb, row + 1 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function pngDataUrl(width: number, height: number): string {
  return `data:image/png;base64,${pngBuffer(width, height).toString("base64")}`;
}
