// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RADIAL_PLUGIN_ICON,
  type RadialBackdrop,
  type RadialBackdropEvent,
  type RadialOpenPayload,
  type RadialPendingState,
} from '@shared/contracts/radial'
import { RadialMenu, RadialMenuView, TUNING_PANEL_KEY } from './RadialMenu'
import { CENTER_RADIUS, clampCenter, ICON_HALO, RING_RADIUS, slicePosition } from './geometry'
import { RING_MAX, TUNING_STORAGE_KEY } from './backdrop-style'

/** A ring override comfortably above the base and inside TUNING_RANGES.ring.
 *  Derived rather than written down: literals here were really the old base
 *  constant in disguise, and went silently out of range (and got clamped by the
 *  slider, failing on a confusing off-by-a-ring) the moment the base moved. */
const RING_OVERRIDE = Math.round((RING_RADIUS + RING_MAX) / 2)

const payload: RadialOpenPayload = {
  center: { x: 400, y: 300 },
  slices: [
    { id: 's0', icon: 'Filter', label: 'Filter Check', action: { kind: 'filter' } },
    { id: 's1', icon: 'Buy', label: 'Price Check', action: { kind: 'pricecheck' } },
    { id: 's2', icon: 'Setting', label: 'Settings', action: { kind: 'appmacro', action: 'openSettings' } },
    { id: 's3', icon: 'Message', label: '/hideout', action: { kind: 'chat', command: '/hideout', autoSubmit: true } },
  ],
}

beforeEach(() => {
  vi.useFakeTimers()
  // The dev panel persists its tuning, and a leaked value would carry into the
  // next case's panel.
  window.localStorage.clear()
  // The panel is opt-in on top of developerMode now, so every case that wants
  // one has to ask. The gate itself is asserted separately below.
  window.localStorage.setItem(TUNING_PANEL_KEY, '1')
})
afterEach(() => vi.useRealTimers())

