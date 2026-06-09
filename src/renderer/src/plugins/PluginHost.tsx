import { useCallback, useEffect, useRef, useState } from 'react'
import type { PoeItem, Zone } from '../../../shared/types'
import type { PluginActivate, PluginManifest } from '../../../plugin-sdk/src/types'
import { createPluginContext } from './context'
import { importPluginModule } from './import-plugin-module'

export interface RegisteredTab {
  pluginId: string
  label: string
  icon: string
  render: (container: HTMLElement) => (() => void) | void
  /** Present when the plugin also registered an overlay window; drives the
   *  "pop out" button in the tab content pane. */
  overlay?: { title: string; icon?: string }
}

export interface PluginHostProps {
  ready: boolean
  poeVersion: 1 | 2
  league: string
  currentItem: PoeItem | null
  currentZone: Zone | null
  onSubscribeCurrentItem: (h: (i: PoeItem) => void) => () => void
  onSubscribeCurrentZone: (h: (z: Zone) => void) => () => void
  onSubscribeLeagueChange: (h: (l: string) => void) => () => void
  onOpenExternal: (url: string) => void
  onTabsChange: (tabs: RegisteredTab[]) => void
  onOpenPluginTab: (pluginId: string) => void
  onCopyAndEvaluateItem: () => Promise<PoeItem | null>
  onPluginError?: (id: string, error: Error) => void
  onPluginUnloaded?: (pluginId: string) => void
}

