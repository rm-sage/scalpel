import { relicRegex, type RelicRegex } from './vendor/relics/Relic.Gen'

/** PoE2 relic affix type. Drives the Prefixes / Suffixes display groups. */
export type RelicAffix = 'PREFIX' | 'SUFFIX'

export interface RelicMod {
  /** Stable content-hash id from the build script -- used for selection sets and presets. */
  id: number
  regex: string
  /** Display text in placeholder form (e.g. "#% increased Movement Speed"). */
  text: string
  affix: RelicAffix
  /** Roll ranges per `#` placeholder. Empty for the two non-numeric relic mods. */
  ranges: number[][]
  /** Discrete sample values from upstream. Not used by the engine but carried through. */
  values: number[]
}

/** Collapse the generated `##%`/`##` placeholders to single `#%`/`#` for display,
 *  matching waystone-mods.ts. */
function formatText(rawName: string): string {
  return rawName.replace(/##%/g, '#%').replace(/##/g, '#')
}

function tokensToMods(data: RelicRegex[]): RelicMod[] {
  return data.map((m) => ({
    id: m.id,
    regex: m.regex,
    text: formatText(m.name),
    affix: m.affix,
    ranges: m.ranges,
    values: m.values,
  }))
}

export const RELIC_MODS: RelicMod[] = tokensToMods(relicRegex)