describe('RadialMenuView', () => {
  it('renders one icon per slice', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.getAllByTestId('radial-slice')).toHaveLength(4)
  })

  it('click with no selection cancels', () => {
    const onCancel = vi.fn()
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('radial-root'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('pointer past the deadzone selects the sector; click fires after the snap delay', () => {
    const onFire = vi.fn()
    render(<RadialMenuView payload={payload} onFire={onFire} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    fireEvent.pointerMove(root, { clientX: 400, clientY: 200 }) // straight up -> slice 0
    expect(screen.getAllByTestId('radial-slice')[0].dataset.hovered).toBe('true')
    fireEvent.click(root)
    expect(onFire).not.toHaveBeenCalled() // snap animation first
    vi.advanceTimersByTime(200)
    expect(onFire).toHaveBeenCalledWith('s0')
  })

  it('a click batched with the pointer move still fires the sector under the cursor', () => {
    const onFire = vi.fn()
    const onCancel = vi.fn()
    render(<RadialMenuView payload={payload} onFire={onFire} onCancel={onCancel} />)
    const root = screen.getByTestId('radial-root')
    // Both events inside one act(), so React has not committed the pointermove's
    // hover state by the time the click handler runs. The handler must pick the
    // slice off the live cursor, not off state that may still be a render behind.
    act(() => {
      root.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 200, bubbles: true }))
      root.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 200, bubbles: true }))
    })
    expect(onCancel).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onFire).toHaveBeenCalledWith('s0')
  })

  it('the size scale moves the icons onto a proportionally smaller ring', () => {
    const scale = 0.6
    render(<RadialMenuView payload={{ ...payload, scale }} onFire={() => {}} onCancel={() => {}} />)
    const center = clampCenter(
      payload.center,
      { width: window.innerWidth, height: window.innerHeight },
      RING_RADIUS * scale + ICON_HALO,
    )
    const expected = payload.slices.map((_, i) => slicePosition(center, i, payload.slices.length, RING_RADIUS * scale))
    const actual = screen.getAllByTestId('radial-slice').map((el) => ({
      x: parseFloat((el as HTMLElement).style.left),
      y: parseFloat((el as HTMLElement).style.top),
    }))
    actual.forEach((pos, i) => {
      expect(pos.x).toBeCloseTo(expected[i].x, 3)
      expect(pos.y).toBeCloseTo(expected[i].y, 3)
    })
    // ...and that really is smaller than the default ring, not just self-consistent.
    expect(Math.hypot(actual[0].x - center.x, actual[0].y - center.y)).toBeCloseTo(RING_RADIUS * scale, 3)
  })

  it('flips the glyph colour only once the goo puck has travelled under it', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    const icon = (): HTMLElement => screen.getAllByTestId('radial-slice')[0].querySelector('.radial-icon')!

    act(() => {
      fireEvent.pointerMove(root, { clientX: 400, clientY: 300 - RING_RADIUS })
    })
    // Hover is instant, arrival is not: the puck is still leaving the bubble.
    expect(screen.getAllByTestId('radial-slice')[0].dataset.hovered).toBe('true')
    expect(icon().dataset.arrived).toBeUndefined()

    // Fake timers drive rAF, so this really is the lerp converging, not a clock
    // skip: the blob needs ~6 frames at FOLLOW=0.25 to close the gap.
    act(() => void vi.advanceTimersByTime(300))
    expect(icon().dataset.arrived).toBe('true')

    // Moving off reverts on the very next frame - the colour must never lag
    // behind a puck that has already left. (Two acts, not one: the hover ref the
    // loop reads is synced by an effect, which React only flushes when the outer
    // act closes, so a frame inside the same act would still see the old slice.)
    act(() => {
      fireEvent.pointerMove(root, { clientX: 400 + RING_RADIUS, clientY: 300 })
    })
    act(() => void vi.advanceTimersByTime(20))
    expect(icon().dataset.arrived).toBeUndefined()
  })

  it('antialiases the goo AFTER the alpha threshold, never before', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    const steps = Array.from(document.querySelector('filter')!.children).map((el) => el.tagName)
    // Order is the whole point: the threshold is what fuses the two circles, and
    // it destroys the edge's partial coverage on the way. Softening before it
    // would just be re-hardened; softening after is what gives the coverage back.
    expect(steps).toEqual(['feGaussianBlur', 'feColorMatrix', 'feGaussianBlur'])
    // Sub-pixel, or the blob stops reading as liquid and starts reading as fog.
    expect(Number(document.querySelector('filter')!.lastElementChild!.getAttribute('stdDeviation'))).toBeLessThan(1)
  })

  it('offers the close glyph only while a centre click would actually cancel', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    const close = (): HTMLElement => screen.getByTestId('radial-close')

    // At rest, and inside the deadzone: a click here cancels, so say so.
    expect(close().dataset.visible).toBe('true')
    fireEvent.pointerMove(root, { clientX: 400, clientY: 290 })
    expect(close().dataset.visible).toBe('true')

    // Select a slice and the centre stops being a button - it is somewhere the
    // gesture passes through. Asserted on the state, not the fade.
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 - RING_RADIUS })
    expect(screen.getAllByTestId('radial-slice')[0].dataset.hovered).toBe('true')
    expect(close().dataset.visible).toBe('false')

    // ...and it comes back on deselect.
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 })
    expect(close().dataset.visible).toBe('true')
  })

  it('paints the close glyph with the same on-accent colour the arrived slice glyph gets', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    // Both sit on the accent - the X on the bubble, the glyph on the puck - so
    // they must be the same derived colour and not two guesses at it. Compared
    // through a probe so the two are normalised the same way by the CSSOM.
    const icon = screen.getAllByTestId('radial-slice')[0].querySelector('.radial-icon') as HTMLElement
    const probe = document.createElement('div')
    probe.style.color = icon.style.getPropertyValue('--radial-on-accent')
    expect(probe.style.color).not.toBe('')
    expect(screen.getByTestId('radial-close').style.color).toBe(probe.style.color)
  })

  it('hides the close glyph while a slice is firing, not just while hovered', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 - RING_RADIUS })
    fireEvent.click(root)
    // The click has committed to a slice; the pointer may well be back over the
    // centre by the time the snap plays, and the X must not reappear under it.
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 })
    expect(screen.getByTestId('radial-close').dataset.visible).toBe('false')
  })

  it('draws a plugin badge only when the slice asked for the plugin art', () => {
    const svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
    const withSlices = (slices: RadialOpenPayload['slices']): RadialOpenPayload => ({ ...payload, slices })

    // Sentinel + enrichment -> the round token.
    const a = render(
      <RadialMenuView
        payload={withSlices([
          {
            id: 'p',
            icon: RADIAL_PLUGIN_ICON,
            iconSvg: svg,
            label: 'P',
            action: { kind: 'appmacro', action: 'plugin:x' },
          },
        ])}
        onFire={() => {}}
        onCancel={() => {}}
      />,
    )
    const badge = screen.getByTestId('radial-plugin-badge')
    expect(badge).toBeInTheDocument()
    // Edge to edge, not a stamp floating in the middle: the art fills the badge
    // and the circular clip is what shapes it.
    expect(badge.className).toContain('rounded-full')
    expect(badge.className).toContain('overflow-hidden')
    expect(badge.querySelector('span')?.className).toContain('[&_svg]:w-full')
    a.unmount()

    // Sentinel with no art (plugin gone, or it registered none) -> the glyph.
    const b = render(
      <RadialMenuView
        payload={withSlices([
          { id: 'p', icon: RADIAL_PLUGIN_ICON, label: 'P', action: { kind: 'appmacro', action: 'plugin:x' } },
        ])}
        onFire={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.queryByTestId('radial-plugin-badge')).toBeNull()
    expect(screen.getAllByTestId('radial-slice')[0].querySelector('svg')).toBeTruthy()
    b.unmount()

    // A chosen glyph beats the enrichment - that is the whole point of making
    // the plugin art an option rather than an override.
    render(
      <RadialMenuView
        payload={withSlices([
          { id: 'p', icon: 'Diamond', iconSvg: svg, label: 'P', action: { kind: 'appmacro', action: 'plugin:x' } },
        ])}
        onFire={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.queryByTestId('radial-plugin-badge')).toBeNull()
  })

  it('fills the badge with image-url art too, cropped rather than letterboxed', () => {
    render(
      <RadialMenuView
        payload={{
          ...payload,
          slices: [
            {
              id: 'p',
              icon: RADIAL_PLUGIN_ICON,
              iconSvg: 'data:image/png;base64,iVBORw0KGgo=',
              label: 'P',
              action: { kind: 'appmacro', action: 'plugin:x' },
            },
          ],
        }}
        onFire={() => {}}
        onCancel={() => {}}
      />,
    )
    const img = screen.getByTestId('radial-plugin-badge').querySelector('img')
    expect(img?.className).toContain('w-full')
    expect(img?.className).toContain('object-cover')
  })

  it('shows the OS cursor once the pointer drifts past the disc, and hides it again inside', () => {
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')

    // At rest, and still inside the disc: the blob is standing in for the
    // pointer, so a second cursor drawn over it would read as two cursors.
    expect(root.style.cursor).toBe('none')
    fireEvent.pointerMove(root, { clientX: 400, clientY: 290 })
    expect(root.style.cursor).toBe('none')

    // Far enough out that no disc at any scale reaches it: the blob is
    // pinned back on the ring here, and it stops being an honest answer to
    // "where is my hand" - so the OS cursor has to come back.
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 - 400 })
    expect(root.style.cursor).not.toBe('none')

    // ...and it hides again on the way back in.
    fireEvent.pointerMove(root, { clientX: 400, clientY: 300 })
    expect(root.style.cursor).toBe('none')
  })

  it('Escape cancels', () => {
    const onCancel = vi.fn()
    render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('RadialMenuView developer tuning panel', () => {
  const devPayload = { ...payload, dev: true }

  it('needs developer mode AND the explicit opt-in, not either alone', () => {
    // Developer mode alone is a setting people leave on for other reasons, so
    // it must not put a slider rack over the menu on its own.
    const a = render(<RadialMenuView payload={payload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.queryByTestId('radial-dev-panel')).toBeNull()
    a.unmount()

    window.localStorage.removeItem(TUNING_PANEL_KEY)
    const b = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.queryByTestId('radial-dev-panel')).toBeNull()
    b.unmount()

    window.localStorage.setItem(TUNING_PANEL_KEY, '1')
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('radial-dev-panel')).toBeInTheDocument()
  })

  it('hold open (on by default) swallows a click on a slice, and giving it back fires again', () => {
    const onFire = vi.fn()
    const onCancel = vi.fn()
    render(<RadialMenuView payload={devPayload} onFire={onFire} onCancel={onCancel} />)
    const root = screen.getByTestId('radial-root')

    fireEvent.pointerMove(root, { clientX: 400, clientY: 200 }) // straight up -> slice 0
    fireEvent.click(root)
    vi.advanceTimersByTime(200)
    expect(onFire).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('radial-hold-toggle'))
    fireEvent.pointerMove(root, { clientX: 400, clientY: 200 })
    fireEvent.click(root)
    vi.advanceTimersByTime(200)
    expect(onFire).toHaveBeenCalledWith('s0')
  })

  it('a click inside the panel neither fires nor cancels, even with hold open off', () => {
    const onFire = vi.fn()
    const onCancel = vi.fn()
    render(<RadialMenuView payload={devPayload} onFire={onFire} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('radial-hold-toggle')) // hold open -> off
    fireEvent.click(screen.getByTestId('radial-dev-values'))
    fireEvent.click(screen.getByTestId('radial-dev-reset'))
    vi.advanceTimersByTime(200)
    expect(onFire).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('the ring override moves the slice icons onto a bigger ring', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-ring'), { target: { value: String(RING_OVERRIDE) } })

    // The whole chain has to move together, not just the icon placement: a ring
    // this size also pushes the edge clamp out, so the drawn centre is computed
    // from the override too.
    const center = clampCenter(
      payload.center,
      { width: window.innerWidth, height: window.innerHeight },
      RING_OVERRIDE + ICON_HALO,
    )
    const expected = payload.slices.map((_, i) => slicePosition(center, i, payload.slices.length, RING_OVERRIDE))
    screen.getAllByTestId('radial-slice').forEach((el, i) => {
      expect(parseFloat((el as HTMLElement).style.left)).toBeCloseTo(expected[i].x, 3)
      expect(parseFloat((el as HTMLElement).style.top)).toBeCloseTo(expected[i].y, 3)
    })
  })

  it('the bubble override moves the deadzone, so the same cursor stops selecting', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    const hovered = (): string | undefined => screen.getAllByTestId('radial-slice')[0].dataset.hovered

    // Just outside the default bubble, so it picks slice 0. Derived rather than
    // literal: the shipped radius is exactly the thing this asserts about.
    const justOutside = 300 - (CENTER_RADIUS + 3)
    fireEvent.pointerMove(root, { clientX: 400, clientY: justOutside })
    expect(hovered()).toBe('true')

    // Grow the bubble past it and the very same point is inside the deadzone -
    // the deadzone IS the drawn bubble's edge, so the override has to move both.
    fireEvent.change(screen.getByTestId('radial-slider-bubble'), { target: { value: '40' } })
    fireEvent.pointerMove(root, { clientX: 400, clientY: justOutside })
    expect(hovered()).toBe('false')
  })

  it('geometry overrides survive a remount and Reset puts them back', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-ring'), { target: { value: String(RING_OVERRIDE) } })
    unmount()

    // The next open reads the stored blob on its FIRST render - the ring must
    // not draw at its default and then jump once the panel mounts under it.
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const center = clampCenter(
      payload.center,
      { width: window.innerWidth, height: window.innerHeight },
      RING_OVERRIDE + ICON_HALO,
    )
    const first = screen.getAllByTestId('radial-slice')[0] as HTMLElement
    expect(parseFloat(first.style.top)).toBeCloseTo(slicePosition(center, 0, 4, RING_OVERRIDE).y, 3)

    fireEvent.click(screen.getByTestId('radial-dev-reset'))
    const back = clampCenter(
      payload.center,
      { width: window.innerWidth, height: window.innerHeight },
      RING_RADIUS + ICON_HALO,
    )
    expect(parseFloat((screen.getAllByTestId('radial-slice')[0] as HTMLElement).style.top)).toBeCloseTo(
      slicePosition(back, 0, 4, RING_RADIUS).y,
      3,
    )
  })

  it('tells a capture still in flight apart from one that failed, and names the gate', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    // No answer yet is not the same as "no". Reading both as "none" is what let
    // an every-open capture failure look like a slow one.
    expect(screen.getByTestId('radial-dev-capture')).toHaveTextContent('capture: waiting')
    unmount()

    render(<RadialMenuView payload={devPayload} backdropFailure="focus" onFire={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('radial-dev-capture')).toHaveTextContent('capture: none (focus)')
  })

  it('the edge falloff drives the frost mask and the tint gradient off one property', () => {
    render(<RadialMenuView payload={devPayload} backdrop={backdropFor(1)} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    expect(root.style.getPropertyValue('--radial-falloff')).toBe('65%')

    fireEvent.change(screen.getByTestId('radial-slider-falloff'), { target: { value: '80' } })
    expect(root.style.getPropertyValue('--radial-falloff')).toBe('80%')

    // Both halves of the effect read the SAME property, which is what keeps the
    // blur and the tint on one falloff instead of two visible circles. Asserted
    // on the declarations rather than on pixels - jsdom paints nothing.
    const frost = screen.getByTestId('radial-backdrop-frost')
    const mask = frost.style.maskImage || frost.style.getPropertyValue('-webkit-mask-image')
    expect(mask).toContain('var(--radial-falloff')
    expect(mask).toContain('closest-side')
    expect(screen.getByTestId('radial-disc-tint').style.background).toContain('var(--radial-falloff')
  })

  it('raw view drops the falloff and the rim feather - it is an instrument, not a look', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    expect(root.style.getPropertyValue('--radial-rim')).toBe('95%')

    fireEvent.click(screen.getByTestId('radial-raw-toggle'))
    expect(root.style.getPropertyValue('--radial-falloff')).toBe('100%')
    expect(root.style.getPropertyValue('--radial-rim')).toBe('100%')
  })

  it('the falloff persists across a remount and Reset restores it', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-falloff'), { target: { value: '45' } })
    unmount()

    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('radial-root').style.getPropertyValue('--radial-falloff')).toBe('45%')
    fireEvent.click(screen.getByTestId('radial-dev-reset'))
    expect(screen.getByTestId('radial-root').style.getPropertyValue('--radial-falloff')).toBe('65%')
  })

  /** The bubble's drawn placement, off the transform the rAF loop writes. */
  const bubbleAt = (): { x: number; y: number; scaleX: number } => {
    const tf = screen.getByTestId('radial-bubble').getAttribute('transform') ?? ''
    const move = /^translate\(([-\d.]+) ([-\d.]+)\)/.exec(tf)
    const scale = /scale\(([-\d.]+) /.exec(tf)
    return { x: Number(move?.[1]), y: Number(move?.[2]), scaleX: Number(scale?.[1]) }
  }

  it('the bubble leans toward the cursor while it is still inside the deadzone', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')

    // 25px right of centre: well inside the 35px bubble, so nothing is selected
    // and the old ring would not have moved a pixel.
    act(() => {
      fireEvent.pointerMove(root, { clientX: 425, clientY: 300 })
    })
    act(() => void vi.advanceTimersByTime(300))

    const led = bubbleAt()
    expect(screen.getAllByTestId('radial-slice')[0].dataset.hovered).toBe('false')
    expect(led.x).toBeGreaterThan(400)
    // Capped: a lean is not a slide off its mark.
    expect(led.x).toBeLessThan(400 + CENTER_RADIUS * 0.25)
    expect(led.y).toBeCloseTo(300, 1)
    // ...and stretched along the way it leaned.
    expect(led.scaleX).toBeGreaterThan(1)
  })

  it('liquid at 0 leaves a rigid bubble, however far the cursor pulls', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-liquid'), { target: { value: '0' } })
    const root = screen.getByTestId('radial-root')

    act(() => {
      fireEvent.pointerMove(root, { clientX: 425, clientY: 300 })
    })
    act(() => void vi.advanceTimersByTime(400))

    // No lean, no squash, and the radius is the plain constant - every liquid
    // term is off the same multiplier, so 0 has to silence all four at once.
    expect(bubbleAt()).toMatchObject({ x: 400, y: 300, scaleX: 1 })
    expect(Number(screen.getByTestId('radial-bubble').getAttribute('r'))).toBeCloseTo(CENTER_RADIUS, 4)
  })

  it('a pre-fold tuning blob keeps its grade but forgets its geometry', () => {
    // v1 blobs hold bubble/ring in the OLD base space (35 / 84). Those are
    // absolute px, so replaying one against the folded base would draw the ring
    // 43% too big; the grading fields carry no such assumption.
    window.localStorage.setItem(
      TUNING_STORAGE_KEY,
      JSON.stringify({ blur: 30, tint: 20, bubble: 35, ring: 84, goo: 90 }),
    )
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)

    expect((screen.getByTestId('radial-slider-blur') as HTMLInputElement).value).toBe('30')
    expect((screen.getByTestId('radial-slider-tint') as HTMLInputElement).value).toBe('20')
    expect((screen.getByTestId('radial-slider-goo') as HTMLInputElement).value).toBe('90')
    expect((screen.getByTestId('radial-slider-bubble') as HTMLInputElement).value).toBe(String(CENTER_RADIUS))
    expect((screen.getByTestId('radial-slider-ring') as HTMLInputElement).value).toBe(String(RING_RADIUS))
  })

  it('a stamped blob keeps its geometry, and saving stamps it', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-ring'), { target: { value: String(RING_OVERRIDE) } })
    expect(JSON.parse(window.localStorage.getItem(TUNING_STORAGE_KEY)!).v).toBe(2)
    unmount()

    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    expect((screen.getByTestId('radial-slider-ring') as HTMLInputElement).value).toBe(String(RING_OVERRIDE))
  })

  it('the liquid value round-trips through the tuning blob and Reset restores it', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-liquid'), { target: { value: '150' } })
    unmount()

    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const slider = (): HTMLInputElement => screen.getByTestId('radial-slider-liquid') as HTMLInputElement
    expect(slider().value).toBe('150')
    fireEvent.click(screen.getByTestId('radial-dev-reset'))
    expect(slider().value).toBe('100')
  })

  it('the tuning lands on the menu root as custom properties', () => {
    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    const root = screen.getByTestId('radial-root')
    expect(root.style.getPropertyValue('--radial-blur')).toBe('2px')
    expect(root.style.getPropertyValue('--radial-goo')).toBe('0.7')
    // Group opacity, and through `style` so the property can reach it at all -
    // an SVG presentation attribute cannot take a var().
    expect(screen.getByTestId('radial-goo').style.opacity).toContain('var(--radial-goo')

    // Raw view is the capture-vs-grade split: no blur, no grade, no tint.
    fireEvent.click(screen.getByTestId('radial-raw-toggle'))
    expect(root.style.getPropertyValue('--radial-blur')).toBe('0px')
    expect(root.style.getPropertyValue('--radial-tint')).toBe('0%')
    expect(root.style.getPropertyValue('--radial-brightness')).toBe('1')
    // ...but the goo is menu look, not a backdrop diagnostic, so raw leaves it
    // exactly where the user put it.
    expect(root.style.getPropertyValue('--radial-goo')).toBe('0.7')
  })

  it('the goo slider persists across a remount and Reset restores it', () => {
    const { unmount } = render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByTestId('radial-slider-goo'), { target: { value: '40' } })
    expect(screen.getByTestId('radial-root').style.getPropertyValue('--radial-goo')).toBe('0.4')
    unmount()

    render(<RadialMenuView payload={devPayload} onFire={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('radial-root').style.getPropertyValue('--radial-goo')).toBe('0.4')
    fireEvent.click(screen.getByTestId('radial-dev-reset'))
    expect(screen.getByTestId('radial-root').style.getPropertyValue('--radial-goo')).toBe('0.7')
  })
})

