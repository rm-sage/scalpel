import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  clampRadialScale,
  isRadialBackdrop,
  RADIAL_PLUGIN_ICON,
  type RadialBackdrop,
  type RadialBackdropEvent,
  type RadialBackdropFailure,
  type RadialOpenPayload,
} from '@shared/contracts/radial'
// The leaf, not shared/constants (which re-exports it): constants carries the
// item/div-card JSON, and this window has no use for a megabyte of it.
import { IP } from '@renderer/shared/icon-config'
import { PluginIconBadge } from '@renderer/shared/PluginTabIcon'
import { radialIcon } from '@renderer/shared/radial-icons'
import { textColorForBg } from '@renderer/shared/regex-preset-colors'
import {
  BACKDROP_BASE_FILTER,
  BACKDROP_FALLOFF_MASK,
  BACKDROP_FILTER,
  BACKDROP_OPACITY,
  DEFAULT_GEOMETRY,
  DISC_FEATHER_MASK,
  DISC_TINT,
  GOO_OPACITY_STYLE,
  loadGeometry,
  type RadialGeometry,
} from './backdrop-style'
// No DEADZONE_PX here: the deadzone is the drawn bubble's edge, and the bubble
// scales, so it is derived from the scaled centre radius rather than imported.
// No CENTER_RADIUS either - it reaches the ring as the geometry default, which
// the dev panel can override; only the goo blur still references a raw constant.
import {
  arcStep,
  clampCenter,
  DISC_PAD,
  gooConnected,
  gooLanding,
  ICON_HALO,
  pickSlice,
  RING_RADIUS,
  sliceAngle,
  slicePosition,
} from './geometry'
import { RadialDevPanel } from './RadialDevPanel'

/** Goo blur sigma, at the shipped ring radius. The liquid bridge survives a gap
 *  of ~1.35 sigma before the alpha threshold snaps it, so this has to travel
 *  with the ring: left fixed, a small ring would over-fuse into one lump and a
 *  large one would break the stretch a third of the way out. Which is why it is
 *  applied below as a fraction of RING_RADIUS rather than of the size knob -
 *  identical while the ring is the shipped one, and still right when the dev
 *  panel moves it.
 *
 *  4.96, not a rounder number, because it is a rendered value carried over
 *  rather than a fresh choice - for the third time. The sigma actually on screen
 *  is this constant times whatever ratio the drawn ring has to the base one, so
 *  every time that ratio gets folded into the base the constant has to absorb it
 *  or the goo quietly gets thinner than the thing that was signed off:
 *    6.5 -> 6.75  carrying a ring OVERRIDE of 80 against a base of 77
 *    6.75 -> 7.09 carrying an override of 84 against a base of 80
 *    7.09 -> 4.96 carrying the stored SCALE of 0.7 (7.09 x 0.7 = 4.963)
 *  The last is the odd one out: it folds the user's size knob rather than a dev
 *  panel override, because that knob had been silently scaling every judgement
 *  ever made about this ring. */
const GOO_BLUR = 4.96

/** Opt-in flag for the developer tuning panel, read fresh per open so toggling
 *  it in devtools takes effect on the next menu rather than the next relaunch.
 *  Guarded: a window with storage disabled must fall back to "off", not throw
 *  on the way to drawing the ring. */
export const TUNING_PANEL_KEY = 'radial-tuning-panel'
function tuningPanelEnabled(): boolean {
  try {
    return window.localStorage.getItem(TUNING_PANEL_KEY) === '1'
  } catch {
    return false
  }
}

/** The bubble's close affordance. Pulled through the ring's own icon registry
 *  rather than imported straight from IconPark, so it is the same glyph set, the
 *  same house two-tone config and the same chunk the slices already pay for. */
const CloseGlyph = radialIcon('CloseSmall')

/** Sigma of the antialiasing pass that runs AFTER the alpha threshold. Sub-pixel
 *  on purpose: this is not meant to soften the goo, only to hand the silhouette
 *  back the fractional coverage the threshold threw away. Big enough and the blob
 *  goes fuzzy and stops reading as liquid with surface tension; this is the
 *  smallest value that kills the staircase at devicePixelRatio 1, which is the
 *  worst case (a fractional-DPI display gets more device pixels per CSS px, so
 *  the same sigma covers more of them). Unlike GOO_BLUR it does NOT travel with
 *  the ring: it is measured in pixels of screen, not in units of goo. */
const GOO_EDGE_BLUR = 0.6

/** How close (as a fraction of the puck's radius) the blob's centre has to get
 *  to a slice's icon before that icon counts as "arrived at" and flips to the
 *  on-accent colour. Below 1 by a wide margin on purpose: the puck's leading
 *  edge touches the icon long before its centre does, and flipping then would
 *  put the light glyph on a background that is still mostly disc. */
const ARRIVE_FRACTION = 0.6

/** Per-frame lerp factors: lazy while tracking the cursor, hard while snapping
 *  in on click. The brief called for an instant (factor 1) snap; a single-frame
 *  38px jump tears the goo bridge, so the snap is a 3-4 frame lunge instead -
 *  still comfortably inside SNAP_MS, but the liquid stays connected. */
const FOLLOW = 0.25
const SNAP_FOLLOW = 0.45

/** Click -> fire delay. The snap animation plays in this window. */
const SNAP_MS = 160

/** How far the bubble slides toward the pull, as a fraction of its own radius.
 *  A quarter is about where it stops reading as "leaning" and starts reading as
 *  "sliding off its mark", so this sits just under. */
const LEAN_FRACTION = 0.22

/** Peak axis change for the squash-and-stretch, on both blobs. Volume is held
 *  roughly constant by scaling the two axes reciprocally, so this is the ONE
 *  number: 1 + k along the motion, 1 / (1 + k) across it. Past ~0.15 the circles
 *  start reading as ellipses that happen to be near each other rather than as
 *  one body of liquid under tension. */
const SQUISH_MAX = 0.12

/** Puck speed (px per frame) to squish factor. At FOLLOW = 0.25 the first frame
 *  of a full-reach throw travels ~11px, which this puts just over the cap - so
 *  the puck is at full stretch exactly when it is moving fastest and rounds
 *  itself off as the lerp decays. */
