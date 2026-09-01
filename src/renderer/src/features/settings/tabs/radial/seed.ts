import type { AppSettings } from '@shared/types'
import type { CheatSheetsSettings } from '@shared/contracts/overlay'
import { RADIAL_MACRO_ACTION, RADIAL_MAX_SLICES, type RadialAction, type RadialSlice } from '@shared/contracts/radial'
import { defaultSliceIcon } from '@renderer/shared/radial-icons'
import { APP_MACRO_DEFS } from '../utils'

/** Client-side slice id. Only has to be unique within one ring, so the same
 *  shape as generateClientCategoryId. Exported for the settings UI's add-slice. */
export function newSliceId(): string {
  return `rs-${Math.random().toString(36).slice(2, 10)}`
}

function makeSlice(action: RadialAction, label: string): RadialSlice {
  return { id: newSliceId(), icon: defaultSliceIcon(action), label, action }
}

/** Seed the ring from whatever is currently bound, in priority order:
 *  filter, price check, app macros, chat commands, cheat sheets. Capped at
 *  RADIAL_MAX_SLICES. English labels, matching APP_MACRO_DEFS convention. */
export function buildDefaultSlices(input: {
  hotkey: string
  priceCheckHotkey: string
  appMacros: AppSettings['appMacros']
  chatCommands: AppSettings['chatCommands']
  cheatSheets?: CheatSheetsSettings
  pluginName?: (action: string) => string
}): RadialSlice[] {
  const out: RadialSlice[] = []
  if (input.hotkey) out.push(makeSlice({ kind: 'filter' }, 'Filter Check'))
  if (input.priceCheckHotkey) out.push(makeSlice({ kind: 'pricecheck' }, 'Price Check'))
  for (const macro of input.appMacros ?? []) {
    if (!macro.hotkey || macro.action === RADIAL_MACRO_ACTION) continue
    const label =
      APP_MACRO_DEFS.find((d) => d.id === macro.action)?.label ?? input.pluginName?.(macro.action) ?? macro.action
    out.push(makeSlice({ kind: 'appmacro', action: macro.action, presetId: macro.presetId }, label))
  }
  for (const cmd of input.chatCommands ?? []) {
    if (!cmd.hotkey || !cmd.command) continue
    out.push(makeSlice({ kind: 'chat', command: cmd.command, autoSubmit: cmd.autoSubmit !== false }, cmd.command))
  }
  if (input.cheatSheets?.globalHotkey) out.push(makeSlice({ kind: 'cheatsheet' }, 'Cheat Sheets'))
  for (const cat of input.cheatSheets?.categories ?? []) {
    if (!cat.hotkey) continue
    out.push(makeSlice({ kind: 'cheatsheet', categoryId: cat.id }, cat.name))
  }
  return out.slice(0, RADIAL_MAX_SLICES)
}