/** Stub preload API. Captures the IPC callbacks so tests can drive main's side
 *  of the conversation. `pending` defaults to "nothing pending". */
function installApi(pending: Promise<RadialPendingState> = Promise.resolve({ payload: null, backdrop: null })) {
  const open: Array<(p: RadialOpenPayload) => void> = []
  const close: Array<() => void> = []
  const backdrop: Array<(b: RadialBackdropEvent) => void> = []
  const api = {
    radialPending: vi.fn(() => pending),
    onRadialOpen: vi.fn((cb: (p: RadialOpenPayload) => void) => {
      open.push(cb)
      return () => {}
    }),
    onRadialClose: vi.fn((cb: () => void) => {
      close.push(cb)
      return () => {}
    }),
    onRadialBackdrop: vi.fn((cb: (b: RadialBackdropEvent) => void) => {
      backdrop.push(cb)
      return () => {}
    }),
    radialFire: vi.fn(),
    radialCancel: vi.fn(),
  }
  // @ts-expect-error test shim
  window.api = api
  return { api, open, close, backdrop }
}

function backdropFor(nonce: number): RadialBackdrop {
  return { nonce, dataUrl: 'data:image/png;base64,iVBORw0KGgo=', origin: { x: 120, y: 20 }, width: 560, height: 560 }
}

