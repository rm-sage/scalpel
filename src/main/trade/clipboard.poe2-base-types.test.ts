import { afterEach, describe, expect, it } from 'vitest'
import { setPoeVersion } from '../game-state'
import { clearFilterBaseTypes, parseItemText, registerFilterBaseTypes } from './clipboard'

// PoE2 flask ("Life Flasks"/"Mana Flasks"), charm, jewel, and several weapon
// classes are now enumerated in item-classes-poe2.json so cleanBaseType's
// class-scoped static match wins. Without that data the only base candidates
// came from the loaded filter, and a filter's substring BaseType token (e.g.
// "Transcendent") would be returned as the whole base type -- truncating
// "Transcendent Life Flask" to "Transcendent" and breaking the trade search.
// Regression guard for issue #402.
describe('poe2 magic base-type extraction (#402)', () => {
  // Own file so the poe2 static-base cache never leaks into clipboard.test.ts,
  // which runs against the poe1 default.
  setPoeVersion(2)

  afterEach(() => clearFilterBaseTypes())

  const flaskText = (withAdvancedMods: boolean) =>
    [
      'Item Class: Life Flasks',
      'Rarity: Magic',
      'Bubbling Transcendent Life Flask of the Plentiful',
      '--------',
      'Quality: +20% (augmented)',
      'Recovers 1008 (augmented) Life over 4 Seconds',
      '--------',
      'Item Level: 50',
      '--------',
      ...(withAdvancedMods
        ? [
            '{ Prefix Modifier "Bubbling" (Tier: 1) }',
            '29(28-30)% of Recovery applied Instantly',
            '{ Suffix Modifier "of the Plentiful" (Tier: 4) }',
            '41(39-46)% increased Charges',
            '--------',
          ]
        : []),
      'Right click to drink. Can only hold charges while in belt.',
    ].join('\n')

  it('extracts the full flask base with advanced mod descriptions on', () => {
    expect(parseItemText(flaskText(true))!.baseType).toBe('Transcendent Life Flask')
  })

  it('extracts the full flask base with advanced mod descriptions off', () => {
    expect(parseItemText(flaskText(false))!.baseType).toBe('Transcendent Life Flask')
  })

  it('is not truncated by a substring BaseType token from the loaded filter', () => {
    // PoE filters match BaseType by substring, so an author can write
    // `BaseType "Transcendent"` to catch both Transcendent Life and Mana flasks.
    registerFilterBaseTypes(['Transcendent'])
    expect(parseItemText(flaskText(true))!.baseType).toBe('Transcendent Life Flask')
  })

  it('extracts a magic jewel base from the now-enumerated Jewels class', () => {
    const text = [
      'Item Class: Jewels',
      'Rarity: Magic',
      'Fanatical Emerald of Renewal',
      '--------',
      'Item Level: 80',
      '--------',
      '{ Prefix Modifier "Fanatical" (Tier: 2) }',
      '+12(10-13)% increased Skill Speed',
      '{ Suffix Modifier "of Renewal" (Tier: 3) }',
      '+5(4-6) to maximum Mana',
      '--------',
      'Place into an allocated Jewel Socket on the Passive Skill Tree.',
    ].join('\n')
    expect(parseItemText(text)!.baseType).toBe('Emerald')
  })

  it('extracts a magic weapon base from a now-enumerated weapon class', () => {
    const text = [
      'Item Class: Two Hand Swords',
      'Rarity: Magic',
      'Honed Iron Greatsword of the Worthy',
      '--------',
      'Physical Damage: 38-71',
      '--------',
      'Requires: Level 33, 73 Str',
      '--------',
      'Item Level: 40',
      '--------',
      '{ Prefix Modifier "Honed" (Tier: 5) }',
      '+18(15-20)% increased Physical Damage',
      '{ Suffix Modifier "of the Worthy" (Tier: 4) }',
      '+9(8-10) to Strength',
    ].join('\n')
    expect(parseItemText(text)!.baseType).toBe('Iron Greatsword')
  })
})
