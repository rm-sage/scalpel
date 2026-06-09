import { existsSync, rmSync } from 'node:fs'
import { removeInstalledId } from './installed-list'
import { PLUGIN_ID_PATTERN } from './manifest-validator'
import { pluginDir } from './paths'
import { clearCache } from './storage'
import { removeUnpackedId } from './unpacked-list'

export type UninstallResult = { ok: true } | { ok: false; error: string }

export function uninstallPlugin(pluginId: string): UninstallResult {
  if (!PLUGIN_ID_PATTERN.test(pluginId)) {
    return { ok: false, error: 'invalid plugin id' }
  }

  // Remove the plugin directory if it exists.
  const dir = pluginDir(pluginId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }

  // Update installed.json and unpacked.json.
  removeInstalledId(pluginId)
  removeUnpackedId(pluginId)
  clearCache(pluginId)

  return { ok: true }
}
