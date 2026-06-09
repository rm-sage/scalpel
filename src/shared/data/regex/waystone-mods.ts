import { waystoneRegex, type WaystoneRegex } from './vendor/waystones/Waystone.Gen'

/** PoE2 waystone affix type. Used for display grouping in the picker (Prefixes /
 *  Suffixes sections) -- either affix can be placed in the Want or Avoid column.
 *  The Maps generator's "danger" axis doesn't apply here -- waystones don't carry
 *  a per-mod ranking. */
export type WaystoneAffix = 'PREFIX' | 'SUFFIX'

export interface WaystoneMod {
  /** Stable id from the poe2.re token -- used for selection sets and presets. */
  id: number
  regex: string
  /** Display text in poe2.re's placeholder form (e.g. "Monsters deal #% of Damage as
   *  Extra Fire"). The vendor source joins the rare multi-line mod with `|`; the
   *  renderer splits on it. */
  text: string
  affix: WaystoneAffix
  /** Roll ranges per `#` placeholder in the mod text. Empty when the mod has no
   *  numeric component (e.g. "Players are periodically Cursed with Enfeeble"). */
  ranges: number[][]
  /** Discrete sample values seen in vendor data. Used by the regex engine to choose
   *  a default magnitude when the user selects the mod without a specific value. */
  values: number[]
  /** poe2.re affix tags (e.g. "map_key_high", "default"). Carried through for future
   *  grouping; not used by the engine. */
  tags: string[]
}

/** Format the raw vendor text for display: the generated source uses `##%`/`##`
 *  placeholders for ranges; our ModList renderer expects single `#`. Collapse them and
 *  leave the `|` separator intact for the rare multi-line mod. */
function formatText(rawName: string): string {
  return rawName.replace(/##%/g, '#%').replace(/##/g, '#')
}

function tokensToMods(data: WaystoneRegex[]): WaystoneMod[] {
  return data.map((m) => ({
    id: m.id,
    regex: m.regex,
    text: formatText(m.name),
    affix: m.prefix ? 'PREFIX' : 'SUFFIX',
    ranges: m.ranges,
    values: m.values,
    tags: m.tags,
  }))
}

export const WAYSTONE_MODS: WaystoneMod[] = tokensToMods(waystoneRegex)
