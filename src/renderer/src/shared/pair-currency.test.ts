import { describe, expect, it } from 'vitest'
import { pairCurrencyRole } from './pair-currency'

describe('pairCurrencyRole', () => {
  it('Divine Orb is the rate side in both games', () => {
    expect(pairCurrencyRole('Divine Orb', 1)).toBe('rate')
    expect(pairCurrencyRole('Divine Orb', 2)).toBe('rate')
  })

  it('the baseline orb is the inverse side per game', () => {
    expect(pairCurrencyRole('Chaos Orb', 1)).toBe('inverse')
    expect(pairCurrencyRole('Exalted Orb', 2)).toBe('inverse')
  })

  it('the other game baseline orb is not special', () => {
    expect(pairCurrencyRole('Exalted Orb', 1)).toBeNull()
    expect(pairCurrencyRole('Chaos Orb', 2)).toBeNull()
  })

  it('ordinary items are not special', () => {
    expect(pairCurrencyRole('Mirror of Kalandra', 1)).toBeNull()
  })
})