describe('RadialMenu (IPC wrapper)', () => {
  it('mounts the view on open, unmounts it on close, and remounts on reopen', async () => {
    const { open, close } = installApi()
    render(<RadialMenu />)
    await act(async () => {})
    expect(screen.queryByTestId('radial-root')).toBeNull()

    act(() => open[0](payload))
    expect(screen.getByTestId('radial-root')).toBeInTheDocument()

    // The close main sends on every hide - the window only went transparent,
    // so nothing else would take the ring (and its rAF loop) down.
    act(() => close[0]())
    expect(screen.queryByTestId('radial-root')).toBeNull()

    act(() => open[0]({ ...payload, center: { x: 200, y: 150 } }))
    expect(screen.getAllByTestId('radial-slice')).toHaveLength(4)
  })

  it('a PENDING payload that resolves after a close does not reopen the menu', async () => {
    let resolvePending: (s: RadialPendingState) => void = () => {}
    const pending = new Promise<RadialPendingState>((r) => {
      resolvePending = r
    })
    const { close } = installApi(pending)
    render(<RadialMenu />)

    act(() => close[0]())
    await act(async () => {
      resolvePending({ payload, backdrop: null })
      await pending
    })
    expect(screen.queryByTestId('radial-root')).toBeNull()
  })

  it('renders a backdrop for the live open and ignores one from an earlier menu', async () => {
    const { open, backdrop, close } = installApi()
    render(<RadialMenu />)
    await act(async () => {})

    act(() => open[0]({ ...payload, nonce: 7 }))
    // The capture is async, so a slow one from the previous open can land under
    // the new menu - game pixels from wherever the cursor used to be.
    act(() => backdrop[0](backdropFor(6)))
    expect(screen.queryByTestId('radial-backdrop')).toBeNull()

    act(() => backdrop[0](backdropFor(7)))
    expect(screen.getByTestId('radial-backdrop')).toBeInTheDocument()

    // Closing drops the image, so reopening never flashes the last menu's art.
    act(() => close[0]())
    act(() => open[0]({ ...payload, nonce: 8 }))
    expect(screen.queryByTestId('radial-backdrop')).toBeNull()
  })

  it('a capture failure reaches the developer panel as the gate that closed', async () => {
    const { open, backdrop } = installApi()
    render(<RadialMenu />)
    await act(async () => {})

    act(() => open[0]({ ...payload, nonce: 3, dev: true }))
    expect(screen.getByTestId('radial-dev-capture')).toHaveTextContent('capture: waiting')

    // Same channel as an image, discriminated by the missing dataUrl - so the
    // ring keeps its plain disc and the panel stops guessing.
    act(() => backdrop[0]({ nonce: 3, failure: 'no-source' }))
    expect(screen.queryByTestId('radial-backdrop')).toBeNull()
    expect(screen.getByTestId('radial-dev-capture')).toHaveTextContent('capture: none (no-source)')
  })

  it('a PENDING payload still opens the menu when no event beat it', async () => {
    installApi(Promise.resolve({ payload, backdrop: null }))
    render(<RadialMenu />)
    await act(async () => {})
    expect(screen.getByTestId('radial-root')).toBeInTheDocument()
  })

  it('a backdrop sent before this renderer existed is picked up by the pending pull', async () => {
    // The first open of a session: the window is created lazily, so BOTH sends
    // can land in a webContents that is still loading. The payload always had
    // this fallback; without it for the image, the first menu of every session
    // drew a plain disc whenever the capture beat the renderer's first paint.
    installApi(Promise.resolve({ payload: { ...payload, nonce: 4 }, backdrop: backdropFor(4) }))
    render(<RadialMenu />)
    await act(async () => {})
    expect(screen.getByTestId('radial-backdrop')).toBeInTheDocument()
  })

  it('the pending backdrop still applies when OPEN_EVENT won the payload race', async () => {
    // Winning the payload race says nothing about the image: it travels on its
    // own channel and lands much later, so it can have been dropped on its own.
    const { open } = installApi(Promise.resolve({ payload: { ...payload, nonce: 5 }, backdrop: backdropFor(5) }))
    render(<RadialMenu />)
    act(() => open[0]({ ...payload, nonce: 5 }))
    await act(async () => {})
    expect(screen.getByTestId('radial-backdrop')).toBeInTheDocument()
  })

  it('a pending backdrop from an earlier menu is still filtered by nonce', async () => {
    installApi(Promise.resolve({ payload: { ...payload, nonce: 9 }, backdrop: backdropFor(8) }))
    render(<RadialMenu />)
    await act(async () => {})
    expect(screen.getByTestId('radial-root')).toBeInTheDocument()
    expect(screen.queryByTestId('radial-backdrop')).toBeNull()
  })

  it('a pending failure is truthful on the first open too', async () => {
    installApi(
      Promise.resolve({
        payload: { ...payload, nonce: 2, dev: true },
        backdrop: { nonce: 2, failure: 'focus' as const },
      }),
    )
    render(<RadialMenu />)
    await act(async () => {})
    expect(screen.getByTestId('radial-dev-capture')).toHaveTextContent('capture: none (focus)')
  })
})
