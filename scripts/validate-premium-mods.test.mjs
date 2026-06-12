/**
 * Tests for scripts/validate-premium-mods.mjs
 * Co-located with the script under scripts/ per project convention.
 * vitest.config.ts includes scripts/**\/\*.test.mjs with node environment.
 */
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { validatePremiumMods, checkStatIdsOnline } from './validate-premium-mods.mjs'

const _require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const bundledData = _require(join(here, '..', 'src', 'shared', 'data', 'items', 'premium-mods.json'))

// ---- helpers ----

function makeStatListEntry(overrides = {}) {
  return {
    mode: 'stat_list',
    mods: [{ id: 'explicit.stat_1234567890' }],
    confidence: 'verified',
    ...overrides,
  }
}

// ---- test 1: bundled data ----

describe('validatePremiumMods - bundled premium-mods.json', () => {
  it('passes with zero errors, and any warning is only a legacy-entry notice', () => {
    const { errors, warnings } = validatePremiumMods(bundledData)
    expect(errors).toEqual([])
    // The bundled file has no legacy entries left (all migrated to v2 objects), so
    // warnings is normally empty; if a legacy entry is ever reintroduced, the only
    // acceptable warning is the legacy-entry notice.
    expect(warnings.every((w) => /legacy text entry/.test(w))).toBe(true)
  })
})

// ---- test 2: schema violations ----

describe('validatePremiumMods - schema violations', () => {
  it('rejects schemaVersion 1', () => {
    const data = { schemaVersion: 1, poe1: {}, poe2: {} }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => /schemaVersion/.test(e) || /const/.test(e))).toBe(true)
  })

  it('rejects object entry missing confidence', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': { mode: 'none' },
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects mode stat_list without mods', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': { mode: 'stat_list', confidence: 'verified' },
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects bad stat id pattern in mods[].id', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': makeStatListEntry({ mods: [{ id: 'INVALID_FORMAT' }] }),
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects unknown nonStatFilters token', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': makeStatListEntry({ nonStatFilters: ['not_a_real_filter'] }),
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects prefill > 1 (value 1.5)', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': makeStatListEntry({
          mods: [{ id: 'explicit.stat_1234567890', prefill: 1.5 }],
        }),
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ---- test 3: requireVerified flag ----

describe('validatePremiumMods - requireVerified', () => {
  it('produces error for carry_over confidence only when flag is set', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': { mode: 'none', confidence: 'carry_over' },
      },
      poe2: {},
    }

    const withoutFlag = validatePremiumMods(data, { requireVerified: false })
    expect(withoutFlag.errors).toEqual([])

    const withFlag = validatePremiumMods(data, { requireVerified: true })
    expect(withFlag.errors.length).toBeGreaterThan(0)
    expect(withFlag.errors[0]).toMatch(/carry_over/)
  })
})

// ---- test 4: duplicate mod ids ----

describe('validatePremiumMods - duplicate mod ids', () => {
  it('errors on duplicate stat id within one entry mods array', () => {
    const data = {
      schemaVersion: 2,
      poe1: {
        'Test Item': makeStatListEntry({
          mods: [{ id: 'explicit.stat_1111111111' }, { id: 'explicit.stat_1111111111' }],
        }),
      },
      poe2: {},
    }
    const { errors } = validatePremiumMods(data)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/duplicate mod id/)
  })
})

// ---- test 5: checkStatIdsOnline export ----

describe('checkStatIdsOnline', () => {
  it('is exported as a function (no network call in tests)', () => {
    expect(typeof checkStatIdsOnline).toBe('function')
  })
})
