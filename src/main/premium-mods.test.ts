import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '') },
}))

import { _setPremiumModsForTests, getPremiumMods, applyRemotePremiumMods } from './premium-mods'
import type { PremiumModsData } from '../shared/data/items/premium-mods-types'

const valid: PremiumModsData = { schemaVersion: 1, poe1: {}, poe2: {} }

describe('applyRemotePremiumMods', () => {
  beforeEach(() => _setPremiumModsForTests(null))

  it('adopts data with a compatible schemaVersion', () => {
    applyRemotePremiumMods(valid)
    expect(getPremiumMods()).toBe(valid)
  })

  it('rejects data with an incompatible schemaVersion', () => {
    applyRemotePremiumMods({ ...valid, schemaVersion: 999 } as PremiumModsData)
    expect(getPremiumMods()).toBeNull()
  })

  it('rejects malformed data (missing poe1/poe2)', () => {
    applyRemotePremiumMods({ schemaVersion: 1 } as unknown as PremiumModsData)
    expect(getPremiumMods()).toBeNull()
  })
})
