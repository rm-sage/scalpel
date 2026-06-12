import { describe, it, expect } from 'vitest'
import { buildMiscFilters } from './misc'

const baseInfo = {
  itemClass: '',
  quality: 0,
  itemLevel: 0,
  corrupted: false,
  mirrored: false,
  identified: true,
}

describe('buildMiscFilters synthetic item level', () => {
  it('adds the placeholder ilvl chip for a synthetic gear item', () => {
    const filters = buildMiscFilters(
      { ...baseInfo, itemClass: 'Body Armours', rarity: 'Unique', isSynthetic: true },
      undefined,
      [],
    )
    const ilvl = filters.find((f) => f.id === 'misc.ilvl')
    expect(ilvl).toBeDefined()
    expect(ilvl?.enabled).toBe(true)
    expect(ilvl?.value).toBe(83)
  })

  it('omits the ilvl chip for a synthetic currency item (#418)', () => {
    // Sister-overlay currency (orbs, fragments, etc.) is built as a synthetic
    // Rarity: Currency item. An ilvl filter matches no currency listing, so it
    // must not be added or the trade search returns nothing.
    const filters = buildMiscFilters({ ...baseInfo, rarity: 'Currency', isSynthetic: true }, undefined, [])
    expect(filters.find((f) => f.id === 'misc.ilvl')).toBeUndefined()
  })
})
