import { describe, expect, it } from 'vitest'
import { frameToCapture } from './plugin-capture'
import type { CaptureFrame } from '../screen-capture/capture'

function frame(): CaptureFrame {
  // 2x1 BGRA frame: px0 = B1 G2 R3 A4, px1 = B5 G6 R7 A8
  return {
    data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
    width: 2,
    height: 1,
    gameSize: { width: 2, height: 1 },
    scale: 1,
  }
}

describe('frameToCapture', () => {
  it('returns the full frame as RGBA with geometry when no region given', () => {
    const cap = frameToCapture(frame(), undefined)
    expect(Array.from(cap.pixels)).toEqual([3, 2, 1, 4, 7, 6, 5, 8])
    expect(cap.width).toBe(2)
    expect(cap.height).toBe(1)
    expect(cap.origin).toEqual({ x: 0, y: 0 })
    expect(cap.gameSize).toEqual({ width: 2, height: 1 })
    expect(cap.scale).toBe(1)
  })

  it('crops to a region given in CSS px and reports the CSS origin', () => {
    const cap = frameToCapture(frame(), { x: 1, y: 0, width: 1, height: 1 })
    expect(Array.from(cap.pixels)).toEqual([7, 6, 5, 8]) // just px1, RGBA
    expect(cap.width).toBe(1)
    expect(cap.origin).toEqual({ x: 1, y: 0 })
    expect(cap.gameSize).toEqual({ width: 2, height: 1 }) // full game, unchanged
  })
})
