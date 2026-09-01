import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RADIAL_PLUGIN_ICON } from '@shared/contracts/radial'
import { RADIAL_ICON_NAMES, radialIcon } from '@renderer/shared/radial-icons'
import { PluginIconBadge } from '@renderer/shared/PluginTabIcon'
import { IP } from '@renderer/shared/constants'
import { m } from '@shared/paraglide/messages.js'

const PANEL_WIDTH = 248
/** Search input + gap + the grid's max-h + padding/border. Only used for the
 *  viewport clamp, so an approximation is fine. */
const PANEL_MAX_HEIGHT = 268
const PANEL_MARGIN = 8

/** Icon field for a radial slice: a button showing the slice's current icon that
 *  opens a searchable grid of the curated radial icon set.
 *
 *  The panel is portalled to <body> and tagged `data-context-menu` deliberately.
 *  The settings body scrolls (`overflow-y-auto`), so an in-flow popover would be
 *  clipped; and in the in-game overlay click-interactivity is rect-based - only
 *  the panel wrapper plus portalled `[data-context-menu]` rects are reported to
 *  the main process (see overlay/App.tsx), so an untagged popover's clicks fall
 *  through to the game. Same hook PresetColorPicker uses. */
export function IconPicker({
  value,
  onChange,
  pluginIcon,
}: {
  value: string
  onChange: (name: string) => void
  /** The plugin's own registered tab icon, when this slice runs a plugin action.
   *  Its presence is what adds the leading "plugin icon" choice - a non-plugin
   *  slice never sees one, because there is nothing for it to mean. */
  pluginIcon?: string
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // The panel is position:fixed off a rect captured at open time, so it would
    // detach from its trigger once the settings body scrolls or the window
    // resizes. Closing is cheaper and less surprising than re-anchoring.
    const onResize = (): void => setOpen(false)
    // Scroll doesn't bubble, so this listener is capture-phase to see the
    // settings body scroll - which also means it sees the icon grid's own scroll
    // (max-h-[220px] over ~18 rows). Exempt anything originating inside the
    // panel or wheeling the icon list would close the picker mid-use.
    const onScroll = (e: Event): void => {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const showingPluginIcon = value === RADIAL_PLUGIN_ICON && !!pluginIcon
  // The sentinel is not a glyph name; keep it away from radialIcon, which would
  // answer with its unrelated fallback.
  const Current = radialIcon(value === RADIAL_PLUGIN_ICON ? 'Components' : value)

  /** The plugin's art in the round token the ring draws it in, so the choice in
   *  the grid and the thing on screen are visibly the same object. */
  const badge = (size: number): JSX.Element => <PluginIconBadge icon={pluginIcon ?? ''} size={size} />
  const needle = query.trim().toLowerCase()
  const names = needle ? RADIAL_ICON_NAMES.filter((n) => n.toLowerCase().includes(needle)) : RADIAL_ICON_NAMES
  // Read on the render that flips `open` to true - the trigger is already mounted
  // by then, so its rect is available for the fixed-position panel. Clamped to
  // the viewport: a row near the bottom edge would otherwise push the ~260px
  // panel off-screen, and the overlay reports its rect to the game as-is.
  const rect = triggerRef.current?.getBoundingClientRect()
  const panelPos = ((): { left: number; top: number } => {
    if (!rect) return { left: 0, top: 0 }
    const left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN))
    const below = rect.bottom + 4
    // Flip above the trigger when it doesn't fit below, then clamp.
    const top = below + PANEL_MAX_HEIGHT > window.innerHeight ? rect.top - PANEL_MAX_HEIGHT - 4 : below
    return { left, top: Math.max(PANEL_MARGIN, Math.min(top, window.innerHeight - PANEL_MAX_HEIGHT - PANEL_MARGIN)) }
  })()

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => {
          setQuery('')
          setOpen((v) => !v)
        }}
        title={showingPluginIcon ? m.settings_radial_plugin_icon() : value}
        className="setting-box shrink-0 cursor-pointer w-[34px] h-[34px] box-border flex items-center justify-center p-0"
      >
        {showingPluginIcon ? badge(22) : <Current size={16} {...IP} />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-context-menu=""
            className="fixed z-[9999] bg-bg-card border border-border rounded-md p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex flex-col gap-1.5"
            style={{ left: panelPos.left, top: panelPos.top, width: PANEL_WIDTH }}
          >
            <input
              type="text"
              autoFocus
              value={query}
              placeholder={m.settings_radial_icon_search()}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-[11px] h-[26px] box-border px-2 bg-black/30"
            />
            <div className="grid grid-cols-8 gap-1 max-h-[220px] overflow-y-auto">
              {/* Leading, and only for plugin slices: the plugin's own art is
                  the default for them, so it belongs where the eye lands first
                  rather than buried after 200 glyphs. Not filtered by the search
                  box - it is not one of the named icons, and hiding the default
                  behind a query nobody would guess would strand anyone who
                  picked a glyph and wanted to go back. */}
              {pluginIcon && (
                <button
                  data-testid="icon-picker-plugin"
                  title={m.settings_radial_plugin_icon()}
                  onClick={() => {
                    onChange(RADIAL_PLUGIN_ICON)
                    setOpen(false)
                  }}
                  className={`flex items-center justify-center w-[26px] h-[26px] rounded border-none cursor-pointer p-0 hover:bg-white/10 ${
                    value === RADIAL_PLUGIN_ICON ? 'bg-accent/25' : 'bg-transparent'
                  }`}
                >
                  {badge(20)}
                </button>
              )}
              {names.map((name) => {
                const Icon = radialIcon(name)
                return (
                  <button
                    key={name}
                    title={name}
                    onClick={() => {
                      onChange(name)
                      setOpen(false)
                    }}
                    className={`flex items-center justify-center w-[26px] h-[26px] rounded border-none cursor-pointer p-0 hover:bg-white/10 ${
                      name === value ? 'bg-accent/25 text-accent' : 'bg-transparent text-text-dim'
                    }`}
                  >
                    <Icon size={16} {...IP} />
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
