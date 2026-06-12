import tabletMods from '../../../../shared/data/trade/tablet-mods.json'
import { BENEFICIAL_NEGATIVE_KEYWORDS } from '../../../../shared/data/trade/beneficial-negatives'
import type { StatFilter } from '../../trade'
import { findAdvMod } from '../adv-mods'
import { computeValueBounds } from '../bounds'
import type { MatchContext } from '../context'
import { matchModToStat } from '../mod-matcher'
import { statTextById } from '../stats-cache'

// "reduced"/"less"/"fewer" mark a roll the trade API stores as a NEGATIVE on the
// positive ("increased"/"more"/"additional") stat. Used to decide when a table-mapped
// tablet value needs negating, and to skip stats that are themselves phrased "reduced".
const REDUCING_KEYWORDS_RE = /\breduced\b|\bless\b|\bfewer\b/i

// PoE2 precursor tablets. Their affixes are regular explicit map mods, but the
// in-game clipboard phrases them differently from the trade API's stat text
// ("...Waystones found in Map" vs "...found", "Map is inhabited by 1 additional
// Rogue Exile" vs "Your Maps are inhabited by # additional Rogue Exile"). Scalpel
// matches clipboard text against the live trade2 /data/stats text, which never
// carries the tablet phrasing, so the normal explicit matcher missed every one.
//
// tablet-mods.json maps each known clipboard phrasing (number-normalized) to the
// trade explicit stat id, generated from Exiled-Exchange-2's matcher table by
// scripts/build-tablet-mods.js. Tablets are PoE2-only.
const TABLET_MODS = tabletMods as Record<string, string>

/** Number-normalized lookup key. MUST stay in sync with normalizeKey in
 *  scripts/build-tablet-mods.js. */
export function normalizeTabletModKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[+-]?\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Drop the map-scoping phrasing a tablet's clipboard mod carries ("...found in Map",
 *  "Breaches in Map have...", "...in your Maps") which the trade /data/stats text never
 *  has ("...found", "Breaches have..."). KEEPS the #/#% roll placeholders, because
 *  matchModToStat matches the placeholder form of the stat text. Used as a fallback when
 *  the tablet-mods.json lookup misses a mod (e.g. game content newer than that table). */
export function stripTabletMapScoping(text: string): string {
  return text
    .replace(/\s+in your Maps\b/gi, '')
    .replace(/\s+in Map\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildTabletFilters(ctx: MatchContext): StatFilter[] {
  if (!ctx.isTablet) return []
  const { explicits, advancedMods, pct } = ctx
  // Unique tablets are post-processed by the override layer (applyUniqueOverrides), whose
  // direction/lowerIsBetter bounds are calibrated to the legacy positive-magnitude value the
  // table path emits. The sign + beneficial-negative correction below is therefore scoped to
  // NON-unique tablets so the verified unique pricing path is untouched; the unique reduced->
  // increased sign is a separate, flagged follow-up.
  const isUnique = ctx.itemInfo?.rarity === 'Unique'
  const out: StatFilter[] = []
  for (const mod of explicits) {
    const cleaned = mod.trim()
    let id: string
    let value: number | null

    let aggregated: boolean | undefined
    const mappedId = TABLET_MODS[normalizeTabletModKey(cleaned)]
    if (mappedId) {
      id = mappedId
      const numMatch = cleaned.match(/[+-]?\d+(?:\.\d+)?/)
      value = numMatch ? parseFloat(numMatch[0]) : null
      // The table collapses "reduced"/"increased" (and "less"/"fewer") phrasings onto a
      // single positive stat ("increased"/"more"/"additional"). A "reduced"/"less"/"fewer"
      // clipboard roll is stored negative on that stat, so negate -- matchModToStat does
      // this for the non-table path, but the table lookup bypasses it, leaving the value
      // positive and the search pointing the wrong way (issue: reduced Tribute searched as
      // +increased Tribute, finding the opposite of the item).
      if (!isUnique && value != null && value > 0) {
        const clipNegative = REDUCING_KEYWORDS_RE.test(cleaned)
        const statNegative = REDUCING_KEYWORDS_RE.test(statTextById(id))
        if (clipNegative && !statNegative) value = -value
      }
    } else {
      // A tablet mod whose clipboard text already matches the live trade stat
      // text (no special phrasing) -- let the normal explicit matcher handle it.
      const matched = matchModToStat(cleaned, false, 'explicit')
      if (!matched) continue
      id = matched.statId
      value = matched.value
      aggregated = matched.aggregated
    }

    let modTier: number | undefined
    let modRange: { min: number; max: number } | undefined
    if (advancedMods) {
      const advMod = findAdvMod(advancedMods, cleaned, 'explicit')
      if (advMod) {
        if (advMod.tier > 0) modTier = advMod.tier
        const range = advMod.ranges.find((r) => r.value === value)
        if (range && range.min !== range.max) modRange = { min: range.min, max: range.max }
      }
    }

    // Non-unique tablets use the shared negative-aware bounds (a beneficial negative like
    // "costs reduced Tribute" prefills a MAX, an ordinary negative widens the MIN, a positive
    // uses the percent MIN). Unique tablets keep the legacy positive-magnitude MIN so the
    // override layer's direction/lowerIsBetter bounds stay calibrated.
    let min: number | null
    let max: number | null
    if (isUnique) {
      min = value != null ? Math.floor(value * pct) : null
      max = null
    } else {
      const isBeneficialNegative =
        value != null && value < 0 && BENEFICIAL_NEGATIVE_KEYWORDS.some((p) => p.test(cleaned))
      ;({ min, max } = computeValueBounds({ value, pct, isBeneficialNegative }))
    }

    out.push({
      id,
      text: cleaned,
      value,
      min,
      max,
      enabled: true,
      type: 'explicit',
      option: undefined,
      aggregated,
      modTier,
      modRange,
    })
  }
  return out
}
