import { useEffect, useState } from 'react'
import { Drag } from '@icon-park/react'
import { ReactSortable } from 'react-sortablejs'
import type { AppSettings, RuntimeSettings } from '@shared/types'
import {
  clampRadialScale,
  pluginIdFromAction,
  pluginSliceIcon,
  RADIAL_MACRO_ACTION,
  RADIAL_MAX_SLICES,
  RADIAL_SCALE_MAX,
  RADIAL_SCALE_MIN,
  type RadialAction,
  type RadialMenuSettings,
  type RadialSlice,
} from '@shared/contracts/radial'
import { HotkeyField } from '@renderer/components/primitives/HotkeyField'
import type { HotkeySlot } from '@renderer/components/primitives/hotkey-collisions'
import { RemoveButton } from '@renderer/components/RemoveButton'
import { Toggle } from '@renderer/components/Toggle'
import { defaultSliceIcon } from '@renderer/shared/radial-icons'
import { IP } from '@renderer/shared/constants'
import { CommandInput } from '../CommandInput'
import { APP_MACRO_DEFS } from '../utils'
import { buildDefaultSlices, newSliceId } from './seed'
import { IconPicker } from './IconPicker'
import { m } from '@shared/paraglide/messages.js'

/** Serialize a slice action into a single <select> value. Chat commands live on
 *  the slice by value, so the select only carries the kind; the command text is
 *  edited by the row's CommandInput. */
function serializeAction(action: RadialAction): string {
  switch (action.kind) {
    case 'filter':
      return 'filter'
    case 'pricecheck':
      return 'pricecheck'
    case 'appmacro':
      return `appmacro:${action.action}`
    case 'chat':
      return 'chat'
    case 'cheatsheet':
      return action.categoryId ? `cheatsheet:${action.categoryId}` : 'cheatsheet'
  }
}

function parseAction(value: string): RadialAction {
  if (value === 'pricecheck') return { kind: 'pricecheck' }
  if (value === 'chat') return { kind: 'chat', command: '', autoSubmit: true }
  if (value === 'cheatsheet') return { kind: 'cheatsheet' }
  if (value.startsWith('cheatsheet:')) return { kind: 'cheatsheet', categoryId: value.slice('cheatsheet:'.length) }
  if (value.startsWith('appmacro:')) return { kind: 'appmacro', action: value.slice('appmacro:'.length) }
  return { kind: 'filter' }
}

interface Props {
  settings: RuntimeSettings
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateMany: (patch: Partial<AppSettings>) => void
  tryHotkey: (hotkey: string, slot: HotkeySlot) => boolean
  presetOptions: Array<{ id: string; label: string }>
  pluginHotkeys: Array<{ action: string; pluginId: string; label: string }>
  getPluginName: (id: string) => string
  /** The plugin's manifest icon, for plugins that registered no title-bar tab.
   *  Optional so callers that have no manifests handy still compile; the tab
   *  registry alone is what the ring used to rely on. */
  getPluginManifestIcon?: (id: string) => string | undefined
}

/** Radial Menu block of the Macros tab: the ring's own hotkey (stored as the
 *  `openRadialMenu` app-macro entry, which the generic Scalpel Hotkeys list
 *  filters out) plus the drag-orderable slice list. */
