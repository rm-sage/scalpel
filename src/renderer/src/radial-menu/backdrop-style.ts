/** The developer tuning blob, and how the captured game pixels are composited
 *  under the ring.
 *
 *  The blob is one stored object but it reaches the ring by two different
 *  routes, and the split is deliberate. The backdrop grade is pure paint, so it
 *  ships as `var()` FALLBACKS the panel overrides with setProperty - five
 *  property writes retune the live menu with no render of the ring at all. (It
 *  has to be the fallback and not an inline React style: hover re-renders the
 *  view constantly, and React would write the shipped default straight back over
 *  anything the panel had set.) The geometry pair cannot work that way - it
 *  drives the polar hit test, the icon ring and the clamp - so it travels as
 *  React state on the view instead, and only that pair costs a render.
 *
 *  With no panel mounted - every non-developer open, plus tests and stories -
 *  the fallbacks and the defaults are simply the shipped look. */
import { RADIAL_BACKDROP_HALF_PX } from '@shared/contracts/radial'
import { CENTER_RADIUS, DISC_PAD, ICON_HALO, RING_RADIUS } from './geometry'

/** Treatment for the captured game pixels behind the disc. Frosted glass, not a
 *  window: the point is to keep the scene's light and colour so the ring feels
 *  seated in it, while making sure nothing back there competes with the glyphs.
 *
 *  The blur is deliberately SMALL, which is the opposite of where this started.
 *  An 18px blur was chosen on the theory that anything still legible under the
 *  menu is noise; dialled against the real game it turned out to be doing the
 *  damage instead - it flattened the crop to a single colour and the disc read
 *  as a grey hole rather than as glass over the scene. At 2px the scene is still
 *  recognisably there, softened just enough to stop competing with the glyphs,
 *  and the radial falloff plus the grade below do the rest of the work.
 *
 *  The grade is the legibility floor: DISC_ALPHA alone was tuned against the
 *  game as an out-of-focus background, and a bright, saturated patch pulled
 *  INSIDE the disc is a harder case than that. Knocking the capture back before
 *  the tint goes over it keeps the worst art readable without flattening the
 *  dark scenes that are the common one. */
export const BACKDROP_BLUR_PX = 2
export const BACKDROP_SATURATE = 0.8
export const BACKDROP_BRIGHTNESS = 0.62

/** Backdrop disc alpha. THE dial for this menu: the disc has to ground the ring
 *  against arbitrary game art, but it must stay well below the goo's opacity or
 *  the blob stops reading against it and the whole gesture goes flat. Higher
 *  than the old light disc's 0.3 because the glyphs flipped to light-on-dark:
 *  a dark panel needs more coverage than a white wash did to beat bright art. */
export const DISC_ALPHA = 0.55

/** Goo opacity, applied to the group rather than the fill - see the goo filter,
 *  whose alpha threshold would eat a translucent fill and hand back a solid
 *  shape. The goo is the accent, and it has to be unmistakably the loudest thing
 *  on screen, so this sits above DISC_ALPHA - though less far above it than the
 *  first draft's 0.85, which at the larger bubble baked in below read as a solid
 *  plug rather than as liquid sitting on the disc.
 *
 *  Lives here rather than with the ring because it is a tuning value, and
 *  DEFAULT_TUNING has to be able to name it without importing the view. */
export const GOO_OPACITY = 0.7

/** As a style value: group opacity through CSS rather than the SVG presentation
 *  attribute, which is the only way a custom property can reach it. Group
 *  opacity either way, which is the part the filter cares about. */
export const GOO_OPACITY_STYLE = `var(--radial-goo, ${GOO_OPACITY})`

/** Liquid amplitude at 100%. A percentage rather than a fraction so it reads the
 *  same as every other slider in the panel, and so 100 is unmistakably "the
 *  tuned look" rather than an arbitrary 1. */
export const LIQUID_DEFAULT = 100

export const BACKDROP_FILTER =
  `blur(var(--radial-blur, ${BACKDROP_BLUR_PX}px))` +
  ` saturate(var(--radial-saturate, ${BACKDROP_SATURATE}))` +
  ` brightness(var(--radial-brightness, ${BACKDROP_BRIGHTNESS}))`

/** How much of the centre grade the SHARP base pass keeps.
 *
 *  Not zero, which is what it wants to be on paper. A completely ungraded base
 *  turned the effect inside out - frosted in the middle, a bright loud band of
 *  raw game art around it - and the label chips, which hang below the icons and
 *  so sit further out than the glyph ring, landed squarely in that band. A light
 *  knock-back keeps the rim reading as the game while still giving everything
 *  out there a floor, and because it is a FRACTION of the same tuned values it
 *  follows every slider (and collapses to no grade at all in Raw view, where
 *  --radial-brightness is 1). */
