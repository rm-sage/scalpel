import { describe, expect, it } from 'vitest'
import { isLowPriority } from './classification'

describe('isLowPriority', () => {
  // Regression: the flat life-regen suffix is worded "Regenerated" in PoE1 and
  // "Regeneration" in PoE2. The pattern must catch both, or PoE2 belts surface
  // a low-value regen roll as enabled-by-default in the price check.
  it('flags flat life regeneration in both PoE1 and PoE2 phrasing', () => {
    expect(isLowPriority('20.5 Life Regeneration per second')).toBe(true)
    expect(isLowPriority('5 Life Regenerated per second')).toBe(true)
  })

  it('does not flag the distinct percent-regen-rate mod', () => {
    expect(isLowPriority('15% increased Life Regeneration rate')).toBe(false)
  })

  it('flags other known low-priority mods', () => {
    expect(isLowPriority('15% increased Rarity of Items found')).toBe(true)
    expect(isLowPriority('30% increased Light Radius')).toBe(true)
  })

  it('does not flag ordinary high-value mods', () => {
    expect(isLowPriority('+80 to maximum Life')).toBe(false)
    expect(isLowPriority('+34% to Lightning Resistance')).toBe(false)
  })
})
