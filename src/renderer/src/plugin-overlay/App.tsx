import { useEffect, useRef, useState } from 'react'
import type { PluginActivate, RegisterOverlayOptions, ScalpelPluginContext } from '../../../plugin-sdk/src/types'
import type { PoeItem, Zone } from '../../../shared/types'
import { Chrome } from '../secondary-overlay/Chrome'
import { importPluginModule } from '../plugins/import-plugin-module'

interface Captured {
  opts: RegisterOverlayOptions
  render: (container: HTMLElement) => (() => void) | void
}

export function App({ pluginId }: { pluginId: string }): JSX.Element {
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | void>(undefined)

  // Import + activate the plugin module once, in THIS window's process.
  useEffect(() => {
    let cancelled = false
    let latestItem: PoeItem | null = null
    let latestZone: Zone | null = null
    const unsubItem = window.api.onOverlayData((d) => {
      latestItem = d.item
    })
    const unsubZone = window.api.onZoneChanged((z) => {
      latestZone = z
    })
    void (async () => {
      const entry = await window.api.getInstalledPlugin(pluginId)
      if (cancelled || !entry) return
      const state = await window.api.getOverlayState().catch(() => null)
      const poeVersion: 1 | 2 = (state?.poeVersion as 1 | 2) ?? 1
      const settings = await window.api.getSettings().catch(() => null)
      let league = settings?.activeProfile?.league ?? ''
      const mod = (await importPluginModule(entry.entryUrl)) as { default?: PluginActivate }
      if (cancelled || typeof mod.default !== 'function') return
      const capHolder: { value: Captured | null } = { value: null }
      const ctx: ScalpelPluginContext = {
        pluginId,
        pluginVersion: entry.manifest.version,
        getPoeVersion: () => poeVersion,
        getLeague: () => league,
        getCurrentItem: () => latestItem,
        getCurrentZone: () => latestZone,
        onCurrentItem: (h) => window.api.onOverlayData((d) => h(d.item)),
        onCurrentZone: (h) =>
          window.api.onZoneChanged((z) => {
            if (z !== null) h(z)
          }),
        onLeagueChange: (h) =>
          window.api.onLeagueUpdated((l) => {
            league = l
            h(l)
          }),
        onLogLine: (h) => window.api.onLogLine(h),
        getRecentLogLines: (count) => window.api.getRecentLogLines(count),
        // Inert here: the tab + action hotkey are owned by the main overlay,
        // which already ran activate. Only the overlay render is used.
        registerTab: () => {},
        registerHotkey: () => {},
        registerOverlay: (opts, render) => {
          capHolder.value = { opts, render }
        },
        openOverlay: () => {
          void window.api.pluginOpenOverlay(pluginId)
        },
        closeOverlay: () => {
          void window.api.pluginCloseOverlay(pluginId)
        },
        openTab: () => {},
        copyAndEvaluateItem: () => window.api.pluginTriggerMainHotkey(),
        fetch: window.fetch.bind(window),
        storage: {
          get: <T = unknown>(key: string): Promise<T | null> =>
            window.api.pluginStorageGet(pluginId, key) as Promise<T | null>,
          set: <T = unknown>(key: string, value: T): Promise<void> => window.api.pluginStorageSet(pluginId, key, value),
          delete: (key: string): Promise<void> => window.api.pluginStorageDelete(pluginId, key),
          keys: (): Promise<string[]> => window.api.pluginStorageKeys(pluginId),
        },
        gameConfig: {
          read: () => window.api.gameConfigRead(),
          write: (content: string) => window.api.gameConfigWrite(content),
          onChange: (handler: () => void) => window.api.onGameConfigChange(handler),
        },
        prices: {
          getPrices: (opts) => window.api.pricesGet(opts),
          refresh: () => window.api.pricesRefresh(),
          onChange: (handler) => window.api.onPricesChange(handler),
        },
        openExternal: (url) => window.api.openExternal(url),
        log: (...args: unknown[]) => {
          if (window.__SCALPEL_DEBUG_LOG) {
            // biome-ignore lint/suspicious/noConsole: gated behind debug logging
            console.log(`[plugin:${pluginId}]`, ...args)
          }
        },
      }
      // Note: subscriptions a plugin opens via ctx (onLogLine/onCurrentItem/...)
      // are the plugin's to manage per the SDK contract. This window is
      // persistent (hidden, not destroyed, on close), so they correctly survive
      // show/hide. We do not collect them here.
      try {
        await mod.default(ctx)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
        return
      }
      const cap = capHolder.value
      if (cancelled || !cap) return
      setCaptured(cap)
    })()
    return () => {
      cancelled = true
      unsubItem()
      unsubZone()
    }
  }, [pluginId])

  // Mount the captured render into the body once both exist.
  useEffect(() => {
    if (!captured || !bodyRef.current) return
    cleanupRef.current = captured.render(bodyRef.current)
    return () => {
      if (typeof cleanupRef.current === 'function') cleanupRef.current()
      cleanupRef.current = undefined
    }
  }, [captured])

  return (
    <Chrome
      headerContent={<span className="text-text text-sm font-medium">{captured?.opts.title ?? ''}</span>}
      onClose={() => {
        void window.api.pluginCloseOverlay(pluginId)
      }}
    >
      {error ? (
        <div className="p-3 text-[12px] text-text-dim">Plugin error: {error}</div>
      ) : (
        <div ref={bodyRef} className="flex-1 overflow-auto" />
      )}
    </Chrome>
  )
}
