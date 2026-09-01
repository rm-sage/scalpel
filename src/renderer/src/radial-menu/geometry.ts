export interface Pt {
  x: number
  y: number
}

/** Radius of the ring the slice icons sit on. This is the ring at the user's
 *  scale knob = 1; the dial was rebased to ~70% of its first draft, which is
 *  where it stopped reading as a dialog and started reading as a cursor gesture,
 *  then settled here by eye in the developer tuning panel against the real game.
 *  The knob (0.6-1.4) works off THIS base, so 1.4 draws an 82.6px ring - which
 *  is what RADIAL_BACKDROP_HALF_PX is sized to cover.
 *
 *  59, not 84, because the approved look was always being rendered through a
 *  stored scale of 0.7 that predated the first rebase and was never migrated:
 *  every judgement since was made at base x 0.7. Folding that 0.7 into the base
 *  (84 x 0.7 = 58.8 -> 59) leaves the pixels on screen where they were and lets
 *  the settings slider go back to honestly reading 100%. The 0.2px it gains in
 *  the rounding is a fifth of a pixel and below the blur that covers it. */
export const RING_RADIUS = 59
/** Radius of the centre goo bubble, and so also the deadzone and the travelling
 *  puck. Not a fixed fraction of the ring: it was dialled up independently until
 *  the bubble read as a deliberate resting state rather than a dot, and the puck
 *  that inherits it comfortably haloes the ~20px glyph it sits behind.
 *  Folded by the same 0.7 as the ring, for the same reason: 35 x 0.7 = 24.5, and
 *  the half-pixel it rounds up by is not visible under a 4.96 sigma blur. */
export const CENTER_RADIUS = 25
/** Radius below which no slice is selected (blob rests at center). Pinned to the
 *  centre bubble so picking - and the blob that follows it - starts the instant
 *  the cursor crosses the bubble's edge, with no dead ring around it. */
export const DEADZONE_PX = CENTER_RADIUS
/** Half-extent of a slice icon target; combined with RING_RADIUS it is the
 *  margin the menu keeps from the window edge when clamping. Deliberately does
 *  NOT travel with the size knob: the glyphs keep their designed px, so the room
 *  they need off the ring is fixed however small the ring gets. */
export const ICON_HALO = 28

/** Breathing room between the outermost icon halo and the backdrop disc's edge,
 *  so no glyph or label chip sits right on the rim. */
export const DISC_PAD = 8

/** How many sigmas of gap the fused goo bridge survives before the filter's
 *  alpha threshold snaps it.
 *
 *  Not a tuning knob - it is a property of the filter. Two blurred circles keep a
 *  ridge of alpha between them while their falloffs still sum past the threshold
 *  crossing, and for the blur/threshold pair the ring uses that runs out at
 *  roughly 1.35 sigma of EDGE gap. The same number is quoted wherever the goo
 *  blur is set, and this is the definition those references point at, so the two
 *  cannot drift apart. */
export const GOO_BRIDGE_SIGMAS = 1.35

/** Whether two goo circles still read as one body of liquid.
 *
 *  `dist` is between centres, so the gap that matters is what is left after both
 *  radii; overlapping circles give a negative gap and are trivially connected.
 *  `sigma` must be the RENDERED blur - the ring scales it - or this would answer
 *  for a menu of a different size than the one on screen. Pure, and deliberately
 *  so: it decides how the bubble is DRAWN, never what is selected, and a
 *  predicate with no state is the cheapest way to keep that true. */
export function gooConnected(dist: number, r1: number, r2: number, sigma: number): boolean {
  return dist - r1 - r2 < GOO_BRIDGE_SIGMAS * sigma
}

