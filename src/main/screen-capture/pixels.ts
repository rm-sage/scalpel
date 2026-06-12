/** Convert a BGRA buffer (what Electron's nativeImage.toBitmap returns) to an
 *  RGBA Uint8ClampedArray ready for `new ImageData(...)`. Allocates a fresh
 *  array; does not mutate the input. */
export function bgraToRgba(bgra: Buffer | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bgra.length)
  for (let i = 0; i < bgra.length; i += 4) {
    out[i] = bgra[i + 2] // R
    out[i + 1] = bgra[i + 1] // G
    out[i + 2] = bgra[i] // B
    out[i + 3] = bgra[i + 3] // A
  }
  return out
}

export interface CroppedFrame {
  data: Buffer
  width: number
  height: number
}

/** Crop a row-major RGBA/BGRA frame (4 bytes/px) to `rect` in frame px. The
 *  rect is clamped to the frame bounds; a rect fully outside returns a 0-sized
 *  frame. Channel order is preserved (this is a pure memory copy). */
export function cropFrame(
  data: Buffer | Uint8Array,
  frameWidth: number,
  rect: { x: number; y: number; width: number; height: number },
): CroppedFrame {
  const frameHeight = data.length / 4 / frameWidth
  const x0 = Math.max(0, Math.min(rect.x, frameWidth))
  const y0 = Math.max(0, Math.min(rect.y, frameHeight))
  const x1 = Math.max(x0, Math.min(rect.x + rect.width, frameWidth))
  const y1 = Math.max(y0, Math.min(rect.y + rect.height, frameHeight))
  const w = x1 - x0
  const h = y1 - y0
  const out = Buffer.allocUnsafe(w * h * 4)
  const srcBuf = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  for (let y = 0; y < h; y++) {
    const srcStart = ((y0 + y) * frameWidth + x0) * 4
    srcBuf.copy(out, y * w * 4, srcStart, srcStart + w * 4)
  }
  return { data: out, width: w, height: h }
}
