import { ipcMain } from 'electron'
import type { GameCapture, GameRect } from '../../plugin-sdk/src/types'
import { captureGameWindow, type CaptureFrame } from '../screen-capture/capture'
import { bgraToRgba, cropFrame } from '../screen-capture/pixels'

/** Map a BGRA CaptureFrame to the plugin-facing RGBA GameCapture, optionally
 *  cropping to `region` (game CSS px). Pure; the IPC handler is glue around it. */
export function frameToCapture(frame: CaptureFrame, region: GameRect | undefined): GameCapture {
  if (!region) {
    return {
      pixels: bgraToRgba(frame.data),
      width: frame.width,
      height: frame.height,
      origin: { x: 0, y: 0 },
      gameSize: frame.gameSize,
      scale: frame.scale,
    }
  }
  // region is CSS px; convert to frame px via scale, then crop.
  const cropped = cropFrame(frame.data, frame.width, {
    x: Math.round(region.x * frame.scale),
    y: Math.round(region.y * frame.scale),
    width: Math.round(region.width * frame.scale),
    height: Math.round(region.height * frame.scale),
  })
  return {
    pixels: bgraToRgba(cropped.data),
    width: cropped.width,
    height: cropped.height,
    origin: { x: region.x, y: region.y },
    gameSize: frame.gameSize,
    scale: frame.scale,
  }
}

export function registerPluginCaptureHandlers(): void {
  ipcMain.handle(
    'plugins:capture-game-window',
    async (_evt, region: GameRect | undefined): Promise<GameCapture | null> => {
      const frame = await captureGameWindow()
      if (!frame) return null
      return frameToCapture(frame, region)
    },
  )
}
