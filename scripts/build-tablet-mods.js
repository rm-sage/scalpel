#!/usr/bin/env node
/**
 * Build src/shared/data/trade/tablet-mods.json -- a lookup from a PoE2 tablet's
 * clipboard mod phrasing to the trade API explicit stat id it should search.
 *
 * Why this exists: tablet (precursor tablet) affixes are regular `explicit.*`
 * map mods, but the in-game clipboard phrases them differently from the trade
 * API's stat text ("...Waystones found in Map" vs "...Waystones found", "Map is
 * inhabited by 1 additional Rogue Exile" vs "Your Maps are inhabited by #
 * additional Rogue Exile"). Scalpel matches clipboard text against the live
 * trade2 /data/stats text, which never contains the tablet phrasing, so the
 * normal matcher misses every tablet mod.
 *
 * Exiled-Exchange-2 (the sanctioned PoE2 reference, author kvan) already curates
 * every clipboard phrasing -> trade id mapping in its stats database under
 * `fromAreaMods` entries. We lift those matcher strings into a normalized
 * key -> explicit-stat-id map. The tablet producer normalizes each clipboard
 * line the same way and looks the id up directly.
 *
 * Source: <ee2>/dataParser/output/en/stats.ndjson  (one stat per line)
 *   GitHub: https://github.com/Kvan7/Exiled-Exchange-2
 *
 * Usage:
 *   node scripts/build-tablet-mods.js [path-to-ee2-stats.ndjson]
 */

const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_SRC = 'C:/www/Exiled-Exchange-2/dataParser/output/en/stats.ndjson'
const SRC = process.argv[2] || DEFAULT_SRC
const OUT = path.join(__dirname, '..', 'src', 'shared', 'data', 'trade', 'tablet-mods.json')

/** Normalize a mod line to a lookup key: lowercase, collapse whitespace, and
 *  replace every number token with `#` so a rolled value matches the placeholder.
 *  MUST stay in sync with normalizeTabletModKey in
 *  src/main/trade/stat-matcher/producers/tablets.ts. */
function normalizeKey(s) {
  return s
    .toLowerCase()
    .replace(/[+-]?\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

// Tablet (precursor tablet) affixes are map mods. EE2's `fromAreaMods` flag
// undercounts (it misses e.g. "inhabited by additional Rogue Exile"), so select
// by the internal map_* id, plus any stat carrying a map-context phrasing in its
// matchers ("in Map", "Map is/has...", "in your Maps"). Over-inclusion is safe:
// the lookup only runs for Tablet-class items, and an unused key never matches.
const TABLET_PHRASING = /( in map\b| in your maps\b|^map |^maps |maps are |maps have )/i
function isTabletMod(entry) {
  if (typeof entry.id === 'string' && entry.id.startsWith('map_')) return true
  return (entry.matchers ?? []).some((m) => TABLET_PHRASING.test(m.string ?? ''))
}

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`)
  console.error('Pass the path to Exiled-Exchange-2 stats.ndjson as the first argument.')
  process.exit(1)
}

const lines = fs.readFileSync(SRC, 'utf-8').split('\n').filter(Boolean)
const map = {}
const conflicts = []
let areaMods = 0

for (const line of lines) {
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    continue
  }
  if (!isTabletMod(entry)) continue
  const statId = entry.trade?.ids?.explicit?.[0]
  if (!statId) continue
  areaMods++
  for (const matcher of entry.matchers ?? []) {
    if (!matcher.string) continue
    const key = normalizeKey(matcher.string)
    if (map[key] && map[key] !== statId) {
      conflicts.push({ key, existing: map[key], incoming: statId })
      continue
    }
    map[key] = statId
  }
}

// GGG splits Abyss into TWO trade stats: the numeric "# additional Abysses"
// (stat_3490187949) and a dedicated singular "an additional Abyss"
// (stat_1070816711). Most map-content mods (Strongbox, Essence, Shrine) alias both
// phrasings under one id, so EE2 folds them into a single ref and the `explicit[0]`
// pick above is correct -- but for Abyss [0] is the numeric id, which then wrongly
// covers the valueless singular phrasings too. Re-point those at the singular id so
// the price check searches the stat the item is actually indexed under (the numeric
// stat misses every singular-Abyss tablet).
const SINGULAR_STAT_OVERRIDES = {
  'area contains an additional abyss': 'explicit.stat_1070816711',
  'map contains an additional abyss': 'explicit.stat_1070816711',
  'your maps contain an additional abyss': 'explicit.stat_1070816711',
}
for (const [key, id] of Object.entries(SINGULAR_STAT_OVERRIDES)) {
  if (map[key]) map[key] = id
  else console.log(`  override key absent from source (EE2 phrasing changed?): "${key}"`)
}

const sorted = {}
for (const key of Object.keys(map).sort()) sorted[key] = map[key]

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`)

console.log(`wrote ${OUT}`)
console.log(`  ${areaMods} area mods, ${Object.keys(sorted).length} clipboard phrasings`)
if (conflicts.length > 0) {
  console.log(`  ${conflicts.length} conflicting keys skipped (first-wins):`)
  for (const c of conflicts) console.log(`    "${c.key}": ${c.existing} (kept) vs ${c.incoming}`)
}
