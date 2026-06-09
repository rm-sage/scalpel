import { getPremiumMods } from '../../../premium-mods'
import { getStatEntries } from '../stats-cache'
import type { StatEntry } from '../stats-cache'
import { getPoeVersion } from '../../../game-state'
import type { ItemInfo } from '../context'

// Lazy statId -> canonical text map; rebuilt when getStatEntries() returns a different reference.
let textById: Map<string, string> | null = null
let builtFrom: StatEntry[] | null = null

function ensureTextMap(): Map<string, string> {
  const entries = getStatEntries()
  if (textById && builtFrom === entries) return textById
  const map = new Map<string, string>()
  for (const e of entries) if (!map.has(e.id)) map.set(e.id, e.text)
  textById = map
  builtFrom = entries
  return map
}

export function _resetPremiumMatchCacheForTests(): void {
  textById = null
  builtFrom = null
}

export function isPremiumMod(itemInfo: ItemInfo | undefined, statId: string): boolean {
  const data = getPremiumMods()
  if (!data) return false
  if (itemInfo?.rarity !== 'Unique' || !itemInfo.name) return false
  const game = getPoeVersion() === 2 ? 'poe2' : 'poe1'
  const texts = data[game]?.[itemInfo.name]
  if (!Array.isArray(texts) || texts.length === 0) return false
  const text = ensureTextMap().get(statId)
  if (!text) return false
  return texts.includes(text)
}
