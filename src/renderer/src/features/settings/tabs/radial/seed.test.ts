import { describe, expect, it } from 'vitest'
import { RADIAL_PLUGIN_ICON } from '@shared/contracts/radial'
import { defaultIconFor, defaultSliceIcon } from '@renderer/shared/radial-icons'
import { buildDefaultSlices } from './seed'

const base = { hotkey: '', priceCheckHotkey: '', appMacros: [], chatCommands: [] }

describe('buildDefaultSlices', () => {
  it('seeds bound families in priority order: filter, pricecheck, app macros, chat, cheat sheets', () => {
    const slices = buildDefaultSlices({
      hotkey: 'CommandOrControl+D',
      priceCheckHotkey: 'CommandOrControl+A',
      appMacros: [{ action: 'openWiki', hotkey: 'F9' }],
      chatCommands: [{ hotkey: 'F5', command: '/hideout', autoSubmit: true }],
      cheatSheets: { globalHotkey: 'F7', categories: [{ id: 'c1', name: 'Lab', hotkey: 'F8', sheets: [] }] },
    })
    expect(slices.map((s) => s.action)).toEqual([
      { kind: 'filter' },
      { kind: 'pricecheck' },
      { kind: 'appmacro', action: 'openWiki', presetId: undefined },
      { kind: 'chat', command: '/hideout', autoSubmit: true },
      { kind: 'cheatsheet', categoryId: undefined },
      { kind: 'cheatsheet', categoryId: 'c1' },
    ])
    expect(slices.every((s) => s.id && s.icon && s.label)).toBe(true)
  })

  it('skips unbound entries and the radial macro itself', () => {
    const slices = buildDefaultSlices({
      ...base,
      appMacros: [
        { action: 'openRadialMenu', hotkey: 'F2' },
        { action: 'openWiki', hotkey: '' },
        { action: 'closeOverlay', hotkey: 'F4' },
      ],
    })
    expect(slices.map((s) => s.action)).toEqual([{ kind: 'appmacro', action: 'closeOverlay', presetId: undefined }])
  })

  it('caps at 8', () => {
    const slices = buildDefaultSlices({
      hotkey: 'CommandOrControl+D',
      priceCheckHotkey: 'CommandOrControl+A',
      appMacros: [
        { action: 'openWiki', hotkey: 'F9' },
        { action: 'openPoeDb', hotkey: 'F10' },
        { action: 'openRegex', hotkey: 'F11' },
        { action: 'closeOverlay', hotkey: 'F12' },
      ],
      chatCommands: [
        { hotkey: 'F5', command: '/hideout', autoSubmit: true },
        { hotkey: 'F6', command: '/kingsmarch', autoSubmit: true },
        { hotkey: 'F3', command: '/exit', autoSubmit: true },
      ],
    })
    expect(slices).toHaveLength(8)
  })

  it('labels come from APP_MACRO_DEFS, command text, and category names', () => {
    const slices = buildDefaultSlices({
      ...base,
      appMacros: [{ action: 'openWiki', hotkey: 'F9' }],
      chatCommands: [{ hotkey: 'F5', command: '/hideout', autoSubmit: true }],
      cheatSheets: { globalHotkey: '', categories: [{ id: 'c1', name: 'Lab', hotkey: 'F8', sheets: [] }] },
    })
    expect(slices.map((s) => s.label)).toEqual(['Open Wiki', '/hideout', 'Lab'])
  })

  it('unique ids', () => {
    const slices = buildDefaultSlices({
      ...base,
      chatCommands: [
        { hotkey: 'F5', command: '/a', autoSubmit: true },
        { hotkey: 'F6', command: '/b', autoSubmit: true },
      ],
    })
    expect(new Set(slices.map((s) => s.id)).size).toBe(2)
  })
})

describe('plugin slices default to the plugin art', () => {
  it('seeds a plugin-backed app macro with the sentinel, not a glyph', () => {
    const slices = buildDefaultSlices({
      ...base,
      appMacros: [
        { action: 'plugin:acme.tool', hotkey: 'F9' },
        { action: 'plugin-overlay:acme.tool', hotkey: 'F10' },
        { action: 'openWiki', hotkey: 'F11' },
      ],
    })
    expect(slices.map((s) => s.icon)).toEqual([RADIAL_PLUGIN_ICON, RADIAL_PLUGIN_ICON, 'BookOne'])
  })

  it('defaultSliceIcon is the only thing that knows about the sentinel', () => {
    // defaultIconFor stays glyph-typed: the split is what keeps the compile-time
    // guarantee over the curated set intact.
    expect(defaultSliceIcon({ kind: 'appmacro', action: 'plugin:x' })).toBe(RADIAL_PLUGIN_ICON)
    expect(defaultSliceIcon({ kind: 'filter' })).toBe('Filter')
    expect(defaultIconFor({ kind: 'appmacro', action: 'plugin:x' })).toBe('Components')
  })
})