export function PluginHost(props: PluginHostProps): JSX.Element | null {
  const [tabs, setTabs] = useState<RegisteredTab[]>([])
  const loadedRef = useRef(false)
  const pluginHotkeyHandlersRef = useRef<Map<string, () => void>>(new Map())
  const pendingOverlayRef = useRef<Map<string, { title: string; icon?: string }>>(new Map())
  // Latest-value refs let our captured-once subscribe callbacks return current values.
  const poeVersionRef = useRef(props.poeVersion)
  const leagueRef = useRef(props.league)
  const currentItemRef = useRef(props.currentItem)
  const currentZoneRef = useRef(props.currentZone)
  poeVersionRef.current = props.poeVersion
  leagueRef.current = props.league
  currentItemRef.current = props.currentItem
  currentZoneRef.current = props.currentZone

  // Keep stable refs to callbacks so event-handler effects don't close over stale props.
  const onPluginErrorRef = useRef(props.onPluginError)
  const onPluginUnloadedRef = useRef(props.onPluginUnloaded)
  onPluginErrorRef.current = props.onPluginError
  onPluginUnloadedRef.current = props.onPluginUnloaded

  const onSubscribeCurrentItemRef = useRef(props.onSubscribeCurrentItem)
  const onSubscribeCurrentZoneRef = useRef(props.onSubscribeCurrentZone)
  const onSubscribeLeagueChangeRef = useRef(props.onSubscribeLeagueChange)
  const onOpenExternalRef = useRef(props.onOpenExternal)
  const onOpenPluginTabRef = useRef(props.onOpenPluginTab)
  const onCopyAndEvaluateItemRef = useRef(props.onCopyAndEvaluateItem)
  onSubscribeCurrentItemRef.current = props.onSubscribeCurrentItem
  onSubscribeCurrentZoneRef.current = props.onSubscribeCurrentZone
  onSubscribeLeagueChangeRef.current = props.onSubscribeLeagueChange
  onOpenExternalRef.current = props.onOpenExternal
  onOpenPluginTabRef.current = props.onOpenPluginTab
  onCopyAndEvaluateItemRef.current = props.onCopyAndEvaluateItem

  // Push every tab list change up to the parent
  useEffect(() => {
    props.onTabsChange(tabs)
  }, [tabs, props.onTabsChange])

  // Extracted per-plugin load logic used by both the initial-load loop and the
  // hot-install event handler. Wrapped in useCallback([]) so identity is stable
  // across renders; all prop callbacks are read through refs.
  const loadPlugin = useCallback(async (entry: { manifest: PluginManifest; entryUrl: string }): Promise<void> => {
    const m = entry.manifest
    if (m.poeVersions && !m.poeVersions.includes(poeVersionRef.current)) return
    try {
      const mod = (await importPluginModule(entry.entryUrl)) as { default: PluginActivate }
      if (typeof mod.default !== 'function') {
        throw new Error('plugin module has no default export function')
      }
      const ctx = createPluginContext({
        pluginId: m.id,
        pluginVersion: m.version,
        getPoeVersion: () => poeVersionRef.current,
        getLeague: () => leagueRef.current,
        getCurrentItem: () => currentItemRef.current,
        getCurrentZone: () => currentZoneRef.current,
        subscribeCurrentItem: (h) => onSubscribeCurrentItemRef.current(h),
        subscribeCurrentZone: (h) => onSubscribeCurrentZoneRef.current(h),
        subscribeLeagueChange: (h) => onSubscribeLeagueChangeRef.current(h),
        onLogLine: (h) => window.api.onLogLine(h),
        getRecentLogLines: (count) => window.api.getRecentLogLines(count),
        openExternal: (url) => onOpenExternalRef.current(url),
        storage: {
          get: (key) => window.api.pluginStorageGet(m.id, key),
          set: (key, value) => window.api.pluginStorageSet(m.id, key, value),
          delete: (key) => window.api.pluginStorageDelete(m.id, key),
          keys: () => window.api.pluginStorageKeys(m.id),
        },
        gameConfig: {
          read: () => window.api.gameConfigRead(),
          write: (content) => window.api.gameConfigWrite(content),
          onChange: (handler) => window.api.onGameConfigChange(handler),
        },
        prices: {
          getPrices: (opts) => window.api.pricesGet(opts),
          refresh: () => window.api.pricesRefresh(),
          onChange: (handler) => window.api.onPricesChange(handler),
        },
        registerTab: (pluginId, opts) => {
          setTabs((prev) => {
            if (prev.find((t) => t.pluginId === pluginId)) return prev
            return [...prev, { pluginId, ...opts, overlay: pendingOverlayRef.current.get(pluginId) }]
          })
          // Mirror registerHotkey: report to main so any window (incl. the
          // standalone app settings) can list this tab for the Show/Hide UI.
          void window.api.pluginRegisterTab(pluginId, opts.label, opts.icon)
        },
        registerHotkey: (pluginId, opts, handler) => {
          pluginHotkeyHandlersRef.current.set(pluginId, handler)
          void window.api.pluginRegisterHotkey(pluginId, opts.label)
        },
        openTab: (pluginId) => onOpenPluginTabRef.current(pluginId),
        copyAndEvaluateItem: () => onCopyAndEvaluateItemRef.current(),
        registerOverlay: (pluginId, opts) => {
          pendingOverlayRef.current.set(pluginId, { title: opts.title, icon: opts.icon })
          setTabs((prev) =>
            prev.map((t) => (t.pluginId === pluginId ? { ...t, overlay: { title: opts.title, icon: opts.icon } } : t)),
          )
          void window.api.pluginRegisterOverlay(pluginId, {
            title: opts.title,
            hotkeyLabel: opts.hotkeyLabel,
            defaultSize: opts.defaultSize,
          })
        },
        openOverlay: (pluginId) => void window.api.pluginOpenOverlay(pluginId),
        closeOverlay: (pluginId) => void window.api.pluginCloseOverlay(pluginId),
      })
      // PluginActivate may be async; await the result so any rejection lands in catch.
      await mod.default(ctx)
    } catch (err) {
      onPluginErrorRef.current?.(m.id, err instanceof Error ? err : new Error(String(err)))
    }
  }, [])

  useEffect(() => {
    if (!props.ready || loadedRef.current) return
    loadedRef.current = true
    let cancelled = false

    void (async () => {
      const installed = await window.api.listInstalledPlugins()
      if (cancelled) return
      for (const entry of installed) {
        if (cancelled) return
        await loadPlugin(entry)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.ready])

  // Hot-install: load a newly installed plugin without restart.
  useEffect(() => {
    return window.api.onPluginInstalled(async (entry) => {
      await loadPlugin(entry)
    })
  }, [])

  // Hot-uninstall: remove an uninstalled plugin's tab and hotkey handler.
  useEffect(() => {
    return window.api.onPluginUninstalled((pluginId) => {
      setTabs((prev) => prev.filter((t) => t.pluginId !== pluginId))
      pluginHotkeyHandlersRef.current.delete(pluginId)
      pendingOverlayRef.current.delete(pluginId)
      void window.api.pluginUnregisterHotkey(pluginId)
      void window.api.pluginUnregisterTab(pluginId)
      onPluginUnloadedRef.current?.(pluginId)
    })
  }, [])

  useEffect(() => {
    return window.api.onPluginMacro((action: string) => {
      const PREFIX = 'plugin:'
      if (!action.startsWith(PREFIX)) return
      const pluginId = action.slice(PREFIX.length)
      const handler = pluginHotkeyHandlersRef.current.get(pluginId)
      if (!handler) return
      try {
        handler()
      } catch (err) {
        onPluginErrorRef.current?.(pluginId, err instanceof Error ? err : new Error(String(err)))
      }
    })
  }, [])

  return null
}
