import { describe, expect, it } from 'vitest'
import { RADIAL_BACKDROP_HALF_PX, RADIAL_SCALE_MAX } from '@shared/contracts/radial'
import {
  CENTER_RADIUS,
  clampCenter,
  DEADZONE_PX,
  arcStep,
  DISC_PAD,
  GOO_BRIDGE_SIGMAS,
  gooConnected,
  gooLanding,
  ICON_HALO,
  pickSlice,
  RING_RADIUS,
  slicePosition,
} from './geometry'

const C = { x: 500, y: 500 }
/** The default clamp margin. Derived, not literal, so scaling the ring cannot
 *  leave these cases silently testing yesterday's geometry. */
const MARGIN = RING_RADIUS + ICON_HALO

describe('slicePosition', () => {
  it('puts slice 0 straight up', () => {
    const p = slicePosition(C, 0, 4)
    expect(p.x).toBeCloseTo(500)
    expect(p.y).toBeCloseTo(500 - RING_RADIUS)
  })
  it("goes clockwise: slice 1 of 4 is at 3 o'clock", () => {
    const p = slicePosition(C, 1, 4)
    expect(p.x).toBeCloseTo(500 + RING_RADIUS)
    expect(p.y).toBeCloseTo(500)
  })
  it('honours an explicit radius (the goo blob rides a shorter one)', () => {
    const p = slicePosition(C, 1, 4, 40)
    expect(p.x).toBeCloseTo(540)
    expect(p.y).toBeCloseTo(500)
  })
})

describe('pickSlice', () => {
  it('returns null inside the deadzone', () => {
    expect(pickSlice(C, { x: 510, y: 510 }, 4)).toBeNull()
  })
  it('picks the sector containing the mouse', () => {
    expect(pickSlice(C, { x: 500, y: 400 }, 4)).toBe(0) // up
    expect(pickSlice(C, { x: 600, y: 500 }, 4)).toBe(1) // right
    expect(pickSlice(C, { x: 500, y: 600 }, 4)).toBe(2) // down
    expect(pickSlice(C, { x: 400, y: 500 }, 4)).toBe(3) // left
  })
  it('sectors are centered on slices (up-right diagonal splits 0 and 1)', () => {
    expect(pickSlice(C, { x: 560, y: 441 }, 4)).toBe(1) // just past the 45° boundary
    expect(pickSlice(C, { x: 559, y: 440 }, 4)).toBe(0) // just before it
  })
  it('wraps: just left of straight-up is still slice 0', () => {
    expect(pickSlice(C, { x: 490, y: 400 }, 4)).toBe(0)
  })
  it('null for zero slices', () => {
    expect(pickSlice(C, { x: 600, y: 500 }, 0)).toBeNull()
  })
})

describe('gooConnected', () => {
  const sigma = 6.75
  const limit = GOO_BRIDGE_SIGMAS * sigma

  it('holds right up to the bridge limit and snaps just past it', () => {
    // Two 35px circles: the EDGE gap is what the filter sees, so the centres
    // are 70 apart before the gap even starts.
    expect(gooConnected(70 + limit - 0.01, 35, 35, sigma)).toBe(true)
    expect(gooConnected(70 + limit + 0.01, 35, 35, sigma)).toBe(false)
  })

  it('overlapping circles are connected however deep the overlap', () => {
    expect(gooConnected(10, 35, 35, sigma)).toBe(true)
    expect(gooConnected(0, 35, 0, sigma)).toBe(true) // the blob at rest, inside the bubble
  })

  it('a wider blur bridges a wider gap, which is why the ring scales sigma', () => {
    // 15px of edge gap: too far at the shipped sigma, fused at a bigger ring's.
    expect(gooConnected(85, 35, 35, sigma)).toBe(false)
    expect(gooConnected(85, 35, 35, 12)).toBe(true)
  })
})

describe('gooLanding', () => {
  it('fires when the blob re-fuses on its way home', () => {
    expect(gooLanding(false, true, true)).toBe(true)
  })

  it('stays silent for the kiss in the middle of a slice-to-slice transfer', () => {
    // The blob crosses the chord between two slices, which dips inside the
    // bridge limit and re-fuses - but it is headed at a slice, not home. This is
    // the whole bug: a bare connectivity edge thumped the bubble mid-transfer.
    expect(gooLanding(false, true, false)).toBe(false)
  })

  it('needs the edge, not merely the state - a steady fusion does not re-fire', () => {
    expect(gooLanding(true, true, true)).toBe(false)
  })

  it('never fires on the parting edge, homeward or not', () => {
    expect(gooLanding(true, false, true)).toBe(false)
    expect(gooLanding(true, false, false)).toBe(false)
  })
})