const BASE_GRADE = 0.45
export const BACKDROP_BASE_FILTER =
  `saturate(calc(1 - (1 - var(--radial-saturate, ${BACKDROP_SATURATE})) * ${BASE_GRADE}))` +
  ` brightness(calc(1 - (1 - var(--radial-brightness, ${BACKDROP_BRIGHTNESS})) * ${BASE_GRADE}))`

/** On the capture image itself, so the panel can fade the game out from under
 *  the tint without touching the tint. */
export const BACKDROP_OPACITY = 'var(--radial-backdrop-opacity, 1)'

/** Where the treatment starts giving way to the untouched game, as a percentage
 *  of the disc's radius. Everything above holds the full centre values; from
 *  here out the frosted copy and the tint both fade to nothing at the rim, so
 *  the disc dissolves into the scene instead of ending in a hard frosted circle.
 *
 *  65 puts the start of the fade just OUTSIDE the glyph ring, which sits at
 *  RING_RADIUS out of a disc of RING_RADIUS + ICON_HALO + DISC_PAD - about 62%.
 *  So the icons keep the full treatment behind them and it is their labels and
 *  the bare rim past them that dissolve, which is the right way round. (This
 *  read the other way about when the halo and the pad were a smaller share of a
 *  bigger disc; they do not scale with the ring, so shrinking the base moved the
 *  glyph ring inward as a fraction while 65 stayed where it was tuned.) */
export const FALLOFF_START = 65

/** Where the disc itself feathers out. Not a slider: this is the difference
 *  between "a circle" and "no boundary at all", and there is one right answer
 *  once the falloff above is doing the visible work. */
export const RIM_FEATHER_STOP = 95

/** `closest-side` is load-bearing in all three gradients below. The disc's box
 *  is square, so it makes the gradient's 100% exactly the disc's radius, and
 *  every stop below can then be read as a plain percentage of that radius. The
 *  default (farthest-corner) would put 100% out at the corner, and every number
 *  here would silently mean 1/sqrt(2) of what it says. */
const FALLOFF = `circle closest-side`

/** CSS cannot vary a blur radius across one element, so the progressive blur is
 *  a cross-fade: the sharp capture underneath, the blurred and graded copy over
 *  it, masked opaque at the centre and transparent at the rim. Both layers are
 *  the same static image, so this costs nothing per frame - it is one extra
 *  composited layer, not a second decode. */
export const BACKDROP_FALLOFF_MASK = `radial-gradient(${FALLOFF}, #000 0%, #000 var(--radial-falloff, ${FALLOFF_START}%), transparent 100%)`

/** The whole disc's outer feather. Applied to the clip container, so it takes
 *  the capture and the tint together and the boundary itself has no hard edge.
 *  The goo and the glyphs are outside that container and keep their full alpha -
 *  the point is to dissolve the ground, not the menu. */
export const DISC_FEATHER_MASK = `radial-gradient(${FALLOFF}, #000 0%, #000 var(--radial-rim, ${RIM_FEATHER_STOP}%), transparent 100%)`

/** The theme's panel colour over the capture, on the same falloff geometry as
 *  the blur so the two read as one effect rather than two circles. color-mix
 *  rather than an rgba() literal because --bg-card is an opaque hex the theme
 *  owns; mixing toward transparent is the only way to thin it without hardcoding
 *  its channels. */
const TINT_COLOR = `color-mix(in srgb, var(--bg-card) var(--radial-tint, ${DISC_ALPHA * 100}%), transparent)`
export const DISC_TINT = `radial-gradient(${FALLOFF}, ${TINT_COLOR} 0%, ${TINT_COLOR} var(--radial-falloff, ${FALLOFF_START}%), transparent 100%)`

/** Ceiling on the ring slider, and the one number here with a hard reason.
 *
 *  Main crops the backdrop around the RAW open point with a fixed half-extent
 *  decided before the renderer has any say, and the renderer draws at a CLAMPED
 *  centre - so the crop has to cover the disc's radius PLUS the furthest the
 *  clamp can shove it:
 *    (R + ICON_HALO + DISC_PAD) + (R + ICON_HALO) <= RADIAL_BACKDROP_HALF_PX
 *  which is R <= 83. Capping the slider is the honest option rather than
 *  letting the disc outgrow its capture: a ring past this cannot ship without
 *  RADIAL_BACKDROP_HALF_PX moving too, so a value the panel cannot offer is a
 *  value there is no point tuning to. (The shipped pair sits exactly on this
 *  limit - RING_RADIUS * RADIAL_SCALE_MAX is 82.6, a rounding hair under it -
 *  because the crop constant is derived from those two in the first place.) */
