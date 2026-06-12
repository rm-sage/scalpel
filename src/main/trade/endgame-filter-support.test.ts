import { afterEach, describe, expect, it } from 'vitest'
import { _setIndexedEndgameKeysForTests, isEndgameFilterIndexed } from './endgame-filter-support'

describe('endgame-filter-support', () => {
  afterEach(() => _setIndexedEndgameKeysForTests(null))

  it('defaults to the bundled allowlist (tier + revives only)', () => {
    expect(isEndgameFilterIndexed('map.map_tier')).toBe(true)
    expect(isEndgameFilterIndexed('map.map_revives')).toBe(true)
    expect(isEndgameFilterIndexed('map.map_packsize')).toBe(false)
    expect(isEndgameFilterIndexed('map.map_iir')).toBe(false)
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
    expect(isEndgameFilterIndexed('map.map_iir')).toBe(false)
  })
})
