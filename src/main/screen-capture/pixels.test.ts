import { describe, expect, it } from 'vitest'
import { bgraToRgba, cropFrame } from './pixels'

describe('bgraToRgba', () => {
  it('swaps B and R channels, preserves G and A, returns a Uint8ClampedArray', () => {
    // one pixel: B=1 G=2 R=3 A=4  ->  R=3 G=2 B=1 A=4
    const out = bgraToRgba(Buffer.from([1, 2, 3, 4]))
    expect(Array.from(out)).toEqual([3, 2, 1, 4])
    expect(out).toBeInstanceOf(Uint8ClampedArray)
  })

  it('handles multiple pixels', () => {
    const out = bgraToRgba(Buffer.from([10, 20, 30, 40, 50, 60, 70, 80]))
    expect(Array.from(out)).toEqual([30, 20, 10, 40, 70, 60, 50, 80])
  })
})

describe('cropFrame', () => {
  // 3x2 frame, 4 bytes/px, value = 100 + (y*3 + x) so each pixel is identifiable by its R byte
  const W = 3
  const H = 2
  const src = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = 100 + (y * W + x)
      const o = (y * W + x) * 4
      src[o] = v // R
      src[o + 1] = 0
      src[o + 2] = 0
      src[o + 3] = 255
    }
  }

  it('extracts a sub-rectangle in frame px', () => {
    // crop the right 2x1 of the top row: pixels (1,0) and (2,0) -> R = 101, 102
    const cropped = cropFrame(src, W, { x: 1, y: 0, width: 2, height: 1 })
    expect(cropped.width).toBe(2)
    expect(cropped.height).toBe(1)
    expect(cropped.data[0]).toBe(101)
    expect(cropped.data[4]).toBe(102)
  })

  it('clamps a region that runs past the frame edge', () => {
    const cropped = cropFrame(src, W, { x: 2, y: 1, width: 5, height: 5 })
    expect(cropped.width).toBe(1)
    expect(cropped.height).toBe(1)
    expect(cropped.data[0]).toBe(105) // pixel (2,1) -> 100 + (1*3 + 2)
  })
})