export const RING_MAX = Math.floor((RADIAL_BACKDROP_HALF_PX - 2 * ICON_HALO - DISC_PAD) / 2)

/** Slider bounds, shared by the panel and by the loader - a hand-edited blob
 *  must not be able to hand the ring a geometry it cannot draw (a bubble at or
 *  past the ring collapses the goo's reach ramp to a divide-by-zero). */
export const TUNING_RANGES = {
  blur: [0, 40],
  brightness: [30, 130],
  saturate: [0, 150],
  tint: [0, 100],
  opacity: [0, 100],
  // Below 40 the treatment never reaches full strength anywhere; above 95 there
  // is no falloff left to see, which is what Raw view is for.
  falloff: [40, 95],
  bubble: [15, 40],
  ring: [50, RING_MAX],
  // Floor well above zero: the goo IS the selection affordance, and a blob you
  // cannot see turns the ring into a static picture.
  goo: [30, 100],
  // 0 is a real setting, not a degenerate one: it turns every liquid amplitude
  // off at once and leaves the ring exactly as rigid as it used to be, which is
  // the only honest way to see what the personality is actually adding.
  liquid: [0, 150],
} as const satisfies Record<string, readonly [number, number]>

/** What the ring needs as live VALUES rather than as paint: the two lengths it
 *  is built out of at scale 1 (the user's stored `radialMenu.scale` still
 *  multiplies on top of them exactly as it multiplies the constants they
 *  override), plus the liquid amplitude the animation loop reads. None of these
 *  can travel as a custom property - they drive the hit test, the icon ring and
 *  the rAF loop's arithmetic, not a CSS declaration. */
export interface RadialGeometry {
  /** Centre bubble radius. Also the deadzone: they are the same edge by design,
   *  so picking starts the instant the cursor leaves the drawn bubble. */
  bubble: number
  /** Radius of the ring the slice icons sit on. */
  ring: number
  /** Percent multiplier on every liquid amplitude at once - the bubble's lean
   *  toward the cursor, the squash-and-stretch on both blobs, the arrival
   *  wobble and the idle breathing. 100 is the tuned look; 0 is a rigid circle
   *  and a puck that slides without deforming. */
  liquid: number
}

export interface BackdropTuning extends RadialGeometry {
  /** Blur radius in CSS px, applied in the disc's space (not the image's). */
  blur: number
  /** Percent. 100 = the capture's own luminance. */
  brightness: number
  /** Percent. 100 = the capture's own saturation. */
  saturate: number
  /** Percent of the theme panel colour laid over the capture. */
  tint: number
  /** Percent opacity of the capture image itself. */
  opacity: number
  /** Percent of the disc radius at which the treatment starts giving way to the
   *  untouched game. Every value above is "the centre value" - this is where
   *  they begin to stop applying. */
  falloff: number
  /** Percent opacity of the goo - the centre bubble and the travelling puck,
   *  which are one filtered group and so share one value. */
  goo: number
  /** Percent multiplier on all four liquid amplitudes at once. See
   *  RadialGeometry.liquid - it rides with the geometry because, like the two
   *  radii, it is arithmetic the rAF loop does rather than a CSS value. */
  liquid: number
  /** Untouched capture: no blur, no grade, no tint, and no falloff either - the
   *  edge treatment is a look, and this is an instrument. A view rather than a
   *  stored state: the slider values survive it, so toggling back returns to the
   *  numbers on screen. This is the whole diagnostic: if raw is also flat, the
   *  capture is bad; if raw shows the scene, the grade is eating it. */
  raw: boolean
}

export const DEFAULT_TUNING: BackdropTuning = {
  blur: BACKDROP_BLUR_PX,
  brightness: Math.round(BACKDROP_BRIGHTNESS * 100),
  saturate: Math.round(BACKDROP_SATURATE * 100),
  tint: Math.round(DISC_ALPHA * 100),
  opacity: 100,
  falloff: FALLOFF_START,
  raw: false,
  bubble: CENTER_RADIUS,
  ring: RING_RADIUS,
  goo: Math.round(GOO_OPACITY * 100),
  liquid: LIQUID_DEFAULT,
}

export const DEFAULT_GEOMETRY: RadialGeometry = { bubble: CENTER_RADIUS, ring: RING_RADIUS, liquid: LIQUID_DEFAULT }

