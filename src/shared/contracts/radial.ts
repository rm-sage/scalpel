/** Radial menu: a hotkey-opened ring of tools fired at the point where the
 *  menu opened. Slices reference existing binding families; chat commands are
 *  stored by value so commands with no hotkey of their own can sit on the ring. */
export type RadialAction =
  | { kind: 'filter' }
  | { kind: 'pricecheck' }
  | { kind: 'appmacro'; action: string; presetId?: string }
  | { kind: 'chat'; command: string; autoSubmit: boolean }
  | { kind: 'cheatsheet'; categoryId?: string }

export interface RadialSlice {
  id: string
  /** IconPark component name from the curated radial icon registry. */
  icon: string
  /** Runtime-enriched plugin tab icon (SVG markup or data URL from the plugin
   *  tab registry), attached when the open payload is built. Never persisted to
   *  settings - the registry is live, so a stored copy would go stale. */
  iconSvg?: string
  label: string
  action: RadialAction
}

export interface RadialMenuSettings {
  slices: RadialSlice[]
  /** Overall size of the drawn ring. 1 = default size; clamped to 0.6-1.4.
   *  Every geometric quantity (bubble, ring radius, deadzone, puck, backdrop
   *  disc, goo blur) derives from it, so the liquid stays proportional. */
  scale?: number
}

export const RADIAL_MAX_SLICES = 8

/** `RadialSlice.icon` value meaning "draw this plugin's own registered icon, as a
 *  circular badge" instead of naming a glyph from the curated IconPark set.
 *
 *  A sentinel rather than a separate field because `icon` is already the single
 *  answer to "what does this slice wear", and a boolean beside it would make two
 *  sources of truth that could disagree. It is only ever legal on a slice whose
 *  action is a plugin action; `defaultIconFor` stays RadialIconName-typed so the
 *  compile-time guarantee over the built-in set is untouched, and the choice
 *  between the two is made a level up in `defaultSliceIcon`. */
export const RADIAL_PLUGIN_ICON = 'plugin-icon'

/** Action-id prefixes that identify a plugin-contributed app macro. The two do
 *  not overlap ('plugin-overlay:' is not 'plugin:'-prefixed), but the order
 *  mirrors the settings section so both sides read the same. */
export const RADIAL_PLUGIN_PREFIXES = ['plugin-overlay:', 'plugin:'] as const

/** The art a plugin slice should wear, in resolution order.
 *
 *  A registered TAB icon first: that is what the plugin chose to show in the
 *  app's own chrome, so it is the most specific thing it has said about how it
 *  wants to look, and it is live (it changes with an in-place update without
 *  anyone re-reading a manifest).
 *
 *  The manifest's `iconUrl` second, and it is not a rare fallback - it is the
 *  ONLY source for an overlay-only plugin. Registering a tab is what populates
 *  the tab registry, and a plugin that only registers an overlay never does; the
 *  calculator is exactly that shape, which is why its slice was drawing the
 *  Components glyph while its icon sat unused in its manifest.
 *
 *  Neither, and the caller's own fallback stands. Shared rather than inlined at
 *  the two call sites because they are in different processes - main enriching
 *  the open payload and the settings section drawing the picker - and an order
 *  that disagreed between them would show one icon in settings and another on
 *  the ring. */
export function pluginSliceIcon(tabIcon?: string, manifestIcon?: string): string | undefined {
  return tabIcon || manifestIcon || undefined
}

/** The plugin id behind an action, or undefined when the action is not a plugin
 *  one. The single definition of "is this a plugin slice" - main, the settings
 *  section and the icon defaulting all used to carry their own copy of the
 *  prefix list. */
export function pluginIdFromAction(action: RadialAction): string | undefined {
  if (action.kind !== 'appmacro') return undefined
  const prefix = RADIAL_PLUGIN_PREFIXES.find((p) => action.action.startsWith(p))
  return prefix ? action.action.slice(prefix.length) : undefined
}

/** Size-scale bounds. Below 0.6 the icons (which do NOT scale - they have to
 *  stay legible) crowd the ring; above 1.4 it stops reading as a cursor menu. */
export const RADIAL_SCALE_MIN = 0.6
export const RADIAL_SCALE_MAX = 1.4

/** The one clamp shared by main, the ring and the settings UI, so a hand-edited
 *  settings file can never hand the renderer a ring it cannot draw. */
export function clampRadialScale(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return Math.min(RADIAL_SCALE_MAX, Math.max(RADIAL_SCALE_MIN, n))
}

/** Sent main -> radial window on open. `center` is in game CSS px, which maps
 *  1:1 to the full-game-window overlay's own CSS px. */
