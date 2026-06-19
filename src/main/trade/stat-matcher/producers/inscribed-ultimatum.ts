import type { StatFilter } from '../../trade'

type InscribedItemInfo = {
  baseType?: string
}

// Inscribed Ultimatum mod chips ("Choking Miasma", "30% more Monster Life",
// etc.) describe the random map-roll modifiers, not anything you'd narrow a
// trade search by - the chips that actually matter are the ultimatum_filters
// (challenge / reward / sacrifice). Default the affix-typed chips off so the
// search starts clean; the user can opt in if they really want to filter on
// a specific monster mod.
export function postProcessInscribedUltimatum(
  combined: StatFilter[],
  itemInfo: InscribedItemInfo | undefined,
): StatFilter[] {
  if (itemInfo?.baseType === 'Inscribed Ultimatum') {
    const affixTypes = new Set(['explicit', 'implicit', 'fractured', 'crafted', 'enchant', 'imbued', 'pseudo'])
    // area_level is a search-critical filter, not a map-roll affix - keep it enabled.
    // (In PoE1 area_level is type 'misc' and was never in affixTypes, so the id exemption is harmless there.)
    return combined.map((f) => (affixTypes.has(f.type) && f.id !== 'misc.area_level' ? { ...f, enabled: false } : f))
  }
  return combined
}
