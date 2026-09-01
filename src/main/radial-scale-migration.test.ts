import { describe, expect, it, vi } from 'vitest'
import type Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import {
  migratePluginSliceIcons,
  runRadialPluginIconMigration,
  runRadialScaleMigration,
  unfoldRadialScale,
} from './radial-scale-migration'

/** Minimal electron-store stand-in: a plain bag with get/set. */
function fakeStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial }
  return {
    data,
    get: vi.fn((k: string) => data[k]),
    set: vi.fn((k: string, v: unknown) => {
      data[k] = v
    }),
  }
}
const asStore = (s: ReturnType<typeof fakeStore>): Store<AppSettings> => s as unknown as Store<AppSettings>

describe('unfoldRadialScale', () => {
  it('turns the legacy 0.7 into exactly 1, which is the whole point', () => {
    expect(unfoldRadialScale(0.7)).toBe(1)
  })

  it('leaves an absent scale absent', () => {
    // Never expressed a preference, and the folded base at 1.0 IS the approved
    // geometry - so writing anything here would be the regression.
    expect(unfoldRadialScale(undefined)).toBeUndefined()
    expect(unfoldRadialScale(Number.NaN)).toBeUndefined()
  })

  it('clamps what the division pushes out of range', () => {
    // /0.7 is x1.43, so anything above ~0.98 lands past RADIAL_SCALE_MAX.
    expect(unfoldRadialScale(1)).toBe(1.4)
    expect(unfoldRadialScale(1.4)).toBe(1.4)
    expect(unfoldRadialScale(0.1)).toBe(0.6)
  })

  it('scales the middle of the range proportionally', () => {
    expect(unfoldRadialScale(0.63)).toBeCloseTo(0.9, 10)
  })
})

describe('runRadialScaleMigration', () => {
  it('normalises a stored scale and marks itself done', () => {
    const store = fakeStore({ radialMenu: { slices: [{ id: 'a' }], scale: 0.7 } })
    runRadialScaleMigration(asStore(store))
    expect(store.data.radialMenu).toEqual({ slices: [{ id: 'a' }], scale: 1 })
    expect(store.data.radialScaleFoldMigrationDone).toBe(true)
  })

  it('never runs twice - a second pass would divide by 0.7 again', () => {
    const store = fakeStore({ radialMenu: { slices: [], scale: 0.7 } })
    runRadialScaleMigration(asStore(store))
    runRadialScaleMigration(asStore(store))
    expect((store.data.radialMenu as { scale: number }).scale).toBe(1)
  })

  it('respects the flag on a store that already has it', () => {
    const store = fakeStore({ radialMenu: { slices: [], scale: 0.7 }, radialScaleFoldMigrationDone: true })
    runRadialScaleMigration(asStore(store))
    expect((store.data.radialMenu as { scale: number }).scale).toBe(0.7)
  })

  it('does not invent a scale on a fresh install', () => {
    const store = fakeStore({ radialMenu: { slices: [] } })
    runRadialScaleMigration(asStore(store))
    expect(store.data.radialMenu).toEqual({ slices: [] })
    expect(store.data.radialScaleFoldMigrationDone).toBe(true)
  })

  it('survives a store with no radialMenu at all', () => {
    const store = fakeStore()
    expect(() => runRadialScaleMigration(asStore(store))).not.toThrow()
    expect(store.data.radialMenu).toBeUndefined()
    expect(store.data.radialScaleFoldMigrationDone).toBe(true)
  })
})

describe('migratePluginSliceIcons', () => {
  const plugin = (icon: string) => ({
    id: 'p',
    icon,
    label: 'P',
    action: { kind: 'appmacro' as const, action: 'plugin:acme' },
  })

  it('re-points a legacy plugin slice at the sentinel', () => {
    const { slices, changed } = migratePluginSliceIcons([plugin('Components')])
    expect(changed).toBe(true)
    expect(slices[0].icon).toBe('plugin-icon')
  })

  it('covers plugin-overlay actions too', () => {
    const s = {
      id: 'o',
      icon: 'Components',
      label: 'O',
      action: { kind: 'appmacro' as const, action: 'plugin-overlay:acme' },
    }
    expect(migratePluginSliceIcons([s]).slices[0].icon).toBe('plugin-icon')
  })

  it('leaves a deliberately picked glyph alone', () => {
    const { slices, changed } = migratePluginSliceIcons([plugin('Diamond')])
    expect(changed).toBe(false)
    expect(slices[0].icon).toBe('Diamond')
  })

  it('leaves NON-plugin slices on Components alone', () => {
    // toggleRegexRemote genuinely defaults to Components and is not a plugin.
    const s = {
      id: 'r',
      icon: 'Components',
      label: 'R',
      action: { kind: 'appmacro' as const, action: 'toggleRegexRemote' },
    }
    expect(migratePluginSliceIcons([s]).changed).toBe(false)
  })

  it('is idempotent', () => {
    const once = migratePluginSliceIcons([plugin('Components')]).slices
    expect(migratePluginSliceIcons(once).changed).toBe(false)
  })
})

describe('runRadialPluginIconMigration', () => {
  const legacy = { id: 'p', icon: 'Components', label: 'P', action: { kind: 'appmacro', action: 'plugin:acme' } }

  it('rewrites stored slices and marks itself done', () => {
    const store = fakeStore({ radialMenu: { slices: [legacy], scale: 1 } })
    runRadialPluginIconMigration(asStore(store))
    expect((store.data.radialMenu as { slices: { icon: string }[] }).slices[0].icon).toBe('plugin-icon')
    // The sibling field has to survive - radialMenu is patched, never rebuilt.
    expect((store.data.radialMenu as { scale: number }).scale).toBe(1)
    expect(store.data.radialPluginIconMigrationDone).toBe(true)
  })

  it('respects its own flag, independent of the scale migration', () => {
    const store = fakeStore({ radialMenu: { slices: [legacy] }, radialPluginIconMigrationDone: true })
    runRadialPluginIconMigration(asStore(store))
    expect((store.data.radialMenu as { slices: { icon: string }[] }).slices[0].icon).toBe('Components')
  })

  it('survives an empty or missing ring', () => {
    const store = fakeStore()
    expect(() => runRadialPluginIconMigration(asStore(store))).not.toThrow()
    expect(store.data.radialPluginIconMigrationDone).toBe(true)
  })
})