const VEL_TO_SQUISH = 0.012

/** Where the puck stops travelling in straight lines and starts travelling round
 *  the ring, as a fraction of the ring radius. Chosen to sit in the same
 *  territory as the bridge snapping: past here the puck has visibly left the
 *  bubble, so there is nothing left for a straight path to be faithful to. Below
 *  it the motion is genuinely radial - the pull out from rest, the collapse back
 *  home - and a chord IS the honest path. */
const ARC_ENTRY = 0.55

/** Per-frame convergence for the arc. Both flat exponentials, and deliberately
 *  the same rate the cartesian path uses: measured against the old chord, an
 *  adjacent transfer covers its arc in the same ~10-14 frames it used to take,
 *  so nothing about the pacing of the common case changed.
 *
 *  Flat rather than scaled by arc length, which was the alternative. Exponential
 *  convergence is scale-free, so an opposite-slice transfer finishes in the same
 *  wall time while covering twice the arc - it moves faster rather than lasting
 *  longer. Scaling the rate down to stretch it out was tried on paper and
 *  rejected: it makes the far half of the ring feel deliberately slower to reach
 *  than the near half, which is a worse lie than a quick sweep. */
const ARC_RATES = { angle: 0.25, radius: 0.25 }

/** How fast the lean unwinds once the bridge has snapped. Far snappier than
 *  FOLLOW because it is not tracking anything any more: the blob has physically
 *  let go, and liquid under tension that is suddenly released recoils rather
 *  than drifts back. Paired with the jelly spring on the same transition, which
 *  is what turns the recoil into a visible thump instead of a fast fade. */
const RECOIL_FOLLOW = 0.45

/** Below this many px, a direction vector is noise and gets no angle at all -
 *  otherwise a resting blob would spin its (invisible) stretch axis every frame
 *  on floating-point dust. */
const VEL_DEADZONE = 0.05

/** Arrival / re-absorb jelly. A damped sine on the radius: two or three visible
 *  oscillations inside a third of a second, small enough to read as the blob
 *  settling rather than as a bounce. Amplitude is deliberately the largest of
 *  the four liquid terms - it is the only one that fires on a discrete event, so
 *  it is the only one that gets to be noticed. */
const WOBBLE_AMP = 0.09
const WOBBLE_PERIOD_MS = 110
const WOBBLE_DECAY_MS = 130
const WOBBLE_LIFE_MS = 340

/** Idle breathing. Two summed sines at deliberately incommensurate periods, so
 *  the undulation never settles into a countable beat the way a single sine
 *  does. The amplitude is under 2% on purpose: a still screenshot of the menu
 *  has to look like a circle, and this is only ever meant to be caught out of
 *  the corner of the eye. */
const BREATH_AMP = 0.018
const BREATH_SLOW_MS = 3700
const BREATH_FAST_MS = 2900

/** The damped spring, sampled. Zero outside its life, so an untriggered wobble
 *  (t0 of -Infinity) and a finished one both cost one comparison. */
function wobbleAt(dt: number): number {
  if (!(dt >= 0) || dt > WOBBLE_LIFE_MS) return 0
  return WOBBLE_AMP * Math.exp(-dt / WOBBLE_DECAY_MS) * Math.sin((2 * Math.PI * dt) / WOBBLE_PERIOD_MS)
}

/** Place a circle at (cx + lx, cy + ly) and deform it about that point: stretched
 *  by 1 + k along `deg`, squashed by the reciprocal across it.
 *
 *  Written as a transform rather than by moving cx/cy and swapping in an ellipse
 *  because the goo filter works on the rendered alpha - it neither knows nor
 *  cares what shape produced it - and because a transform leaves the circle's
 *  own cx/cy/r as the honest logical values the rest of the loop reads back.
 *  The trailing translate(-cx -cy) is what makes the rotate/scale happen about
 *  the circle's centre instead of the SVG's origin. */
function deform(cx: number, cy: number, lx: number, ly: number, deg: number, k: number): string {
  const sx = 1 + k
  return (
    `translate(${(cx + lx).toFixed(2)} ${(cy + ly).toFixed(2)})` +
    ` rotate(${deg.toFixed(2)})` +
    ` scale(${sx.toFixed(4)} ${(1 / sx).toFixed(4)})` +
    ` translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`
  )
}

/** Readable glyph colour for a slice sitting on the accent-coloured puck.
 *
 *  Every other colour here is a live `var(--...)`, which is what keeps the ring
 *  in step when the user switches themes with the menu open. This one cannot
 *  be: the palette has no on-accent token, so the contrast has to be computed
 *  from the resolved accent. That is safe precisely because the view is keyed by
 *  open count - it remounts on every open, so the resolve is at most one menu
 *  stale, and a theme cannot change during the second the ring is up.
 *
 *  Palettes store `#rrggbb` and nothing else (see ThemePalette), so anything
 *  that fails the shape - a corrupt custom palette, or jsdom, where no
 *  stylesheet has defined the var at all - falls back to white, the right answer
 *  for the dark accents that all but one bundled preset uses. */
function onAccentColor(): string {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return /^#[0-9a-f]{6}$/i.test(accent) ? textColorForBg(accent) : '#ffffff'
}

export interface RadialMenuViewProps {
  payload: RadialOpenPayload
  /** Blurred grab of the game behind the menu, if one arrived for THIS open.
   *  Always optional: it lands after the ring is already up, and a capture that
   *  failed simply never arrives. */
  backdrop?: RadialBackdrop | null
  /** Which gate closed, when main answered "no image" rather than not yet.
   *  Developer-panel diagnostic only; the ring itself draws the same either way. */
  backdropFailure?: RadialBackdropFailure | null
  onFire: (sliceId: string) => void
  onCancel: () => void
}

