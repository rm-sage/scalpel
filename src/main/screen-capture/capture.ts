import { desktopCapturer, screen } from 'electron'
import { OverlayController } from 'electron-overlay-window'

/** A captured game-window frame. `data` is BGRA, row-major, (0,0) at the game
 *  window's top-left. `width`/`height` are the frame's px dimensions (downscaled
 *  from physical when the window is taller than MAX_CAPTURE_HEIGHT). `gameSize`
 *  is the full game window in CSS px; `scale` is captured-frame px per CSS px. */
export interface CaptureFrame {
  data: Buffer
  width: number
  height: number
  gameSize: { width: number; height: number }
  scale: number
}

/** Cap the captured game-window height so the synchronous toBitmap copy stays
 *  fast. toBitmap runs on the main-process event loop, and an oversized copy
 *  hitches overlay mouse handling. 1080 is a no-op at <= 1080p. */
const MAX_CAPTURE_HEIGHT = 1080

/** Capture the focused game window as a BGRA frame cropped to the window rect.
 *  Null when the game isn't focused or no usable frame is available. */
export async function captureGameWindow(): Promise<CaptureFrame | null> {
  if (!OverlayController.targetHasFocus) return null
  const tb = OverlayController.targetBounds
  if (!tb?.width || !tb.height) return null

  try {
    const display = screen.getDisplayNearestPoint({ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 })
    const sf = display.scaleFactor
    const capScale = Math.min(1, MAX_CAPTURE_HEIGHT / tb.height)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * sf * capScale),
        height: Math.round(display.size.height * sf * capScale),
      },
    })
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (!source) return null

    const img = source.thumbnail
    const full = img.getSize()
    if (full.width === 0 || full.height === 0) return null
    const bmp = img.toBitmap() // BGRA, row-major

    const winDip = screen.screenToDipPoint({ x: tb.x, y: tb.y })
    const tpdX = full.width / display.size.width
    const tpdY = full.height / display.size.height
    const ox = Math.round((winDip.x - display.bounds.x) * tpdX)
    const oy = Math.round((winDip.y - display.bounds.y) * tpdY)
    const w = Math.min(Math.round((tb.width / sf) * tpdX), full.width - ox)
    const h = Math.min(Math.round((tb.height / sf) * tpdY), full.height - oy)
    if (w <= 0 || h <= 0 || ox < 0 || oy < 0) return null

    const out = Buffer.allocUnsafe(w * h * 4)
    for (let y = 0; y < h; y++) {
      const srcStart = ((oy + y) * full.width + ox) * 4
      bmp.copy(out, y * w * 4, srcStart, srcStart + w * 4)
    }
    const gameSize = { width: Math.round(tb.width / sf), height: Math.round(tb.height / sf) }
    // Captured-frame px per CSS px: frame width spans the full game window's CSS
    // width. Single scalar; assumes a proportional thumbnail (tpdX == tpdY).
    const scale = w / gameSize.width
    return { data: out, width: w, height: h, gameSize, scale }
  } catch (err) {
    if (process.env.SCALPEL_DEBUG_LOG) console.error('[screen-capture] capture failed', err)
    return null
  }
}
