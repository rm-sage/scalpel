import { useEffect, useRef } from 'react'
import { Chrome } from '../secondary-overlay/Chrome'
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
