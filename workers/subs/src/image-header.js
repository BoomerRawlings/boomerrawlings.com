import { Problem, requireValue } from './validation.js';

// Header inspection is deliberately bounded. Full decoding/sharpness is performed by
// the local verifier; declared dimensions alone cannot turn a thumbnail into an original.
export function dimensions(bytes, type) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), ascii = (a, n) => new TextDecoder().decode(bytes.slice(a, a + n));
  if (type === 'image/png' && bytes.length >= 24) {
    requireValue(bytes[0] === 137 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR', 'Invalid PNG header.', 'invalid_image', 422);
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (type === 'image/webp' && bytes.length >= 30) {
    requireValue(ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP', 'Invalid WebP header.', 'invalid_image', 422);
    if (ascii(12, 4) === 'VP8X') return [1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)];
    if (ascii(12, 4) === 'VP8L') return [1 + bytes[21] + ((bytes[22] & 63) << 8), 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)];
    if (ascii(12, 4) === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return [view.getUint16(26, true) & 16383, view.getUint16(28, true) & 16383];
    throw new Problem(422, 'invalid_image', 'Unsupported WebP header.');
  }
  if (type === 'image/jpeg' && bytes.length >= 4) {
    requireValue(bytes[0] === 255 && bytes[1] === 216, 'Invalid JPEG header.', 'invalid_image', 422);
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 255) throw new Problem(422, 'invalid_image', 'Malformed JPEG marker.');
      while (bytes[at] === 255) at++;
      const marker = bytes[at++]; if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) return null;
      const length = view.getUint16(at); requireValue(length >= 2, 'Malformed JPEG segment.', 'invalid_image', 422);
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (at + 7 > bytes.length) return null; return [view.getUint16(at + 5), view.getUint16(at + 3)];
      }
      at += length;
    }
  }
  if (type === 'image/tiff' && bytes.length >= 8) {
    const little = ascii(0, 2) === 'II'; requireValue(little || ascii(0, 2) === 'MM', 'Invalid TIFF header.', 'invalid_image', 422);
    requireValue(view.getUint16(2, little) === 42, 'Classic TIFF required; convert BigTIFF in the local pipeline.', 'invalid_image', 422);
    const at = view.getUint32(4, little); if (at + 2 > bytes.length) return null;
    const count = view.getUint16(at, little); let width, height;
    for (let n = 0; n < count; n++) {
      const pos = at + 2 + 12 * n; if (pos + 12 > bytes.length) return null;
      const tag = view.getUint16(pos, little), format = view.getUint16(pos + 2, little), size = view.getUint32(pos + 4, little);
      if ((tag === 256 || tag === 257) && size === 1 && [3, 4].includes(format)) { const value = format === 3 ? view.getUint16(pos + 8, little) : view.getUint32(pos + 8, little); if (tag === 256) width = value; else height = value; }
    }
    if (width && height) return [width, height];
  }
  return null;
}
export async function inspectedStream(input, length, type) {
  const reader = input.getReader(), chunks = []; let total = 0, info;
  while (!info && total < Math.min(length, 1024 * 1024)) {
    const { done, value } = await reader.read(); if (done) break;
    chunks.push(value); total += value.byteLength;
    const prefix = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { prefix.set(chunk, offset); offset += chunk.byteLength; }
    try { info = dimensions(prefix, type); } catch (error) { await reader.cancel(); throw error; }
  }
  if (!info || !info.every(n => Number.isInteger(n) && n > 0 && n <= 100000)) { await reader.cancel(); throw new Problem(422, 'invalid_image', 'Native image dimensions could not be verified within the header limit.'); }
  const stream = new FixedLengthStream(length), writer = stream.writable.getWriter();
  const pumping = (async () => {
    try { for (const chunk of chunks) await writer.write(chunk); while (true) { const { done, value } = await reader.read(); if (done) break; await writer.write(value); } await writer.close(); }
    catch (error) { await reader.cancel().catch(() => {}); await writer.abort(error).catch(() => {}); throw error; }
  })();
  return { dimensions: info, stream: stream.readable, pumping, cancel: async () => { await reader.cancel(); await writer.abort(); } };
}
