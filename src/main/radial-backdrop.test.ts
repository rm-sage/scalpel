import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureFrame } from './screen-capture/capture'

/** Minimal nativeImage stand-in that reports the size it was built at, so the
 *  tests can see both the crop the encoder was handed and the downscale. */
function fakeImage(width: number, height: number): unknown {
  return {
    resize: (o: { width: number; height: number }) => fakeImage(o.width, o.height),
    // Padded past the encoder's own too-short-to-be-an-image guard.
    toJPEG: () => Buffer.from(`${width}x${height}|paddingpaddingpaddingpadding`),
  }
}

vi.mock('electron', () => ({
  nativeImage: {
    createFromBitmap: (_buf: Buffer, o: { width: number; height: number }) => fakeImage(o.width, o.height),
  },
}))

vi.mock('./screen-capture/capture', () => ({ captureGameWindowResult: vi.fn() }))

import type { RadialBackdropImage } from '@shared/contracts/radial'
import { captureRadialBackdrop } from './radial-backdrop'
import { captureGameWindowResult } from './screen-capture/capture'

/** A game window `css` CSS px square, captured at `scale` frame px per CSS px.
 *  The buffer is the right length and nothing reads its contents - every
 *  assertion here is about geometry, and cropFrame is covered on its own. */
function frame(css: number, scale: number): CaptureFrame {
  const side = css * scale
  return {
    data: Buffer.alloc(side * side * 4),
    width: side,
    height: side,
    gameSize: { width: css, height: css },
    scale,
  }
}

/** Hand back the image, failing the test if the capture reported a gate instead
 *  - every geometry assertion below is meaningless on a failure result. */
function image(out: Awaited<ReturnType<typeof captureRadialBackdrop>>): RadialBackdropImage {
  expect(out && 'dataUrl' in out).toBe(true)
  return out as RadialBackdropImage
}

/** The image size the encoder was handed, recovered from the fake data URL. */
function encodedSize(dataUrl: string): string {
  const prefix = 'data:image/jpeg;base64,'
  return Buffer.from(dataUrl.slice(prefix.length), 'base64').toString().split('|')[0]
}

beforeEach(() => vi.clearAllMocks())

describe('captureRadialBackdrop', () => {
  it('cuts a square around the open point and reports it in game CSS px', async () => {
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 1) })
    const out = await captureRadialBackdrop({ x: 500, y: 400 }, 280)
    expect(out).toMatchObject({ origin: { x: 220, y: 120 }, width: 560, height: 560 })
    // Encoded at its own physical size, NOT knocked down to a thumbnail: the
    // renderer stretches this back onto the same 560 CSS px it was cut from, so
    // every pixel dropped here is detail the disc can never show again.
    expect(encodedSize(image(out).dataUrl)).toBe('560x560')
    expect(image(out).dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('caps a high-DPI crop at the encode ceiling', async () => {
    // 1.5x display: the crop is 840 physical px, over the 640 ceiling.
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 1.5) })
    const out = await captureRadialBackdrop({ x: 500, y: 400 }, 280)
    expect(out).toMatchObject({ origin: { x: 220, y: 120 }, width: 560, height: 560 })
    expect(encodedSize(image(out).dataUrl)).toBe('640x640')
  })

  it('reports where the crop really landed when the open point is near a corner', async () => {
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 1) })
    const out = await captureRadialBackdrop({ x: 50, y: 50 }, 280)
    // Not centred on the cursor and not 560 wide - which is exactly why the
    // renderer positions by this origin instead of assuming main's crop rule.
    expect(out).toMatchObject({ origin: { x: 0, y: 0 }, width: 330, height: 330 })
  })

  it('round-trips CSS px through a downscaled capture frame', async () => {
    // Tall windows come back at MAX_CAPTURE_HEIGHT, so the frame is smaller
    // than the game. Getting frame.scale wrong here would offset the backdrop
    // from the pixels it is supposed to be covering.
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 0.5) })
    const out = await captureRadialBackdrop({ x: 500, y: 400 }, 280)
    expect(out).toMatchObject({ origin: { x: 220, y: 120 }, width: 560, height: 560 })
    // Half-resolution frame, so the crop really is 280px - the encoder passes
    // it through rather than inventing detail that was never captured.
    expect(encodedSize(image(out).dataUrl)).toBe('280x280')
  })

  it('opts out of the focus gate, because it is grabbing mid-overlay-show', async () => {
    // The bug this exists to prevent: OverlayController.targetHasFocus flickers
    // around the overlay show this capture fires microseconds after, so asking
    // it again here made the backdrop fail more often than it worked.
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 1) })
    await captureRadialBackdrop({ x: 500, y: 400 }, 280)
    expect(captureGameWindowResult).toHaveBeenCalledWith({ skipFocusGate: true })
  })

  it('passes the capture failure through instead of swallowing it', async () => {
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: null, failure: 'no-source' })
    await expect(captureRadialBackdrop({ x: 500, y: 400 }, 280)).resolves.toEqual({ failure: 'no-source' })
  })

  it('swallows a capture that throws, but still says so', async () => {
    vi.mocked(captureGameWindowResult).mockRejectedValue(new Error('desktopCapturer exploded'))
    await expect(captureRadialBackdrop({ x: 500, y: 400 }, 280)).resolves.toEqual({ failure: 'error' })
  })

  it('an open point entirely off the frame yields nothing to crop', async () => {
    vi.mocked(captureGameWindowResult).mockResolvedValue({ frame: frame(1000, 1) })
    await expect(captureRadialBackdrop({ x: 2000, y: 2000 }, 280)).resolves.toEqual({ failure: 'crop' })
  })
})