export interface RadialOpenPayload {
  center: { x: number; y: number }
  slices: RadialSlice[]
  /** Resolved (already clamped) size scale, so the overlay window needs no
   *  settings access of its own. Optional for older payload shapes; the view
   *  re-clamps, and undefined lands on 1. */
  scale?: number
  /** Monotonic id for this open. The backdrop is captured asynchronously and
   *  can land after the menu it belongs to is gone, so it carries this back and
   *  the renderer drops anything that isn't the live open. */
  nonce?: number
  /** Developer mode was on when this menu opened, so the ring shows its backdrop
   *  tuning panel. Resolved here for the same reason `scale` is: the overlay
   *  window has no settings access of its own. */
  dev?: boolean
}

/** Half-extent, in game CSS px, of the square of game pixels main grabs for the
 *  backdrop. Covers the largest disc the ring can draw PLUS the furthest the
 *  edge clamp can shove that disc away from the cursor, because main crops
 *  around the raw open point and only the renderer knows the clamped centre:
 *  (RING_RADIUS * RADIAL_SCALE_MAX + ICON_HALO + DISC_PAD)  <- max disc radius
 *  + (RING_RADIUS * RADIAL_SCALE_MAX + ICON_HALO)           <- max clamp shift
 *  which at RING_RADIUS 59 is (82.6 + 28 + 8) + (82.6 + 28) = 229.2. It tracks
 *  the ring in both directions - this is the number that has to move whenever
 *  RING_RADIUS does,
 *  and a test in the ring's geometry suite pins it - that file is the only
 *  place that can see both this and the renderer-side geometry. */
export const RADIAL_BACKDROP_HALF_PX = 230

/** A one-shot blurred capture of the game behind the menu, sent after the menu
 *  is already up so the open never waits on the screen grab. `origin`/`width`/
 *  `height` are in game CSS px and describe where this crop belongs on screen,
 *  which is what lets the renderer lay it back down 1:1 without knowing (or
 *  agreeing with) main's crop rule. The encoded image is stretched back onto
 *  exactly this rectangle, so its own pixel size is what decides how much detail
 *  the disc can show - see ENCODE_MAX_PX for how that is chosen. */
export interface RadialBackdropImage {
  dataUrl: string
  origin: { x: number; y: number }
  width: number
  height: number
}

/** Why a backdrop grab produced nothing. Mirrors the capture module's own
 *  failure set plus `crop`, which is this path's own degenerate case (an open
 *  point entirely off the captured frame). Crosses IPC purely so the developer
 *  tuning panel can say WHICH gate closed - the intermittent capture bug that
 *  motivated it was invisible while every failure looked the same. */
export type RadialBackdropFailure = 'focus' | 'bounds' | 'no-source' | 'empty-frame' | 'geometry' | 'crop' | 'error'

/** What main's capture entry point hands back: the image, or why there isn't
 *  one. Null is still allowed and means "say nothing at all". */
export type RadialBackdropResult = RadialBackdropImage | { failure: RadialBackdropFailure } | null

/** RadialBackdropImage as it crosses IPC: tagged with the open it belongs to. */
export interface RadialBackdrop extends RadialBackdropImage {
  nonce: number
}

/** Sent on the same channel when the grab failed, so the ring knows the answer
 *  is "no" rather than "not yet". Only the developer panel does anything with
 *  it; a normal open just keeps its plain tinted disc either way. */
export interface RadialBackdropMiss {
  nonce: number
  failure: RadialBackdropFailure
}

export type RadialBackdropEvent = RadialBackdrop | RadialBackdropMiss

export function isRadialBackdrop(e: RadialBackdropEvent): e is RadialBackdrop {
  return 'dataUrl' in e
}

/** Everything about the live open, pulled in one invoke by a renderer that has
 *  just booted. Both halves need it for the same reason: the radial window is
 *  created lazily, so on the first open of a session BOTH sends can land in a
 *  webContents that is still loading - and webContents.send has no queue. The
 *  payload always had this fallback; the backdrop did not, which is why the
 *  first menu of a session drew a plain disc whenever the capture beat the
 *  renderer's first paint.
 *
 *  One invoke rather than two so the answer is a single consistent snapshot,
 *  and so there is no window between two pulls for an image to slip through. */
export interface RadialPendingState {
  payload: RadialOpenPayload | null
  /** The image, or the reason there isn't one - a miss has to survive the race
   *  too, or the developer panel reads "waiting" forever on a first open that
   *  actually failed. */
  backdrop: RadialBackdropEvent | null
}

/** The app-macro action id that toggles the radial menu. Deliberately absent
 *  from APP_MACRO_DEFS: the Radial Menu settings section owns its recorder,
 *  and the generic Scalpel Hotkeys list filters this entry out. */
export const RADIAL_MACRO_ACTION = 'openRadialMenu'