/** The ring itself: pure presentation, no IPC. Driven by pointer position
 *  relative to `payload.center`, which arrives in the same CSS px space as this
 *  window (the radial overlay covers the whole game window 1:1).
 *
 *  Three layers on purpose. A backdrop disc in the theme's panel colour grounds
 *  the whole ring. The goo SVG above it is a centre bubble plus one moving blob,
 *  both in the theme accent, run through a blur + alpha-threshold filter, which
 *  is what makes them merge into a liquid bridge as the blob pulls away. Icons
 *  and labels are plain HTML *above* that SVG, so the filter never smears them
 *  and the blob reads as a puck behind the hovered glyph.
 *
 *  Every colour is a theme token. The radial window runs bootstrapTheme(), so
 *  the vars are live in here and re-resolve on a theme change for free - which
 *  is why they are referenced as var(), never baked into constants. That only
 *  holds because main includes this window in the 'setting-updated' fan-out
 *  (see broadcastSettingUpdate): the window is never closed, only faded out, so
 *  nothing else would ever re-read the palette. */
export function RadialMenuView({
  payload,
  backdrop,
  backdropFailure,
  onFire,
  onCancel,
}: RadialMenuViewProps): JSX.Element {
  const count = payload.slices.length
  // The user's size knob, resolved by main but re-clamped here: this view also
  // renders from stories and tests, and one clamp beats three. EVERY length
  // below derives from it, so the goo physics stay proportional at any size -
  // except the icons and labels, which stay at their designed px so a small
  // ring is smaller, not squintier.
  const s = clampRadialScale(payload.scale)
  // Developer mode at the moment main built this open, AND an explicit opt-in in
  // this window. Two gates because the tuning is finished: the panel is kept for
  // the next round of dials rather than deleted, but developerMode alone is a
  // setting people leave on for other reasons and it should not put a slider
  // rack over the menu. Main still resolves `payload.dev` exactly as before -
  // only this side tightened.
  //
  // To turn it on, in the radial window's devtools:
  //   localStorage.setItem('radial-tuning-panel', '1')
  // ...and reopen the menu. Removing the key (or setting anything else) hides it
  // again.
  //
  // Read before the geometry because the geometry's initialiser is gated on it:
  // the shipped path must not so much as touch localStorage.
  const dev = payload.dev === true && tuningPanelEnabled()
  // The two base lengths the whole ring is built from. Constants until the dev
  // panel overrides them, and the size knob multiplies either way - so `s` still
  // means exactly what it meant, and a tuned ring scales like a shipped one.
  const [geometry, setGeometry] = useState<RadialGeometry>(() => (dev ? loadGeometry() : DEFAULT_GEOMETRY))
  const ringRadius = geometry.ring * s
  const centerRadius = geometry.bubble * s
  // Pinned to the bubble rather than a constant of its own: the fused bridge
  // between two circles is only as wide as the smaller one, so a puck that
  // undercuts the bubble gives a thin thread pulling a bead instead of one body
  // of liquid stretching. (It also has to halo the ~20px glyph it sits behind,
  // which the shipped 25 does comfortably.)
  const blobRadius = centerRadius
  // The goo blur ACTUALLY on screen. Computed once here rather than inline in
  // the filter, because the loop needs the same number to decide whether the
  // bridge is still standing - and an answer derived from a different sigma than
  // the one being rendered would be an answer about a different menu.
  // Rounded to a sane number of places on the way out. The ratio is exactly 1 at
  // the shipped ring, but the float division still lands on 7.089999999999999,
  // and that would go into the filter's stdDeviation attribute verbatim.
  const gooSigma = Math.round((GOO_BLUR * ringRadius * 1000) / RING_RADIUS) / 1000
  // Only the geometry pair comes back up from the panel - the backdrop grade
  // never re-renders the ring. Returning `prev` unchanged makes React bail out,
  // so the panel can push on every tuning change without caring which knob moved.
  const applyGeometry = useCallback((g: RadialGeometry): void => {
    setGeometry((prev) => (prev.bubble === g.bubble && prev.ring === g.ring && prev.liquid === g.liquid ? prev : g))
  }, [])
  // Once per mount, same as `center`: the one colour that has to be computed
  // rather than referenced. See onAccentColor.
  const onAccent = useMemo(onAccentColor, [])
  // Once per mount: the drawn centre never moves while the menu is open. The
  // edge margin is the scaled ring plus the UNSCALED icon halo - the glyphs keep
  // their size, so the room they need off the ring does not shrink with it.
  const center = useMemo(
    () => clampCenter(payload.center, { width: window.innerWidth, height: window.innerHeight }, ringRadius + ICON_HALO),
    [payload.center, ringRadius],
  )
  // useId can emit colons, which are not legal in a bare url(#...) reference.
  const gooId = `radial-goo-${useId().replace(/:/g, '')}`

  const [hovered, setHovered] = useState<number | null>(null)
  const [firing, setFiring] = useState<number | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  // Hold-open: while the panel is up, clicks on the ring do nothing, so the menu
  // stays put for as long as it takes to dial the backdrop in. Kept as a ref as
  // well as state because the click handler must see the current value even when
  // the toggle and the click land in the same batch.
  const holdRef = useRef(true)
  const [holdOpen, setHoldOpen] = useState(true)
  const toggleHold = useCallback((): void => {
    holdRef.current = !holdRef.current
    setHoldOpen(holdRef.current)
  }, [])
  // What the capture actually decoded to, which is the one number neither main
  // nor the payload can tell us. Only tracked in dev - it costs a render.
  const [backdropSize, setBackdropSize] = useState<{ width: number; height: number } | null>(null)
  const clearHover = useCallback((): void => setHovered(null), [])

  const blobRef = useRef<SVGCircleElement>(null)
  const bubbleRef = useRef<SVGCircleElement>(null)
  const mouseRef = useRef({ x: center.x, y: center.y })
  const blobPosRef = useRef({ x: center.x, y: center.y, r: 0 })
  // How far the bubble has slid toward the pull, in px. Lerped in the loop like
  // the blob's own position, so the lean has the same lazy weight the rest of
  // the goo does rather than snapping to the cursor.
  const leanRef = useRef({ x: 0, y: 0 })
  // Frame clocks the two jelly springs were triggered at; -Infinity via `??`
  // when they have never fired. Refs, not state: a spring that re-rendered the
  // ring 60 times a second to wobble a radius would be an absurd trade.
  const puckWobbleRef = useRef<number | null>(null)
  const bubbleWobbleRef = useRef<number | null>(null)
  // The close glyph's wrapper. React never sets a style prop on it, which is
  // what lets the loop own its transform outright - the same arrangement the
  // custom properties rely on, for the same reason.
  const closeRef = useRef<HTMLDivElement>(null)
  // Whether the goo still reads as one body. True at rest, where the blob sits
  // at zero radius inside the bubble.
  const connectedRef = useRef(true)
  // Liquid amplitude as a 0-1.5 factor. Mirrored into a ref because it must NOT
  // be in the animation effect's dependency list: remounting the loop on every
  // slider tick would restart the springs and reset the breathing phase.
  const liquidRef = useRef(geometry.liquid / 100)
  useEffect(() => {
    liquidRef.current = geometry.liquid / 100
  }, [geometry.liquid])
  // Icon wrappers by slice index, plus the index currently wearing
  // `data-arrived`. Both exist so the rAF loop can flip one glyph's colour the
  // frame the puck reaches it without a render - see the arrival block below.
  const iconRefs = useRef<Array<HTMLDivElement | null>>([])
  const arrivedRef = useRef<number | null>(null)
  // Mirrors of the selection state so the rAF loop can mount once and still see
  // the current values without React re-rendering on every frame.
  const hoveredRef = useRef<number | null>(null)
  const firingRef = useRef<number | null>(null)
  useEffect(() => {
    hoveredRef.current = hovered
  }, [hovered])
  useEffect(() => {
    firingRef.current = firing
  }, [firing])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      // Selection is synchronous with the pointer - the rAF loop only animates.
      if (firingRef.current != null) return
      // Deadzone IS the drawn bubble's edge (see DEADZONE_PX), so it scales with
      // the bubble or the ring would pick before the cursor had left the goo.
      setHovered(pickSlice(center, mouseRef.current, count, centerRadius))
    },
    [center, count, centerRadius],
  )

  const fireTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (fireTimer.current != null) clearTimeout(fireTimer.current)
    },
    [],
  )

  const handleClick = useCallback((): void => {
    if (firingRef.current != null) return
    // Hold open: neither fire nor cancel, so the ring survives a stray click
    // while the developer panel is being worked. Deliberately not a close path
    // of its own - the hotkey re-press and Escape both close from main, and
    // neither one comes through here.
    if (dev && holdRef.current) return
    // Picked fresh off the live cursor rather than read out of `hoveredRef`,
    // which a passive effect only syncs after a commit: under concurrent
    // rendering a click can land before the pointermove's render lands, and
    // reading the ref there would cancel the menu instead of firing.
    const target = pickSlice(center, mouseRef.current, count, centerRadius)
    if (target == null) {
      onCancel()
      return
    }
    setFiring(target)
    firingRef.current = target
    const id = payload.slices[target].id
    fireTimer.current = setTimeout(() => onFire(id), SNAP_MS)
  }, [center, count, centerRadius, dev, onCancel, onFire, payload.slices])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || firingRef.current != null) return
      onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Blob animation. Imperative setAttribute in a rAF loop - never React state,
  // so a 60fps blob costs zero renders. jsdom under fake timers has no real
  // frame clock, which is why nothing here feeds selection state.
  //
  // The geometry needs no ref mirror the way `hovered`/`firing` do: those change
  // at pointer speed and must not remount the loop, whereas a dev-panel slider
  // change is already in this effect's deps, so the loop simply re-subscribes on
  // the new lengths. `blobPosRef` outlives that, so the puck resizes from where
  // it is instead of jumping back to the centre.
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return
    let frame = 0
    const tick = (now: number): void => {
      // rAF hands us the frame clock. Defended because jsdom's shim under fake
      // timers is not obliged to, and every time-driven term below is a sine
      // that reads zero at t=0 - so a clockless environment simply gets the
      // static shape, which is exactly what its snapshots want.
      const t = Number.isFinite(now) ? now : 0
      // Liquid amplitude, read from a ref rather than the effect's closure on
      // purpose: the slider must not remount the loop, or every drag would reset
      // the springs mid-oscillation.
      const L = liquidRef.current

      const fire = firingRef.current
      const hov = hoveredRef.current
      const sel = fire ?? hov
      const p = blobPosRef.current
      const el = blobRef.current
      if (el) {
        let target: { x: number; y: number; r: number }
        // The reach the arc lerps its radius toward, when arcing. Only meaningful
        // while a slice is hovered, which is the only case that can arc.
        let reach = ringRadius
        if (fire != null) {
          target = { ...slicePosition(center, fire, count, ringRadius), r: blobRadius }
        } else if (hov != null) {
          // Reach scales with how far past the deadzone the cursor is, so the
          // goo stretches under the user's hand instead of teleporting. The
          // deadzone is the bubble's own edge, so the ramp starts where the
          // bubble ends and tops out at the icon ring - cursor on the icon puts
          // the puck behind the icon.
          const dist = Math.hypot(mouseRef.current.x - center.x, mouseRef.current.y - center.y)
          const t = Math.min(1, Math.max(0, (dist - centerRadius) / (ringRadius - centerRadius)))
          reach = centerRadius + (ringRadius - centerRadius) * t
          target = { ...slicePosition(center, hov, count, reach), r: blobRadius }
        } else {
          target = { x: center.x, y: center.y, r: 0 }
        }
        const k = fire != null ? SNAP_FOLLOW : FOLLOW

        // Around the ring, or across it? A straight lerp between two slices
        // draws a chord, and a chord sags inward - far enough to brush the
        // centre bubble on any ring, and straight through it for opposite
        // slices. Once the puck is already out near the ring there is no reason
        // for it to come back in at all: it slides around instead.
        //
        // Only the slice-to-slice case. The pull out from rest and the collapse
        // back home are radial by nature and stay cartesian - that stretch and
        // that landing are the good parts. A fire lunges straight at its slice
        // too, which is right: the click target is the slice you are already on.
        //
        // The two modes meet without a seam because arcStep lerps radius as well
        // as angle. Crossing the threshold on the way out, the angle gap is
        // already ~0 (the puck is travelling along its slice's own radius), so
        // the switch is a no-op; crossing it on a transfer, the radial term
        // simply bends the path onto the ring.
        const out = Math.hypot(p.x - center.x, p.y - center.y)
        const arcing = fire == null && hov != null && out > ringRadius * ARC_ENTRY
        const next = arcing
          ? arcStep(p, sliceAngle(hov, count), center, reach, ARC_RATES)
          : { x: p.x + (target.x - p.x) * k, y: p.y + (target.y - p.y) * k }
        // This frame's travel, taken as the difference rather than computed from
        // the lerp: it IS the puck's velocity whichever mode produced it, so the
        // stretch below follows the arc's tangent for free.
        const vx = next.x - p.x
        const vy = next.y - p.y
        p.x = next.x
        p.y = next.y
        p.r += (target.r - p.r) * k
        el.setAttribute('cx', p.x.toFixed(2))
        el.setAttribute('cy', p.y.toFixed(2))
        el.setAttribute('r', (p.r * (1 + wobbleAt(t - (puckWobbleRef.current ?? -Infinity)) * L)).toFixed(2))
        // Stretched along where it is going, squashed across it, and it rounds
        // itself off as it slows - so the puck reads as something with mass
        // being thrown rather than a sprite being moved.
        const speed = Math.hypot(vx, vy)
        el.setAttribute(
          'transform',
          deform(
            p.x,
            p.y,
            0,
            0,
            speed > VEL_DEADZONE ? (Math.atan2(vy, vx) * 180) / Math.PI : 0,
            Math.min(SQUISH_MAX, speed * VEL_TO_SQUISH) * L,
          ),
        )

        // Arrival. Hover is instant but the puck takes ~150ms to get there, and
        // a glyph that flips to the on-accent colour while the accent is still
        // in transit is briefly light-on-disc - unreadable, and it reads as the
        // colour racing ahead of the liquid. So the flip waits for the blob to
        // actually be under the icon. Only the COLOUR waits: the scale/opacity
        // lift stays on hover, because that is the affordance that says "this
        // one is selected" and it must answer the pointer immediately.
        //
        // Written as an attribute, never state: this runs at 60fps, and one
        // setState per frame would re-render the whole ring. Only transitions
        // touch the DOM, so a steady hover costs nothing after the first frame.
        //
        // Keyed off the blob's LOGICAL position against the slice's LOGICAL
        // position, both untouched by any of the deformation above - so the
        // flip's timing is exactly what it was before the goo learned to wobble.
        let want: number | null = null
        if (sel != null) {
          const ip = slicePosition(center, sel, count, ringRadius)
          if (Math.hypot(p.x - ip.x, p.y - ip.y) < blobRadius * ARRIVE_FRACTION) want = sel
        }
        if (want !== arrivedRef.current) {
          const prev = arrivedRef.current
          if (prev != null) iconRefs.current[prev]?.removeAttribute('data-arrived')
          if (want != null) {
            iconRefs.current[want]?.setAttribute('data-arrived', 'true')
            // Landed. The jelly settle is the payoff for the travel.
            puckWobbleRef.current = t
          }
          arrivedRef.current = want
        }
      }

      // Is the goo still one body? Answered from the LOGICAL circles - the same
      // numbers the hit test reads, never the leaned and stretched drawn ones -
      // and against the sigma actually being rendered.
      const connected = gooConnected(Math.hypot(p.x - center.x, p.y - center.y), centerRadius, p.r, gooSigma)
      // Only a genuine homecoming is an impact: the blob landing back in the
      // bubble because it has nowhere else to be. NOT every re-fusion - moving
      // straight from one slice to the next drags the blob across the chord
      // between them, which dips inside the bridge limit and re-fuses in
      // passing, and thumping the bubble there pulsed the centre in the middle
      // of a gesture that never went home. See gooLanding for that arithmetic;
      // `sel == null` is exactly "the blob's target is the centre".
      //
      // The break edge gets no spring - user-tuned call - because a jiggle there
      // fights the fast RECOIL_FOLLOW unwind and reads as the bubble being
      // struck by nothing; the clean high-speed snap back to round IS the
      // release. (The puck's own arrival wobble is a different ref on a
      // different circle, so the two can overlap without compounding.)
      if (gooLanding(connectedRef.current, connected, sel == null)) bubbleWobbleRef.current = t
      connectedRef.current = connected

      // The bubble. Static until now, which is what made the whole ring feel
      // like a picture that a blob occasionally leaves: it has to answer the
      // cursor from the very first pixel of movement, long before the cursor
      // crosses the deadzone and anything else happens.
      const bubble = bubbleRef.current
      if (bubble) {
        const leanMax = centerRadius * LEAN_FRACTION * L
        let tlx = 0
        let tly = 0
        // Only while the bridge holds. Once the blob has physically detached
        // there is nothing pulling on the bubble any more, and a bubble that
        // kept leaning at a slice it is no longer connected to read as a
        // permanently lopsided circle rather than as liquid under tension.
        if (leanMax > 0 && connected) {
          if (sel != null) {
            // Past the deadzone the cursor's own vector stops being the honest
            // direction - the ring has committed to a slice, so the bubble
            // leans at the slice and holds there while the puck stretches away.
            const u = slicePosition(center, sel, count, 1)
            tlx = (u.x - center.x) * leanMax
            tly = (u.y - center.y) * leanMax
          } else {
            const mdx = mouseRef.current.x - center.x
            const mdy = mouseRef.current.y - center.y
            const md = Math.hypot(mdx, mdy)
            // Ramps from nothing at the exact centre to the full lean at the
            // bubble's edge, so there is no threshold to feel - the goo starts
            // answering the instant the hand moves.
            if (md > VEL_DEADZONE) {
              const ramp = Math.min(1, md / centerRadius)
              tlx = (mdx / md) * leanMax * ramp
              tly = (mdy / md) * leanMax * ramp
            }
          }
        }
        const lean = leanRef.current
        const pull = connected ? FOLLOW : RECOIL_FOLLOW
        lean.x += (tlx - lean.x) * pull
        lean.y += (tly - lean.y) * pull

        const lm = Math.hypot(lean.x, lean.y)
        bubble.setAttribute(
          'transform',
          deform(
            center.x,
            center.y,
            lean.x,
            lean.y,
            lm > VEL_DEADZONE ? (Math.atan2(lean.y, lean.x) * 180) / Math.PI : 0,
            // Normalised against the cap so the squish tracks how far the lean
            // has actually gone, not how big the cap happens to be.
            leanMax > 0 ? SQUISH_MAX * Math.min(1, lm / leanMax) * L : 0,
          ),
        )
        // Breathing runs always rather than only at rest: at this amplitude it
        // is invisible next to a lean or a wobble, and gating it would mean a
        // discontinuity every time a selection ended.
        const breath =
          BREATH_AMP *
          (Math.sin((2 * Math.PI * t) / BREATH_SLOW_MS) * 0.6 + Math.sin((2 * Math.PI * t) / BREATH_FAST_MS) * 0.4)
        const settle = wobbleAt(t - (bubbleWobbleRef.current ?? -Infinity))
        bubble.setAttribute('r', (centerRadius * (1 + (breath + settle) * L)).toFixed(2))

        // The close glyph rides the lean so it stays centred in the blob, but
        // takes NONE of the deformation - a static mark on a liquid body, the
        // same relationship the slice glyphs have with their puck. One transform
        // write, unconditional: cheaper than deciding whether it changed.
        if (closeRef.current)
          closeRef.current.style.transform = `translate(${lean.x.toFixed(2)}px, ${lean.y.toFixed(2)}px)`
      }

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [center, count, ringRadius, centerRadius, blobRadius, gooSigma])

  // Encloses the whole menu: the icon ring plus its halo plus a little breathing
  // room, so no glyph or label chip sits on the disc's edge. Same split as the
  // clamp margin - scaled ring, unscaled halo, because the glyphs keep their px.
  const discSize = 2 * (ringRadius + ICON_HALO + DISC_PAD)
  // Where the capture sits inside the disc's box. Shared by both passes of the
  // frosted glass below, which have to land on exactly the same pixels or the
  // cross-fade between them would read as a double image.
  const backdropBox: React.CSSProperties | undefined = backdrop
    ? {
        left: backdrop.origin.x - (center.x - discSize / 2),
        top: backdrop.origin.y - (center.y - discSize / 2),
        width: backdrop.width,
        height: backdrop.height,
      }
    : undefined

  return (
    <div
      ref={rootRef}
      data-testid="radial-root"
      className="fixed inset-0 select-none"
      // While the menu is up the blob IS the pointer; the OS cursor on top of
      // it reads as two cursors. The window only exists while the menu is
      // open, so this never hides the cursor over the game itself.
      style={{ cursor: 'none' }}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {/* Everything below is decoration: all pointer handling lives on the root
          so the hit test is one clean polar lookup, never per-element hover. */}
      <div
        className="radial-pop absolute inset-0 pointer-events-none"
        style={{ transformOrigin: `${center.x}px ${center.y}px` }}
      >
        {/* The menu's ground: one disc under everything, so the glyphs have
            something of their own to sit on no matter what the game is drawing.
            Stacked layers inside a circular clip, all of them fading out toward
            the rim so the disc dissolves into the scene rather than ending in a
            hard frosted circle - see DISC_FEATHER_MASK, which takes the whole
            stack together. Below the goo SVG in DOM order: the blob has to read
            as liquid ON the disc, not be hidden by it, and it keeps its full
            alpha because only the GROUND dissolves, never the menu. */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: center.x,
            top: center.y,
            width: discSize,
            height: discSize,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            pointerEvents: 'none',
            maskImage: DISC_FEATHER_MASK,
            WebkitMaskImage: DISC_FEATHER_MASK,
          }}
        >
          {/* Frosted glass, in two passes. One static frame of the game, blurred
              once by the compositor - no capture loop, no backdrop-filter (which
              would make the whole window a compositing surface for the sake of a
              disc). Placed by the crop's own game-CSS-px origin rather than by
              any agreement with main's crop rule, which is what keeps it aligned
              1:1 with the pixels it is covering even though the drawn centre has
              been clamped away from the point main cropped around.
              max-w-none: preflight's `img { max-width: 100% }` would otherwise
              squash it to the disc and destroy that alignment. */}
          {backdrop && (
            <>
              {/* Base pass: the capture sharp, with only a light fraction of the
                  grade (see BACKDROP_BASE_FILTER). No blur at all, so the rim
                  reads as the game rather than as a weaker frost. */}
              <img
                data-testid="radial-backdrop"
                src={backdrop.dataUrl}
                alt=""
                draggable={false}
                className="radial-backdrop absolute max-w-none"
                style={{ ...backdropBox, filter: BACKDROP_BASE_FILTER, opacity: BACKDROP_OPACITY }}
                onLoad={
                  dev
                    ? (e) =>
                        setBackdropSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        })
                    : undefined
                }
              />
              {/* Frost pass: the same frame blurred and graded, cross-faded over
                  the sharp one. The mask has to live on a wrapper rather than on
                  the image, because the image is sized to the CROP and offset by
                  the clamp - its centre is not the disc's. The wrapper is the
                  disc's own box, so the gradient's percentages mean what they
                  say. Same decoded image as above, so this is one more composited
                  layer and not a second download. */}
              <div
                data-testid="radial-backdrop-frost"
                className="absolute inset-0"
                style={{ maskImage: BACKDROP_FALLOFF_MASK, WebkitMaskImage: BACKDROP_FALLOFF_MASK }}
              >
                <img
                  src={backdrop.dataUrl}
                  alt=""
                  draggable={false}
                  className="radial-backdrop absolute max-w-none"
                  style={{ ...backdropBox, filter: BACKDROP_FILTER, opacity: BACKDROP_OPACITY }}
                />
              </div>
            </>
          )}
          {/* The theme's panel colour over it (see DISC_TINT). On the same
              falloff geometry as the frost, so the two read as one effect. On
              top of the capture, not under it: it is what ties an arbitrary
              patch of game art back to the palette, and it is also the entire
              disc when no capture arrives. */}
          <div data-testid="radial-disc-tint" className="absolute inset-0" style={{ background: DISC_TINT }} />
        </div>

        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            {/* Region, not decoration. The tightest case is the ring at rest,
                where the bbox is just the bubble (~70px) and the margin is
                therefore only a fraction of that: it has to hold 3 sigma of
                GOO_BLUR (~20px) PLUS the lean (up to 0.22r, and the liquid
                slider goes to 150%) PLUS the stretch. At -50%/200% that summed
                to just over the margin and the goo would have been clipped flat
                on one side at full lean. 60% of a 70px bbox is 42px, which
                clears it with room. */}
            <filter id={gooId} x="-60%" y="-60%" width="220%" height="220%">
              {/* Bridge length scales with sigma (it survives a gap of ~1.35
                  sigma before the threshold snaps it), so this tracks the ring
                  radius - at the old 7 the stretch would break a third of the
                  way out on the larger dial and the goo would read as two
                  separate circles. Written against the drawn ringRadius rather
                  than the size knob so it also travels with a dev-panel ring
                  override; the two are the same number on the shipped ring. */}
              <feGaussianBlur in="SourceGraphic" stdDeviation={gooSigma} result="blur" />
              {/* Alpha threshold: 22a - 11 crosses zero at a = 0.5, so the blur's
                  falloff snaps back to a hard edge - which is what fuses the two
                  circles into one blob wherever their blurs overlap. */}
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
                result="fused"
              />
              {/* ...and the price of that hard edge is that it is HARD: the
                  threshold takes alpha from 0 to 1 across a fraction of a pixel,
                  so the silhouette lands on the pixel grid with no coverage
                  information and reads as stair-stepped, most visibly on the
                  bubble's shoulders and the waist of the bridge.
                  Half a pixel of blur afterwards is the whole fix - it gives the
                  edge back the partial coverage the threshold destroyed without
                  touching the shape, because at this sigma everything more than
                  a pixel inside the silhouette is still fully opaque. Deliberately
                  the last step: put it before the matrix and the threshold would
                  simply re-harden it. */}
              <feGaussianBlur in="fused" stdDeviation={GOO_EDGE_BLUR} />
            </filter>
          </defs>
          {/* Two rules fight here. The fill must come through `style` so the
              var() resolves (SVG paint attributes do not take custom
              properties), and the translucency must be group `opacity`, not a
              translucent fill - the threshold above would eat the alpha and hand
              back a solid shape. So the accent goes on the fill and the opacity
              on the already-fused result.
              Opacity rides `style` for the same reason the fill does: it is a
              custom property now, and the SVG presentation attribute cannot take
              one. Still group opacity either way, which is the part that
              matters. */}
          <g
            data-testid="radial-goo"
            filter={`url(#${gooId})`}
            style={{ fill: 'var(--accent)', opacity: GOO_OPACITY_STYLE }}
          >
            {/* Both circles keep their honest logical cx/cy/r; the lean, the
                stretch and the squash all ride on `transform`, which the goo
                filter neither knows nor cares about - it only ever sees alpha.
                Nothing that decides anything (the deadzone, the slice hit test,
                the arrival flip) reads these attributes, so the drawn shape is
                free to misbehave without the ring feeling different. */}
            <circle ref={bubbleRef} data-testid="radial-bubble" cx={center.x} cy={center.y} r={centerRadius} />
            <circle ref={blobRef} cx={center.x} cy={center.y} r={0} />
          </g>
        </svg>

        {/* The bubble's close affordance, and ONLY while a click there would
            actually close: with a slice selected the centre is somewhere the
            gesture passes through, not a button, and an X sitting on it would be
            promising the wrong thing.
            HTML above the SVG, like the slice glyphs, so the goo filter never
            smears it. The outer div is React's - it owns the placement at the
            logical centre - and the inner one is the loop's, carrying the lean
            so the mark stays centred in a blob that is sliding and breathing
            underneath it. It takes none of the squash: a static mark on a liquid
            body is exactly the relationship the slice glyphs have with the puck.
            Colour is the computed on-accent value, since it always sits on the
            accent bubble - never on the disc. */}
        <div
          data-testid="radial-close"
          data-visible={hovered == null && firing == null ? 'true' : 'false'}
          className="radial-close absolute"
          style={{ left: center.x, top: center.y, transform: 'translate(-50%, -50%)', color: onAccent }}
        >
          <div ref={closeRef} className="flex items-center justify-center">
            <CloseGlyph size={15} {...IP} />
          </div>
        </div>

        {payload.slices.map((slice, i) => {
          const pos = slicePosition(center, i, count, ringRadius)
          // The sentinel is not a glyph name, so it must never reach radialIcon
          // (which would silently hand back its AllApplication fallback rather
          // than the Components one this path has always used).
          const wantsPluginArt = slice.icon === RADIAL_PLUGIN_ICON
          const pluginArt = wantsPluginArt ? slice.iconSvg : undefined
          const Icon = radialIcon(wantsPluginArt ? 'Components' : slice.icon)
          const lit = firing === i
          const on = hovered === i || lit
          return (
            <div
              key={slice.id}
              data-testid="radial-slice"
              data-hovered={on}
              className="absolute"
              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
            >
              {/* Colour lives on the wrapper, not the glyph: both icon shapes
                  paint currentColor (the house IP config for IconPark, and
                  plugin SVGs by convention), so one property themes both. At
                  rest that is the theme's text colour on the panel disc; once
                  the accent puck is actually under a slice the glyph has to
                  contrast with the accent instead.
                  The flip itself is a stylesheet rule on `data-arrived`, which
                  the rAF loop sets - so `color` must NOT be set inline here or
                  it would outrank the rule. The resolved on-accent value rides
                  in as a custom property instead, which no cascade fights. */}
              <div
                ref={(el) => {
                  iconRefs.current[i] = el
                }}
                className={`radial-icon relative flex items-center justify-center transition-all duration-150 ease-out ${
                  lit ? 'scale-[1.4] opacity-100' : on ? 'scale-125 opacity-100' : 'scale-100 opacity-[0.85]'
                }`}
                style={{ '--radial-on-accent': onAccent } as React.CSSProperties}
              >
                {/* Plugin art only when the slice ASKED for it. The enrichment
                    used to win unconditionally, which meant a plugin slice could
                    never wear a chosen glyph; now the sentinel is what opts in,
                    and any real icon name beats the enrichment. A sentinel with
                    no art (plugin uninstalled, or it registered no tab icon)
                    falls through to the Components glyph, same as before.
                    The art's colour is pinned rather than inherited: the badge
                    carries its own background, so letting the arrived flip
                    repaint the art would put a dark glyph on a dark token the
                    moment the accent puck landed. The badge's stroke and the
                    IconPark branch keep inheriting, which is what that flip is
                    for. */}
                {pluginArt ? (
                  <PluginIconBadge icon={pluginArt} size={24} testId="radial-plugin-badge" />
                ) : (
                  <Icon size={20} {...IP} />
                )}
              </div>
              {/* Outside the scaling wrapper so the type stays crisp, and a
                  filled chip rather than bare text: the label can land on the
                  accent goo (diagonal slices) or on any patch of the game, and
                  bare text survives neither. */}
              {on && (
                <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-[3px] border border-border bg-bg-solid px-1.5 py-[3px] text-[10px] leading-none text-text">
                  {slice.label}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Outside the `radial-pop` layer, which is pointer-events-none and
          animates from the menu's centre - the panel is neither part of the ring
          nor allowed to be inert. */}
      {dev && (
        <RadialDevPanel
          backdrop={backdrop}
          failure={backdropFailure}
          naturalSize={backdropSize}
          rootRef={rootRef}
          holdOpen={holdOpen}
          onToggleHold={toggleHold}
          onHoverPanel={clearHover}
          onGeometryChange={applyGeometry}
        />
      )}
    </div>
  )
}

/** IPC wrapper mounted by the radial window. Holds the open payload and resets
 *  the view's state on every open by keying it with an open counter. */
export function RadialMenu(): JSX.Element | null {
  const [payload, setPayload] = useState<RadialOpenPayload | null>(null)
  const [openCount, setOpenCount] = useState(0)
  // The image OR the reason there isn't one - main answers on one channel
  // either way, so a menu can tell "the grab failed" from "still waiting".
  const [backdrop, setBackdrop] = useState<RadialBackdropEvent | null>(null)

  // Guards the one-shot PENDING pull below, which is the only thing that can
  // resolve out of order. Set by an open (that pull's payload is redundant) and
  // by a close (it is worse than redundant - it would reopen a menu that is
  // already gone). Never reset: OPEN_EVENT is not gated by it, so reopening
  // after a close still works.
  const pendingStaleRef = useRef(false)

  useEffect(() => {
    let alive = true
    const open = (p: RadialOpenPayload): void => {
      if (!alive) return
      pendingStaleRef.current = true
      setPayload(p)
      setOpenCount((n) => n + 1)
      // The previous open's capture is game pixels from wherever the cursor was
      // last time. Drop it here as well as on close, because an open is also
      // how a menu ends when the user toggles straight to a new one.
      setBackdrop(null)
    }
    // Main hides the window by dropping its opacity, so nothing here unmounts
    // on its own - without this the ring keeps its rAF loop running and comes
    // back mid-gesture the next time the window is shown.
    const close = (): void => {
      if (!alive) return
      pendingStaleRef.current = true
      setPayload(null)
      setBackdrop(null)
    }
    // PENDING covers the first-open race: the window is created lazily, so both
    // of main's sends can land while this renderer is still booting, and
    // webContents.send has no queue.
    //
    // The two halves are caught back differently. Either side can win the race
    // for the PAYLOAD, so the pull only applies it if OPEN_EVENT has not already
    // delivered - otherwise one open bumps the key twice and remounts the view
    // mid-animation. The BACKDROP is applied unconditionally: winning the
    // payload race says nothing about the image, which travels on its own
    // channel, lands tens of milliseconds later, and can have been dropped on
    // its own. Nothing needs guarding there because the nonce match at render
    // time is what keeps a stale capture off the disc.
    //
    // Order matters: `open` clears the backdrop (a new menu must not inherit the
    // last one's pixels), so the pull's own backdrop has to be written after it.
    // Both are setState calls in one tick, so React keeps the later write.
    void window.api.radialPending().then((state) => {
      if (!alive || !state) return
      if (state.payload && !pendingStaleRef.current) open(state.payload)
      if (state.backdrop) setBackdrop(state.backdrop)
    })
    const off = window.api.onRadialOpen(open)
    const offClose = window.api.onRadialClose(close)
    const offBackdrop = window.api.onRadialBackdrop((b) => {
      if (alive) setBackdrop(b)
    })
    return () => {
      alive = false
      off()
      offClose()
      offBackdrop()
    }
  }, [])

  const handleFire = useCallback((sliceId: string): void => {
    window.api.radialFire(sliceId)
    setPayload(null)
  }, [])
  const handleCancel = useCallback((): void => {
    window.api.radialCancel()
    setPayload(null)
  }, [])

  if (!payload) return null
  // Nonce match, checked here rather than in the subscription: main sends the
  // backdrop and the open on separate channels, so either order is possible and
  // an unmatched image should sit inert rather than be thrown away. A payload
  // with no nonce at all (older shape) simply never gets a backdrop.
  const answer = backdrop && payload.nonce != null && backdrop.nonce === payload.nonce ? backdrop : null
  const live = answer && isRadialBackdrop(answer) ? answer : null
  const failure = answer && !isRadialBackdrop(answer) ? answer.failure : null
  return (
    <RadialMenuView
      key={openCount}
      payload={payload}
      backdrop={live}
      backdropFailure={failure}
      onFire={handleFire}
      onCancel={handleCancel}
    />
  )
}
