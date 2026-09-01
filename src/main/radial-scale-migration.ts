import type Store from 'electron-store'
import type { AppSettings, RadialMenuSettings, RadialSlice } from '@shared/types'
import { clampRadialScale, pluginIdFromAction, RADIAL_PLUGIN_ICON } from '@shared/contracts/radial'

/** The scale the ring's base geometry was folded by.
 *
 *  Every look approved for this menu was judged through a stored `radialMenu.scale`
 *  of 0.7 that predated the first geometry rebase and was never migrated, so the
 *  constants in geometry.ts were being written as though they were what reached
 *  the screen when they were really being multiplied down by this first. Folding
 *  it into the base fixed the pixels; this fixes the number the user is shown,
 *  which had been reading 70% for a ring that was in fact the intended size. */
const FOLDED_SCALE = 0.7

/** Undo the fold for a stored scale, so the same ring comes out the far side.
 *
 *  Pure and total. `undefined` stays `undefined` on purpose: an absent scale
 *  means the user never expressed a preference, and the folded base at 1.0 is
 *  now exactly the geometry that was approved - so leaving it alone is what
 *  gives them the intended ring, not a 30% smaller one.
 *
 *  The clamp is load-bearing rather than defensive. Dividing by 0.7 multiplies
 *  by ~1.43, which lands past RADIAL_SCALE_MAX for anything stored above ~0.98;
 *  those users end at 1.4 and lose ~1.7% of their ring rather than keeping it
 *  exactly. That is the one case this cannot make whole, and it is a better
 *  trade than moving the scale bounds to accommodate a legacy multiplier. */
export function unfoldRadialScale(scale: number | undefined): number | undefined {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return undefined
  return clampRadialScale(scale / FOLDED_SCALE)
}

const MIGRATION_FLAG = 'radialScaleFoldMigrationDone'

/** Run the stored-scale normalisation once. Guarded by a store flag so it is a
 *  no-op on every subsequent launch - which matters more here than usual, since
 *  running twice would divide by 0.7 again and blow the ring out to the clamp.
 *  Must run before renderers read settings. */
export function runRadialScaleMigration(store: Store<AppSettings>): void {
  if ((store.get(MIGRATION_FLAG as keyof AppSettings) as unknown) === true) return
  const radial = store.get('radialMenu') as RadialMenuSettings | undefined
  const next = unfoldRadialScale(radial?.scale)
  // Only write when there was something to change: a fresh install has no
  // radialMenu.scale at all and should not gain one.
  if (radial && next !== undefined && next !== radial.scale) store.set('radialMenu', { ...radial, scale: next })
  store.set(MIGRATION_FLAG as keyof AppSettings, true as never)
}

/** The glyph plugin slices used to be stored with. `defaultIconFor` had no
 *  plugin case, so every plugin slice fell through to its 'Components' catch-all
 *  - and it never mattered, because the ring drew the plugin's own art over the
 *  top regardless of what was stored. */
const LEGACY_PLUGIN_ICON = 'Components'

/** Re-point legacy plugin slices at the sentinel. Pure and idempotent.
 *
 *  Needed because the ring's precedence flipped: plugin art used to win
 *  unconditionally, and now it is opted into by RADIAL_PLUGIN_ICON so that a
 *  chosen glyph can beat it. Without this, every slice already on a user's ring
 *  would quietly change from the plugin's art to a Components glyph.
 *
 *  'Components' on a plugin slice is read as "the old default" rather than as a
 *  deliberate choice, and that is unambiguous rather than a guess: until this
 *  change, plugin slices had no icon picker at all, so nobody could have picked
 *  it. Any other glyph was impossible to arrive at and is left alone anyway. */
export function migratePluginSliceIcons(slices: RadialSlice[]): { slices: RadialSlice[]; changed: boolean } {
  let changed = false
  const out = slices.map((s) => {
    if (s.icon !== LEGACY_PLUGIN_ICON || !pluginIdFromAction(s.action)) return s
    changed = true
    return { ...s, icon: RADIAL_PLUGIN_ICON }
  })
  return { slices: out, changed }
}

const ICON_MIGRATION_FLAG = 'radialPluginIconMigrationDone'

/** Run the plugin-slice icon normalisation once. Its own flag rather than the
 *  scale one's: that migration has already run on existing installs, so folding
 *  this into it would mean it never fired where it is needed most. */
export function runRadialPluginIconMigration(store: Store<AppSettings>): void {
  if ((store.get(ICON_MIGRATION_FLAG as keyof AppSettings) as unknown) === true) return
  const radial = store.get('radialMenu') as RadialMenuSettings | undefined
  if (radial?.slices?.length) {
    const { slices, changed } = migratePluginSliceIcons(radial.slices)
    if (changed) store.set('radialMenu', { ...radial, slices })
  }
  store.set(ICON_MIGRATION_FLAG as keyof AppSettings, true as never)
}
