/** In-process registry of plugin-registered title-bar tabs. Mirrors
 *  hotkey-registry.ts: lives in its own module so handlers/plugins.ts and any
 *  future consumer both depend on this, not on each other. Value carries the
 *  label and icon (SVG markup or data URL) the Settings > View toggle renders. */
const registeredPluginTabs = new Map<string, { label: string; icon: string }>()

export function setPluginTab(pluginId: string, label: string, icon: string): void {
  registeredPluginTabs.set(pluginId, { label, icon })
}

export function getRegisteredPluginTabs(): ReadonlyMap<string, { label: string; icon: string }> {
  return registeredPluginTabs
}

export function removePluginTab(pluginId: string): void {
  registeredPluginTabs.delete(pluginId)
}

/** Test-only: clear all in-memory registrations. */
export function _resetForTests(): void {
  registeredPluginTabs.clear()
}
