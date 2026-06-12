import { useEffect, useRef } from 'react'
import { useActivatePlugin } from '../plugins/use-activate-plugin'

export function App({ pluginId }: { pluginId: string }): JSX.Element {
  const { captured, error } = useActivatePlugin(pluginId)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | void>(undefined)

  // Mount the captured render into the body once both exist.
  useEffect(() => {
    if (!captured || !bodyRef.current) return
    cleanupRef.current = captured.render(bodyRef.current)
    return () => {
      if (typeof cleanupRef.current === 'function') cleanupRef.current()
      cleanupRef.current = undefined
    }
  }, [captured])

  return error ? (
    <div className="p-3 text-[12px] text-text-dim" style={{ pointerEvents: 'none' }}>
      Plugin error: {error}
    </div>
  ) : (
    // Full game-window-sized, transparent. The plugin owns absolute positioning
    // inside. pointer-events:none keeps the surface click-through at the DOM
    // level (the window is also OS-level click-through); a plugin that wants an
    // interactive element re-enables pointer-events on that element.
    <div ref={bodyRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
  )
}
