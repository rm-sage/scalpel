import { describe, expect, it } from 'vitest'
import type { StatFilter } from '../../trade'
import type { ResolvedOverride } from './overrides'
import { applyUniqueOverrides } from './apply-overrides'

// Small helper: build a minimal StatFilter with defaults
function row(partial: Partial<StatFilter> & { id: string; type: string }): StatFilter {
  return {
    text: partial.text ?? partial.id,
    value: null,
    min: null,
    max: null,
    enabled: false,
    ...partial,
  }
}

function emptyOverride(partial: Partial<ResolvedOverride> = {}): ResolvedOverride {
  return {
    mode: null,
    mods: new Map(),
    lowerIsBetter: new Set(),
    nonStatFilters: new Set(),
    defaultFilters: {},
    ...partial,
  }
}

// ─── Test 1: Voices stat_list, direction lower ────────────────────────────────

describe('applyUniqueOverrides', () => {
  it('stat_list lower direction: min null, max ceil(value/p), enabled+premium', () => {
    const statId = 'explicit.stat_X'
    const r = row({ id: statId, type: 'explicit', value: 5, min: 4, max: null })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([[statId, { id: statId, direction: 'lower' }]]),
    })
    const result = applyUniqueOverrides([r], o, { pct: 0.9, corrupted: false })
    const out = result.find((f) => f.id === statId)!
    expect(out.enabled).toBe(true)
    expect(out.premium).toBe(true)
    expect(out.min).toBeNull()
    // value=5, p=0.9 -> ceil(5 / 0.9) = ceil(5.556) = 6
    expect(out.max).toBe(6)
  })

  // ─── Test 2: Olroth stat_list, two mods ────────────────────────────────────

  it('stat_list two mods: lower spec value 22 -> max 25; higher no-prefill mod unchanged', () => {
    const chargeStat = 'explicit.stat_charges'
    const otherStat = 'explicit.stat_other'
    const chargeRow = row({ id: chargeStat, type: 'explicit', value: 22, min: 19, max: null })
    // other mod has producer min already set; direction higher without prefill -> unchanged
    const otherRow = row({ id: otherStat, type: 'explicit', value: 120, min: 108, max: null })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([
        [chargeStat, { id: chargeStat, direction: 'lower' }],
        [otherStat, { id: otherStat, direction: 'higher' }], // no prefill
      ]),
    })
    const result = applyUniqueOverrides([chargeRow, otherRow], o, { pct: 0.9, corrupted: false })
    const chargeOut = result.find((f) => f.id === chargeStat)!
    // value=22, p=0.9 -> ceil(22/0.9) = ceil(24.44) = 25
    expect(chargeOut.min).toBeNull()
    expect(chargeOut.max).toBe(25)
    expect(chargeOut.enabled).toBe(true)

    const otherOut = result.find((f) => f.id === otherStat)!
    // higher without prefill -> no change to producer bounds
    expect(otherOut.min).toBe(108)
    expect(otherOut.max).toBeNull()
    expect(otherOut.enabled).toBe(true)
  })

  // ─── Test 3: lowerIsBetter set (class rule), sign-aware ────────────────────

  it('lowerIsBetter set: positive value 15 -> max 17; negative value -8 -> max -7', () => {
    const posId = 'explicit.stat_pos'
    const negId = 'explicit.stat_neg'
    const posRow = row({ id: posId, type: 'explicit', value: 15, min: 13, max: null })
    const negRow = row({ id: negId, type: 'explicit', value: -8, min: null, max: -8 })
    const o = emptyOverride({
      mode: 'all_explicits',
      lowerIsBetter: new Set([posId, negId]),
    })
    const result = applyUniqueOverrides([posRow, negRow], o, { pct: 0.9, corrupted: false })
    const posOut = result.find((f) => f.id === posId)!
    // value=15 >= 0 -> max = ceil(15 / 0.9) = ceil(16.67) = 17
    expect(posOut.min).toBeNull()
    expect(posOut.max).toBe(17)

    const negOut = result.find((f) => f.id === negId)!
    // value=-8 < 0 -> max = ceil(-8 * 0.9) = ceil(-7.2) = -7
    expect(negOut.min).toBeNull()
    expect(negOut.max).toBe(-7)
  })

  // ─── Test 4: mode none ─────────────────────────────────────────────────────

  it('mode none: explicit/pseudo/defence/weapon rows disabled, premium stripped; foulborn+implicit untouched', () => {
    const explRow = row({ id: 'explicit.foo', type: 'explicit', enabled: true, premium: true })
    const pseudoRow = row({ id: 'pseudo.bar', type: 'pseudo', enabled: true })
    const defRow = row({ id: 'defence.armour', type: 'defence', enabled: true })
    const weapRow = row({ id: 'weapon.pdps', type: 'weapon', enabled: true })
    const foulRow = row({ id: 'explicit.foul', type: 'explicit', enabled: true, foulborn: true })
    const implRow = row({ id: 'implicit.imp', type: 'implicit', enabled: true })
    const o = emptyOverride({ mode: 'none' })
    const result = applyUniqueOverrides([explRow, pseudoRow, defRow, weapRow, foulRow, implRow], o, {
      pct: 0.9,
      corrupted: false,
    })

    expect(result.find((f) => f.id === 'explicit.foo')!.enabled).toBe(false)
    expect(result.find((f) => f.id === 'explicit.foo')!.premium).toBeUndefined()
    expect(result.find((f) => f.id === 'pseudo.bar')!.enabled).toBe(false)
    expect(result.find((f) => f.id === 'defence.armour')!.enabled).toBe(false)
    expect(result.find((f) => f.id === 'weapon.pdps')!.enabled).toBe(false)
    // foulborn untouched
    expect(result.find((f) => f.id === 'explicit.foul')!.enabled).toBe(true)
    // implicit untouched
    expect(result.find((f) => f.id === 'implicit.imp')!.enabled).toBe(true)
  })

  // ─── Test 5: mode all_explicits ────────────────────────────────────────────

  it('mode all_explicits: rolled explicit enabled; fixedRoll row NOT enabled; misc.corrupted enabled', () => {
    const rolledRow = row({ id: 'explicit.stat_A', type: 'explicit', value: 50, min: 45, max: null, enabled: false })
    const fixedRow = row({
      id: 'explicit.stat_B',
      type: 'explicit',
      value: 10,
      min: 10,
      max: null,
      enabled: false,
      fixedRoll: true,
    })
    const corruptedRow = row({ id: 'misc.corrupted', type: 'misc', enabled: false })
    const o = emptyOverride({ mode: 'all_explicits' })
    const result = applyUniqueOverrides([rolledRow, fixedRow, corruptedRow], o, { pct: 0.9, corrupted: false })

    expect(result.find((f) => f.id === 'explicit.stat_A')!.enabled).toBe(true)
    // all_explicits rows must be flagged premium so the renderer's auto-Base-mode on uniques
    // keeps them enabled (Base mode only preserves premium/foulborn/perfectRoll/learned rows).
    expect(result.find((f) => f.id === 'explicit.stat_A')!.premium).toBe(true)
    expect(result.find((f) => f.id === 'explicit.stat_B')!.enabled).toBe(false)
    expect(result.find((f) => f.id === 'misc.corrupted')!.enabled).toBe(true)
  })

  // ─── Test 6: stat_list secondary and unlisted rows ─────────────────────────

  it('stat_list secondary: secondary row off; unlisted explicit+pseudo disabled; defence untouched', () => {
    const primaryId = 'explicit.stat_P'
    const secondaryId = 'explicit.stat_S'
    const unlistedExpl = row({ id: 'explicit.stat_U', type: 'explicit', enabled: true, value: 100, min: 90, max: null })
    const unlistedPseudo = row({
      id: 'pseudo.total_res',
      type: 'pseudo',
      enabled: true,
      value: 100,
      min: 90,
      max: null,
    })
    const defRow = row({ id: 'defence.armour', type: 'defence', enabled: true })
    const secondaryRow = row({ id: secondaryId, type: 'explicit', enabled: true, value: 50, min: 45, max: null })
    const primaryRow = row({ id: primaryId, type: 'explicit', enabled: false, value: 30, min: null, max: null })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([
        [primaryId, { id: primaryId, direction: 'higher' as const }],
        [secondaryId, { id: secondaryId, tier: 'secondary' as const }],
      ]),
    })
    const result = applyUniqueOverrides([primaryRow, secondaryRow, unlistedExpl, unlistedPseudo, defRow], o, {
      pct: 0.9,
      corrupted: false,
    })

    // secondary -> enabled false
    expect(result.find((f) => f.id === secondaryId)!.enabled).toBe(false)
    // unlisted explicit + pseudo -> disabled
    expect(result.find((f) => f.id === 'explicit.stat_U')!.enabled).toBe(false)
    expect(result.find((f) => f.id === 'pseudo.total_res')!.enabled).toBe(false)
    // defence untouched
    expect(result.find((f) => f.id === 'defence.armour')!.enabled).toBe(true)
  })

  // ─── Test 6b: stat_list secondary direction bounds still applied ────────────

  it('stat_list secondary with direction lower: enabled false AND max/min set from bound math', () => {
    const secondaryId = 'explicit.stat_S2'
    // direction 'lower', value 22, pct 0.9 -> max = ceil(22 / 0.9) = ceil(24.44) = 25, min null
    const secondaryRow = row({ id: secondaryId, type: 'explicit', enabled: true, value: 22, min: 19, max: null })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([[secondaryId, { id: secondaryId, direction: 'lower' as const, tier: 'secondary' as const }]]),
    })
    const result = applyUniqueOverrides([secondaryRow], o, { pct: 0.9, corrupted: false })
    const out = result.find((f) => f.id === secondaryId)!
    // secondary: off, no premium flag
    expect(out.enabled).toBe(false)
    expect(out.premium).toBeUndefined()
    // bounds still computed so user can re-enable with correct prefill
    expect(out.min).toBeNull()
    // value=22, p=0.9 -> ceil(22/0.9) = ceil(24.44) = 25
    expect(out.max).toBe(25)
  })

  // ─── Test 7: prefill override and modRange clamping ────────────────────────

  it('prefill override: spec prefill 0.8 value 100 -> min 80; clamps to modRange.min when below', () => {
    const statId = 'explicit.stat_clamped'
    // modRange.min = 85; value=100 >= 85; floor(100 * 0.8) = 80 < 85 -> clamped to 85
    const r = row({
      id: statId,
      type: 'explicit',
      value: 100,
      min: 90,
      max: null,
      modRange: { min: 85, max: 150 },
    })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([[statId, { id: statId, direction: 'higher' as const, prefill: 0.8 }]]),
    })
    const result = applyUniqueOverrides([r], o, { pct: 0.9, corrupted: false })
    const out = result.find((f) => f.id === statId)!
    // floor(100 * 0.8) = 80 < modRange.min 85 -> clamp to 85
    expect(out.min).toBe(85)
    expect(out.enabled).toBe(true)

    // Also test without clamping needed: modRange.min = 70; floor(100*0.8) = 80 >= 70 -> 80
    const r2 = row({
      id: statId,
      type: 'explicit',
      value: 100,
      min: 90,
      max: null,
      modRange: { min: 70, max: 150 },
    })
    const result2 = applyUniqueOverrides([r2], o, { pct: 0.9, corrupted: false })
    expect(result2.find((f) => f.id === statId)!.min).toBe(80)
  })

  // ─── Test 8: defaultFilters corrupted false ─────────────────────────────────

  it('defaultFilters corrupted false: misc.corrupted enabled with chipState from ctx.corrupted', () => {
    const corruptedRow = row({ id: 'misc.corrupted', type: 'misc', enabled: false })
    const o = emptyOverride({ defaultFilters: { corrupted: false } })
    // ctx.corrupted false -> chipState 'no'
    const r1 = applyUniqueOverrides([{ ...corruptedRow }], o, { pct: 0.9, corrupted: false })
    const out1 = r1.find((f) => f.id === 'misc.corrupted')!
    expect(out1.enabled).toBe(true)
    expect(out1.chipState).toBe('no')

    // ctx.corrupted true -> chipState 'yes'
    const r2 = applyUniqueOverrides([{ ...corruptedRow }], o, { pct: 0.9, corrupted: true })
    const out2 = r2.find((f) => f.id === 'misc.corrupted')!
    expect(out2.enabled).toBe(true)
    expect(out2.chipState).toBe('yes')
  })

  // ─── Test 9: nonStatFilters ─────────────────────────────────────────────────

  it('nonStatFilters: granted_skill_level flips skill rows; socket_colors flips socket.white_sockets; native no-op', () => {
    const skillRow = row({ id: 'skill.granted', type: 'skill', enabled: false })
    const whiteRow = row({ id: 'socket.white_sockets', type: 'socket', enabled: false })
    const enchantRow = row({ id: 'enchant.some', type: 'enchant', enabled: false })
    const o = emptyOverride({
      nonStatFilters: new Set(['granted_skill_level', 'socket_colors', 'links']),
    })
    const result = applyUniqueOverrides([skillRow, whiteRow, enchantRow], o, { pct: 0.9, corrupted: false })
    expect(result.find((f) => f.id === 'skill.granted')!.enabled).toBe(true)
    expect(result.find((f) => f.id === 'socket.white_sockets')!.enabled).toBe(true)
    // enchant row was not targeted -> stays off
    expect(result.find((f) => f.id === 'enchant.some')!.enabled).toBe(false)
  })

  // ─── Test 10: option-suffixed row id matches mods spec by base id ───────────

  it('option-suffixed row id matches mods spec keyed by base id', () => {
    const baseId = 'explicit.stat_X'
    const suffixedId = 'explicit.stat_X|123'
    const r = row({ id: suffixedId, type: 'explicit', value: 5, min: null, max: null })
    const o = emptyOverride({
      mode: 'stat_list',
      mods: new Map([[baseId, { id: baseId, direction: 'lower' as const }]]),
    })
    const result = applyUniqueOverrides([r], o, { pct: 0.9, corrupted: false })
    const out = result.find((f) => f.id === suffixedId)!
    expect(out.enabled).toBe(true)
    expect(out.premium).toBe(true)
    // value=5, lower -> max = ceil(5/0.9) = 6
    expect(out.max).toBe(6)
  })
})