/** Whether the goo re-fusing this frame is the blob actually coming HOME, and so
 *  the one moment that earns the bubble's landing spring.
 *
 *  Connectivity alone is not enough to decide, which is the bug this exists to
 *  fix. Moving straight from one slice to the next sends the blob across the
 *  chord between them, and that chord dips close enough to the centre to re-fuse
 *  on the way past: on a 4-slice ring the blob sweeps clean THROUGH the bubble,
 *  and even at 8 slices the mid-chord edge gap sits inside the bridge limit. So
 *  a bare connectivity edge thumped the centre bubble in the middle of every
 *  slice-to-slice transfer - a gesture that never went home.
 *
 *  The kiss itself is correct and worth keeping: it is what makes a transfer
 *  read as one mass of liquid rather than as two teleports, and the bubble is
 *  welcome to lean as the blob sweeps past. It just has not earned a spring.
 *  `homeward` is the discriminator, and it means precisely "the blob's target is
 *  the centre" - nothing hovered, nothing firing.
 *
 *  (There is deliberately no matching spring on the parting edge: the fast
 *  RECOIL_FOLLOW unwind back to round IS the release, and a jiggle on top of it
 *  read as the bubble being struck by nothing.) */
export function gooLanding(wasConnected: boolean, connected: boolean, homeward: boolean): boolean {
  return connected && !wasConnected && homeward
}

export interface ArcRates {
  /** Fraction of the remaining ANGULAR gap closed per frame. */
  angle: number
  /** Fraction of the remaining RADIAL gap closed per frame. */
  radius: number
}

/** One frame of travel around the ring rather than across it.
 *
 *  A cartesian lerp toward a slice draws a straight chord, and a chord between
 *  two slices dips inward - far enough on any ring to re-fuse with the centre
 *  bubble on the way past, and for opposite slices straight through it. Sliding
 *  around the ring instead keeps the puck at its own radius the whole way, so
 *  the bubble is never approached at all: the kiss is gone by construction
 *  rather than by being detected and forgiven afterwards.
 *
 *  Angle and radius are lerped independently, which is what makes the mode
 *  switch invisible. A puck already seated on the ring has no radial gap left,
 *  so it travels a pure arc; one that entered mid-pull still has some, so it
 *  bends outward onto the ring as it goes instead of stepping onto it.
 *
 *  `targetRadius` is passed rather than assumed to be the ring, because the
 *  reach ramp puts the puck short of the ring while the cursor is still between
 *  the bubble and the icons - arcing to the full ring there would teleport the
 *  goo out from under the user's hand.
 *
 *  The angular step always takes the SHORT way round: the delta is folded back
 *  into (-pi, pi] through atan2(sin, cos), which handles the wrap at +/-pi
 *  without any branching on quadrant. */
export function arcStep(current: Pt, targetAngle: number, center: Pt, targetRadius: number, rates: ArcRates): Pt {
  const dx = current.x - center.x
  const dy = current.y - center.y
  const r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  const raw = targetAngle - a
  const shortest = Math.atan2(Math.sin(raw), Math.cos(raw))
  const na = a + shortest * rates.angle
  const nr = r + (targetRadius - r) * rates.radius
  return { x: center.x + Math.cos(na) * nr, y: center.y + Math.sin(na) * nr }
}

/** Angle of slice i's center: slice 0 at 12 o'clock, clockwise. Radians. */
export function sliceAngle(index: number, count: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / count
}

export function slicePosition(center: Pt, index: number, count: number, radius = RING_RADIUS): Pt {
  const a = sliceAngle(index, count)
  return { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius }
}

/** Slice under the mouse: null inside the deadzone, else the sector whose
 *  center angle is nearest the mouse angle (sectors are 2π/count wide,
 *  centered on each slice, so the whole wedge is a click target). */
export function pickSlice(center: Pt, mouse: Pt, count: number, deadzone = DEADZONE_PX): number | null {
  if (count <= 0) return null
  const dx = mouse.x - center.x
  const dy = mouse.y - center.y
  if (Math.hypot(dx, dy) < deadzone) return null
  const step = (2 * Math.PI) / count
  const rel = Math.atan2(dy, dx) + Math.PI / 2
  const idx = Math.round(rel / step)
  return ((idx % count) + count) % count
}

/** Clamp the menu's drawn center so the full ring fits inside the window.
 *  The warp target keeps the ORIGINAL open point; this only moves the drawing. */
export function clampCenter(center: Pt, win: { width: number; height: number }, margin = RING_RADIUS + ICON_HALO): Pt {
  const clamp = (v: number, lo: number, hi: number): number => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))
  return { x: clamp(center.x, margin, win.width - margin), y: clamp(center.y, margin, win.height - margin) }
}