export function RadialMenuSection({
  settings,
  update,
  updateMany,
  tryHotkey,
  presetOptions,
  pluginHotkeys,
  getPluginName,
  getPluginManifestIcon,
}: Props): JSX.Element {
  const appMacros = settings.appMacros ?? []
  const macroIndex = appMacros.findIndex((entry) => entry.action === RADIAL_MACRO_ACTION)
  const hotkey = macroIndex >= 0 ? appMacros[macroIndex].hotkey : ''
  const radial = settings.radialMenu
  const slices = radial?.slices ?? []
  const scalePercent = Math.round(clampRadialScale(radial?.scale) * 100)
  // Cheat sheets are profile-backed and already on RuntimeSettings, the same
  // source CheatSheetsTab edits - no extra fetch needed to seed or list them.
  const cheatSheets = settings.activeProfile?.cheatSheets
  const categories = cheatSheets?.categories ?? []

  const pluginNameForAction = (action: string): string => {
    const pluginId = pluginIdFromAction({ kind: 'appmacro', action })
    return pluginId ? getPluginName(pluginId) : action
  }

  // A plugin slice DEFAULTS to the plugin's own tab icon (main resolves it into
  // the open payload), so the picker has to be able to show and offer that art
  // as well as the glyph grid - otherwise the row would advertise an icon the
  // user never sees on the ring. Fetched once: this section is remounted on
  // every settings open, and a plugin's icon doesn't change while it sits there.
  const [pluginIcons, setPluginIcons] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    let alive = true
    void window.api.pluginListRegisteredTabs().then((tabs) => {
      if (alive) setPluginIcons(new Map(tabs.map((t) => [t.pluginId, t.icon])))
    })
    return () => {
      alive = false
    }
  }, [])

  /** Registered tab icon for a plugin-backed slice, or undefined - which is both
   *  "not a plugin action" and "plugin registered no tab", and both fall back to
   *  the IconPark picker. */
  const pluginIconFor = (action: RadialAction): string | undefined => {
    const pluginId = pluginIdFromAction(action)
    if (!pluginId) return undefined
    // Same order main uses for the ring - see pluginSliceIcon. Without the
    // manifest half, an overlay-only plugin (which registers no tab, so has no
    // registry entry) would offer no art to pick here while the ring drew it.
    return pluginSliceIcon(pluginIcons.get(pluginId), getPluginManifestIcon?.(pluginId))
  }

  /** The ONE radialMenu write. It has more than one field now, so every write
   *  has to patch the stored object rather than rebuild it - a bare
   *  `{ slices }` would silently reset the user's size on the next reorder. */
  const writeRadial = (patch: Partial<RadialMenuSettings>): void =>
    update('radialMenu', { slices, ...radial, ...patch })

  const writeSlices = (next: RadialSlice[]): void => writeRadial({ slices: next })

  const seed = (): RadialSlice[] =>
    buildDefaultSlices({
      hotkey: settings.hotkey,
      priceCheckHotkey: settings.priceCheckHotkey,
      appMacros,
      chatCommands: settings.chatCommands ?? [],
      cheatSheets,
      pluginName: pluginNameForAction,
    })

  /** Label shown on the ring. English literals matching buildDefaultSlices so a
   *  hand-picked slice reads the same as a seeded one. */
  const labelForAction = (action: RadialAction): string => {
    switch (action.kind) {
      case 'filter':
        return 'Filter Check'
      case 'pricecheck':
        return 'Price Check'
      case 'chat':
        return action.command || m.settings_radial_action_chat()
      case 'cheatsheet':
        return categories.find((c) => c.id === action.categoryId)?.name ?? 'Cheat Sheets'
      case 'appmacro': {
        const preset = action.presetId ? presetOptions.find((p) => p.id === action.presetId) : undefined
        if (preset) return preset.label
        return APP_MACRO_DEFS.find((d) => d.id === action.action)?.label ?? pluginNameForAction(action.action)
      }
    }
  }

  const onHotkey = (next: string): void => {
    const slot: HotkeySlot = { kind: 'appmacro', index: macroIndex >= 0 ? macroIndex : appMacros.length }
    if (!tryHotkey(next, slot)) return
    const macros = [...appMacros]
    // The ring is game-agnostic, so the entry carries no explicit scope.
    const entry = {
      ...(macroIndex >= 0 ? macros[macroIndex] : {}),
      action: RADIAL_MACRO_ACTION,
      hotkey: next,
      scope: undefined,
    }
    if (macroIndex >= 0) macros[macroIndex] = entry
    else macros.push(entry)
    // Seed only on the first real binding - never clobber a ring the user built.
    // Both keys go out in ONE updateMany: two update() calls in the same tick
    // each spread the same stale settings, so the second would drop the first.
    // ...and the radialMenu value is patched, not rebuilt: a user who set a size
    // before ever binding the ring must not lose it to the seed.
    if (next && slices.length === 0) {
      updateMany({ appMacros: macros, radialMenu: { ...radial, slices: seed() } })
      return
    }
    update('appMacros', macros)
  }

  const patchSlice = (index: number, patch: Partial<RadialSlice>): void => {
    const next = slices.map((s) => ({ ...s }))
    next[index] = { ...next[index], ...patch }
    writeSlices(next)
  }

  const changeAction = (index: number, value: string): void => {
    const action = parseAction(value)
    patchSlice(index, { action, icon: defaultSliceIcon(action), label: labelForAction(action) })
  }

  // ReactSortable calls setList on non-drag renders too; writing then would
  // bounce settings on every render, so only persist a real order change.
  const onSort = (next: RadialSlice[]): void => {
    if (next.map((s) => s.id).join('|') === slices.map((s) => s.id).join('|')) return
    writeSlices(next.map(({ id, icon, label, action }) => ({ id, icon, label, action })))
  }

  const addSlice = (): void => {
    const action: RadialAction = { kind: 'filter' }
    writeSlices([
      ...slices,
      { id: newSliceId(), icon: defaultSliceIcon(action), label: labelForAction(action), action },
    ])
  }

  const pluginOptionLabel = (pluginId: string, label: string): string =>
    label ? `${getPluginName(pluginId)} - ${label}` : getPluginName(pluginId)

  // Every value the action select can offer. A slice whose action isn't in here
  // - a plugin-backed one before pluginHotkeys resolves or after an uninstall, a
  // cheatsheet:<id> whose category was deleted - would otherwise display the
  // first option's text and silently rewrite itself the moment it's touched.
  const knownActionValues = new Set<string>([
    'filter',
    'pricecheck',
    'chat',
    'cheatsheet',
    ...APP_MACRO_DEFS.map((d) => `appmacro:${d.id}`),
    ...pluginHotkeys.map((p) => `appmacro:${p.action}`),
    ...categories.map((c) => `cheatsheet:${c.id}`),
  ])

  return (
    <div className="flex flex-col gap-2">
      {/* The filter tab's hotkey setter verbatim, down to the wrapper: this is
          the app's one primary "bind a key" control, and the ring's binding is
          exactly that kind of thing. The explanatory line that used to sit
          beside it is gone with it - the control says what it is. */}
      <section data-testid="radial-hotkey">
        <label>{m.settings_radial_hotkey()}</label>
        <div className="mt-[6px]">
          <HotkeyField value={hotkey} onChange={onHotkey} />
        </div>
      </section>

      {(hotkey !== '' || slices.length > 0) && (
        <>
          {/* One knob for the whole ring: main resolves it into the open payload
              and every radius, the backdrop disc and the goo blur derive from
              it. Percent in the UI, a factor in settings. */}
          <section data-testid="radial-scale">
            <label>{m.settings_radial_size()}</label>
            <div className="setting-box mt-[2px] min-h-[40px] flex items-center gap-[10px]">
              <input
                type="range"
                min={RADIAL_SCALE_MIN * 100}
                max={RADIAL_SCALE_MAX * 100}
                step={5}
                value={scalePercent}
                onChange={(e) => writeRadial({ scale: clampRadialScale(parseInt(e.target.value, 10) / 100) })}
                className="flex-1"
              />
              <span className="text-[13px] font-semibold text-text min-w-[36px] text-right">{scalePercent}%</span>
            </div>
          </section>

          <ReactSortable
            list={slices.map((s) => ({ ...s }))}
            setList={onSort}
            animation={150}
            handle=".radial-grab"
            className="flex flex-col gap-2"
          >
            {slices.map((slice, i) => {
              const value = serializeAction(slice.action)
              const isSavedRegex = slice.action.kind === 'appmacro' && slice.action.action === 'useSavedRegex'
              const chat = slice.action.kind === 'chat' ? slice.action : null
              const pluginIcon = pluginIconFor(slice.action)
              return (
                <div key={slice.id} className="flex flex-col gap-[4px] bg-black/15 rounded p-[5px] min-w-0">
                  <div className="flex gap-[6px] items-center min-w-0">
                    <span className="radial-grab cursor-grab shrink-0 flex items-center text-text-dim">
                      <Drag size={14} {...IP} />
                    </span>
                    <IconPicker
                      value={slice.icon}
                      pluginIcon={pluginIcon}
                      onChange={(icon) => patchSlice(i, { icon })}
                    />
                    <select
                      value={value}
                      onChange={(e) => changeAction(i, e.target.value)}
                      className="text-[11px] flex-1 min-w-0 rounded h-[34px] box-border"
                      style={{ padding: '4px 24px 4px 8px' }}
                    >
                      {!knownActionValues.has(value) && (
                        <option value={value}>{m.settings_mac_plugin_not_loaded({ name: slice.label })}</option>
                      )}
                      <optgroup label={m.settings_radial_group_builtin()}>
                        <option value="filter">{m.settings_filter_hotkey()}</option>
                        <option value="pricecheck">{m.settings_pc_hotkey()}</option>
                      </optgroup>
                      <optgroup label={m.settings_radial_group_actions()}>
                        {APP_MACRO_DEFS.map((d) => (
                          <option key={d.id} value={`appmacro:${d.id}`}>
                            {d.label}
                          </option>
                        ))}
                        {pluginHotkeys.map((p) => (
                          <option key={p.action} value={`appmacro:${p.action}`}>
                            {pluginOptionLabel(p.pluginId, p.label)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={m.settings_radial_group_chat()}>
                        <option value="chat">{m.settings_radial_action_chat()}</option>
                      </optgroup>
                      <optgroup label={m.settings_radial_group_cheatsheets()}>
                        <option value="cheatsheet">{m.settings_radial_action_cheatsheet_global()}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={`cheatsheet:${c.id}`}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {isSavedRegex && slice.action.kind === 'appmacro' && (
                      <select
                        value={slice.action.presetId ?? ''}
                        onChange={(e) => {
                          const presetId = e.target.value || undefined
                          const action: RadialAction = { kind: 'appmacro', action: 'useSavedRegex', presetId }
                          patchSlice(i, { action, label: labelForAction(action) })
                        }}
                        className="text-[11px] flex-1 min-w-0 rounded h-[34px] box-border"
                        style={{ padding: '4px 24px 4px 8px' }}
                      >
                        <option value="">
                          {presetOptions.length === 0
                            ? m.settings_mac_no_saved_regexes()
                            : m.settings_mac_select_saved_regex()}
                        </option>
                        {presetOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <RemoveButton onClick={() => writeSlices(slices.filter((_, j) => j !== i))} />
                  </div>
                  {chat && (
                    <div className="flex gap-[10px] items-center min-w-0">
                      <CommandInput
                        value={chat.command}
                        onChange={(command) => {
                          const action: RadialAction = { ...chat, command }
                          patchSlice(i, { action, label: labelForAction(action) })
                        }}
                      />
                      <div
                        onClick={() => patchSlice(i, { action: { ...chat, autoSubmit: !chat.autoSubmit } })}
                        className="flex items-center gap-[10px] cursor-pointer select-none shrink-0"
                      >
                        <Toggle
                          checked={chat.autoSubmit}
                          onChange={(autoSubmit) => patchSlice(i, { action: { ...chat, autoSubmit } })}
                        />
                        <span className="text-[11px] text-text-dim">{m.settings_mac_submit_auto()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </ReactSortable>
          <div className="flex items-center gap-2">
            <button
              onClick={addSlice}
              disabled={slices.length >= RADIAL_MAX_SLICES}
              className="text-[11px] text-text-dim px-3 py-1.5 disabled:opacity-40 disabled:cursor-default"
            >
              {m.settings_radial_add_slice()}
            </button>
            <button onClick={() => writeSlices(seed())} className="text-[11px] text-text-dim px-3 py-1.5">
              {m.settings_radial_reset_seed()}
            </button>
            <span className="text-[10px] text-text-dim ml-auto">{m.settings_radial_max_slices()}</span>
          </div>
        </>
      )}
    </div>
  )
}
