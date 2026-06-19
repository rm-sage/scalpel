import { afterEach, describe, expect, it } from 'vitest'
import { _setIndexedEndgameKeysForTests, isEndgameFilterIndexed } from './endgame-filter-support'

describe('endgame-filter-support', () => {
  afterEach(() => _setIndexedEndgameKeysForTests(null))

  it('defaults to the bundled allowlist (7 indexed keys; iiq + gold still broken)', () => {
    for (const key of [
      'map.map_tier',
      'map.map_packsize',
      'map.map_iir',
      'map.map_revives',
      'map.map_bonus',
      'map.map_magic_monsters',
      'map.map_rare_monsters',
    ]) {
      expect(isEndgameFilterIndexed(key), `${key} should be indexed`).toBe(true)
    }
    // Live-probed unindexed (map_filter searches still return zero).
    expect(isEndgameFilterIndexed('map.map_iiq')).toBe(false)
    expect(isEndgameFilterIndexed('map.map_gold')).toBe(false)
  })

  it('adopts an override allowlist', () => {
    _setIndexedEndgameKeysForTests(['map.map_packsize'])
    expect(isEndgameFilterIndexed('map.map_packsize')).toBe(true)
    expect(isEndgameFilterIndexed('map.map_tier')).toBe(false) // not in the override set
  })

  it('null resets to the bundled default', () => {
    _setIndexedEndgameKeysForTests(['map.map_iir'])
    _setIndexedEndgameKeysForTests(null)
    expect(isEndgameFilterIndexed('map.map_tier')).toBe(true)
    // map_iiq stays unindexed in the bundled default, so the reset is observable.
    expect(isEndgameFilterIndexed('map.map_iiq')).toBe(false)
  })
})