/** Just the geometry pair, for the view - which needs it as React state (it
 *  drives the hit test, the icon ring and the disc, none of which a custom
 *  property can reach) and needs it on the very first render, before the panel
 *  below it has mounted and had a chance to push anything up. The panel stays
 *  the only writer; this is a read of the same blob so the two agree at mount. */
export function loadGeometry(): RadialGeometry {
  const { bubble, ring, liquid } = loadTuning()
  return { bubble, ring, liquid }
}

/** localStorage lives with the radial window's origin, which survives relaunch -
 *  the point being that a tuning session can span restarts of the app. */
export const TUNING_STORAGE_KEY = 'radial-backdrop-tuning'

/** Schema version of the stored blob.
 *
 *  Bumped to 2 when the ring's base geometry absorbed a legacy 0.7 scale. A v1
 *  blob holds bubble/ring in the OLD base space (35 / 84), and those are
 *  absolute px that the panel writes straight into the ring - so replaying one
 *  against the folded base would draw the menu 43% too big rather than the size
 *  it was saved at. The grading fields carry no such assumption and survive
 *  untouched; only the geometry pair is dropped, and the defaults it falls back
 *  to are exactly the rendered geometry that blob was approved at. */
const TUNING_VERSION = 2

export function loadTuning(): BackdropTuning {
  try {
    const stored = window.localStorage.getItem(TUNING_STORAGE_KEY)
    if (!stored) return DEFAULT_TUNING
    const p = JSON.parse(stored) as Partial<BackdropTuning> & { v?: number }
    // Pre-fold blob: keep the grade, forget the geometry. Deleting the fields
    // rather than converting them is deliberate - a v1 bubble/ring could itself
    // have been a dev-panel override rather than the old default, so there is no
    // single factor that would be right for all of them, and the new defaults
    // are known to be the approved look.
    if (p.v !== TUNING_VERSION) {
      p.bubble = undefined
      p.ring = undefined
    }
    // Clamped to the slider bounds, not merely type-checked: this blob is a
    // hand-editable file as far as the app is concerned, and the geometry pair
    // in particular can wedge the ring if it arrives out of range.
    const num = (v: unknown, key: keyof typeof TUNING_RANGES): number => {
      const [lo, hi] = TUNING_RANGES[key]
      if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_TUNING[key]
      return Math.min(hi, Math.max(lo, Math.round(v)))
    }
    return {
      blur: num(p.blur, 'blur'),
      brightness: num(p.brightness, 'brightness'),
      saturate: num(p.saturate, 'saturate'),
      tint: num(p.tint, 'tint'),
      opacity: num(p.opacity, 'opacity'),
      falloff: num(p.falloff, 'falloff'),
      goo: num(p.goo, 'goo'),
      liquid: num(p.liquid, 'liquid'),
      bubble: num(p.bubble, 'bubble'),
      ring: num(p.ring, 'ring'),
      raw: p.raw === true,
    }
  } catch {
    return DEFAULT_TUNING
  }
}

export function saveTuning(t: BackdropTuning): void {
  try {
    window.localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify({ ...t, v: TUNING_VERSION }))
  } catch {
    // A dev convenience; a storage that refuses writes must not break the menu.
  }
}

/** Write the tuning onto the menu root as custom properties. Deliberately not
 *  React state on the ring: the disc and the capture both inherit from the root,
 *  so five property writes retune the whole composite without a single render
 *  outside the panel. */
export function applyTuning(el: HTMLElement, t: BackdropTuning): void {
  const s = el.style
  s.setProperty('--radial-blur', `${t.raw ? 0 : t.blur}px`)
  s.setProperty('--radial-saturate', String(t.raw ? 1 : t.saturate / 100))
  s.setProperty('--radial-brightness', String(t.raw ? 1 : t.brightness / 100))
  s.setProperty('--radial-tint', `${t.raw ? 0 : t.tint}%`)
  s.setProperty('--radial-backdrop-opacity', String(t.opacity / 100))
  // Raw pins both falloffs at the rim, which is the same as switching them off:
  // the frosted layer covers the whole disc and the disc has a hard edge again.
  // Right for a diagnostic, wrong for the look - see `raw`.
  s.setProperty('--radial-falloff', `${t.raw ? 100 : t.falloff}%`)
  s.setProperty('--radial-rim', `${t.raw ? 100 : RIM_FEATHER_STOP}%`)
  // Deliberately NOT pinned by raw view: the goo is menu look, not backdrop
  // diagnostics, and having it jump every time you check a capture would just
  // be noise in the thing you are trying to read.
  s.setProperty('--radial-goo', String(t.goo / 100))
}