describe('arcStep', () => {
  const C = { x: 0, y: 0 }
  const RING = 80
  const RATES = { angle: 0.25, radius: 0.25 }
  const at = (angle: number, r = RING) => ({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  const radius = (p: { x: number; y: number }): number => Math.hypot(p.x - C.x, p.y - C.y)
  const angle = (p: { x: number; y: number }): number => Math.atan2(p.y - C.y, p.x - C.x)
  /** Steps until the point is within `eps` radians of `target`, capped. */
  const stepsTo = (from: { x: number; y: number }, target: number, eps = 0.02): number => {
    let p = from
    for (let i = 1; i <= 200; i++) {
      p = arcStep(p, target, C, RING, RATES)
      const gap = Math.atan2(Math.sin(target - angle(p)), Math.cos(target - angle(p)))
      if (Math.abs(gap) < eps) return i
    }
    return Number.POSITIVE_INFINITY
  }

  it('never dips inward - the whole point, versus a chord', () => {
    // A chord between adjacent slices sags to 0.71 of the ring, and between
    // opposite slices to zero (straight through the bubble). An arc holds its
    // radius the entire way.
    let p = at(0)
    for (let i = 0; i < 60; i++) {
      p = arcStep(p, Math.PI, C, RING, RATES)
      expect(radius(p)).toBeGreaterThan(RING * 0.9)
    }
  })

  it('bends outward onto the ring when it enters mid-pull, rather than stepping', () => {
    // Arc mode is entered around 0.55 of the ring, so the first steps still have
    // radial gap to close - and closing it gradually is what keeps the mode
    // switch from popping.
    let p = at(0, RING * 0.55)
    const seen = [radius(p)]
    for (let i = 0; i < 20; i++) {
      p = arcStep(p, Math.PI / 2, C, RING, RATES)
      seen.push(radius(p))
    }
    // Monotonically outward, never overshooting the ring, and arriving on it.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1] - 1e-9)
    expect(Math.max(...seen)).toBeLessThanOrEqual(RING + 1e-9)
    expect(seen.at(-1)!).toBeGreaterThan(RING * 0.99)
  })

  it('converges on the target angle', () => {
    let p = at(0)
    for (let i = 0; i < 90; i++) p = arcStep(p, Math.PI / 2, C, RING, RATES)
    expect(p.x).toBeCloseTo(at(Math.PI / 2).x, 3)
    expect(p.y).toBeCloseTo(at(Math.PI / 2).y, 3)
  })

  it('takes the short way across the +/-pi wrap instead of the long way round', () => {
    // 3.0 rad to -3.0 rad is 0.28 rad forward through pi, or 6.0 rad backward.
    const first = arcStep(at(3.0), -3.0, C, RING, RATES)
    const moved = Math.atan2(Math.sin(angle(first) - 3.0), Math.cos(angle(first) - 3.0))
    expect(moved).toBeGreaterThan(0) // forward, into the wrap
    expect(Math.abs(moved)).toBeLessThan(0.28) // and only a fraction of the short gap

    let p = at(3.0)
    for (let i = 0; i < 90; i++) p = arcStep(p, -3.0, C, RING, RATES)
    expect(p.x).toBeCloseTo(at(-3.0).x, 3)
    expect(p.y).toBeCloseTo(at(-3.0).y, 3)
  })

  it('is symmetric: equal arcs take equal steps whichever way they turn', () => {
    expect(stepsTo(at(0), Math.PI / 2)).toBe(stepsTo(at(0), -Math.PI / 2))
    expect(stepsTo(at(0), (3 * Math.PI) / 4)).toBe(stepsTo(at(0), (-3 * Math.PI) / 4))
  })
})

describe('clampCenter', () => {
  it('pushes a corner-adjacent center inward by the margin', () => {
    expect(clampCenter({ x: 5, y: 5 }, { width: 1000, height: 800 }, MARGIN)).toEqual({ x: MARGIN, y: MARGIN })
  })
  it('defaults its margin to the ring plus an icon halo', () => {
    expect(clampCenter({ x: 5, y: 5 }, { width: 1000, height: 800 })).toEqual({ x: MARGIN, y: MARGIN })
  })
  it('leaves an interior center alone', () => {
    expect(clampCenter({ x: 500, y: 400 }, { width: 1000, height: 800 }, MARGIN)).toEqual({ x: 500, y: 400 })
  })
  it('degenerate window: centers instead of inverting', () => {
    expect(clampCenter({ x: 5, y: 5 }, { width: 100, height: 100 }, MARGIN)).toEqual({ x: 50, y: 50 })
  })
})

describe('constants', () => {
  // Load-bearing identity: the blob's reach ramp starts at the bubble's edge, so
  // a deadzone that drifted off CENTER_RADIUS would leave a dead ring around the
  // bubble where the cursor selects nothing but the goo has already committed.
  it('pins the deadzone to the centre bubble', () => {
    expect(DEADZONE_PX).toBe(CENTER_RADIUS)
  })

  // Main crops the backdrop around the RAW open point (it cannot see the clamp,
  // which needs the window size), so the crop has to be big enough for the
  // largest disc plus the furthest that disc can be shoved off the cursor. This
  // file is the only one that can see both sides of that sum - grow the ring
  // without growing the crop and the disc gets a bald ring at screen edges.
  it('keeps the backdrop crop wide enough for the biggest ring at any clamp', () => {
    const maxMargin = RING_RADIUS * RADIAL_SCALE_MAX + ICON_HALO
    expect(RADIAL_BACKDROP_HALF_PX).toBeGreaterThanOrEqual(maxMargin + DISC_PAD + maxMargin)
  })
})
