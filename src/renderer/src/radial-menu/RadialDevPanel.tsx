import { useCallback, useEffect, useState } from 'react'
import type { RadialBackdrop, RadialBackdropFailure } from '@shared/contracts/radial'
import {
  applyTuning,
  type BackdropTuning,
  DEFAULT_TUNING,
  loadTuning,
  type RadialGeometry,
  RING_MAX,
  saveTuning,
  TUNING_RANGES,
  TUNING_STORAGE_KEY,
} from './backdrop-style'

/** Developer-only tuning panel for the blurred game backdrop, drawn inside the
 *  radial overlay so the dial happens against the real game rather than against
 *  a story's stand-in art. Gated on `payload.dev`, which main sets from the
 *  developerMode setting - normal users never see it.
 *
 *  Three jobs now. It tunes the composite (blur / grade / tint / opacity,
 *  straight onto the root's custom properties); it sizes the ring itself (the
 *  centre bubble and the icon ring, which unlike the grade have to travel back
 *  up as React state - they drive the hit test, not just paint); and it tells
 *  you whether there is anything to composite at all: Raw view strips the whole
 *  treatment, and the meta line reports the capture's decoded size against the
 *  crop rectangle main said it took. A flat grey disc is either a bad grab or an
 *  over-aggressive grade, and those two readouts separate them at a glance.
 *
 *  English only, on purpose: it is a developer instrument and translating it
 *  would put three locale files in the way of every tweak. */
export interface RadialDevPanelProps {
  backdrop?: RadialBackdrop | null
  /** Which gate closed when the grab came back empty. `null` while the answer is
   *  still in flight, which is a different thing from a failure and has to read
   *  differently - "none" for both is what hid an intermittent capture bug. */
  failure?: RadialBackdropFailure | null
  /** Decoded pixel size of the capture, once its <img> has loaded. Null while it
   *  is still decoding - or forever, if the data URL is not a valid image. */
  naturalSize: { width: number; height: number } | null
  /** The menu root. Every tuned custom property lands here, and the disc and the
   *  capture inherit it from there. */
  rootRef: React.RefObject<HTMLDivElement | null>
  holdOpen: boolean
  onToggleHold: () => void
  /** Called while the pointer is over the panel, so no slice stays lit (and
   *  goo-pucked) underneath a panel the user is actually working in. */
  onHoverPanel: () => void
  /** Pushed up on every tuning change, not just geometry ones - the view bails
   *  out of the render when the pair has not moved, so this stays cheap and the
   *  panel does not have to know which knob the user touched. */
  onGeometryChange: (g: RadialGeometry) => void
}

interface SliderProps {
  label: string
  testId: string
  value: number
  range: readonly [number, number]
  unit: string
  onChange: (v: number) => void
}

function Slider({ label, testId, value, range, unit, onChange }: SliderProps): JSX.Element {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-[46px] shrink-0 text-text-dim">{label}</span>
      <input
        type="range"
        data-testid={testId}
        min={range[0]}
        max={range[1]}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="w-[38px] shrink-0 text-right font-mono tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  )
}

function Toggle({ on, label, testId, onClick }: { on: boolean; label: string; testId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-on={on}
      onClick={onClick}
      className={`rounded border px-1.5 py-[3px] text-[10px] leading-none ${
        on ? 'border-accent bg-accent text-bg-solid' : 'border-border bg-bg-solid text-text-dim'
      }`}
    >
      {label}
    </button>
  )
}

export function RadialDevPanel({
  backdrop,
  failure,
  naturalSize,
  rootRef,
  holdOpen,
  onToggleHold,
  onHoverPanel,
  onGeometryChange,
}: RadialDevPanelProps): JSX.Element {
  // Lazy initialiser, so a relaunch mid-session comes back on the numbers the
  // last one ended on rather than resetting the dial every open. The view reads
  // the same blob for its own geometry state, so the two agree on this render
  // and this stays the only thing that ever writes it.
  const [tuning, setTuning] = useState<BackdropTuning>(loadTuning)

  useEffect(() => {
    const el = rootRef.current
    if (el) applyTuning(el, tuning)
    saveTuning(tuning)
    onGeometryChange({ bubble: tuning.bubble, ring: tuning.ring, liquid: tuning.liquid })
  }, [tuning, rootRef, onGeometryChange])

  const set = useCallback(<K extends keyof BackdropTuning>(key: K, value: BackdropTuning[K]): void => {
    setTuning((t) => ({ ...t, [key]: value }))
  }, [])

  const reset = useCallback((): void => {
    try {
      window.localStorage.removeItem(TUNING_STORAGE_KEY)
    } catch {
      // Best-effort; the effect below writes the defaults back anyway.
    }
    setTuning(DEFAULT_TUNING)
  }, [])

  return (
    // Every pointer event stops here. The menu root's pointermove picks slices
    // and its click fires or cancels, so without this a slider drag would sweep
    // the ring and letting go would launch whatever was under the cursor.
    <div
      data-testid="radial-dev-panel"
      className="fixed right-3 top-3 z-50 w-[250px] rounded border border-border bg-bg-card p-2 text-[11px] leading-none text-text shadow-lg"
      // The menu root hides the OS cursor (the blob is the pointer); sliders
      // are unusable blind, so the panel brings it back over itself.
      style={{ cursor: 'default' }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => {
        e.stopPropagation()
        onHoverPanel()
      }}
      onPointerEnter={onHoverPanel}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-semibold">Radial tuning</span>
        <button
          type="button"
          data-testid="radial-dev-reset"
          onClick={reset}
          className="rounded border border-border bg-bg-solid px-1.5 py-[3px] text-[10px] leading-none text-text-dim"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Slider
          label="blur"
          testId="radial-slider-blur"
          value={tuning.blur}
          range={TUNING_RANGES.blur}
          unit="px"
          onChange={(v) => set('blur', v)}
        />
        <Slider
          label="bright"
          testId="radial-slider-brightness"
          value={tuning.brightness}
          range={TUNING_RANGES.brightness}
          unit="%"
          onChange={(v) => set('brightness', v)}
        />
        <Slider
          label="sat"
          testId="radial-slider-saturate"
          value={tuning.saturate}
          range={TUNING_RANGES.saturate}
          unit="%"
          onChange={(v) => set('saturate', v)}
        />
        <Slider
          label="tint"
          testId="radial-slider-tint"
          value={tuning.tint}
          range={TUNING_RANGES.tint}
          unit="%"
          onChange={(v) => set('tint', v)}
        />
        <Slider
          label="img op"
          testId="radial-slider-opacity"
          value={tuning.opacity}
          range={TUNING_RANGES.opacity}
          unit="%"
          onChange={(v) => set('opacity', v)}
        />
        {/* Every slider above is now a CENTRE value; this is where they start
            giving way to the untouched game. */}
        <Slider
          label="edge"
          testId="radial-slider-falloff"
          value={tuning.falloff}
          range={TUNING_RANGES.falloff}
          unit="%"
          onChange={(v) => set('falloff', v)}
        />
      </div>

      {/* The ring itself, kept below a rule because it is a different kind of
          knob: the two lengths are its actual radii at scale 1, so the user's
          size setting still multiplies them and everything downstream (deadzone,
          icon ring, goo reach, disc, edge clamp) moves with them. */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
        <Slider
          label="bubble"
          testId="radial-slider-bubble"
          value={tuning.bubble}
          range={TUNING_RANGES.bubble}
          unit="px"
          onChange={(v) => set('bubble', v)}
        />
        <Slider
          label="ring"
          testId="radial-slider-ring"
          value={tuning.ring}
          range={TUNING_RANGES.ring}
          unit="px"
          onChange={(v) => set('ring', v)}
        />
        {/* The bubble and the puck are one filtered group, so they share one
            opacity - splitting them would break the fused-liquid read. */}
        <Slider
          label="goo"
          testId="radial-slider-goo"
          value={tuning.goo}
          range={TUNING_RANGES.goo}
          unit="%"
          onChange={(v) => set('goo', v)}
        />
        {/* One multiplier over every liquid amplitude at once: the bubble's lean
            toward the cursor, the squash-and-stretch on both blobs, the arrival
            wobble and the idle breathing. At 0 the ring is exactly as rigid as
            it was before any of them existed. */}
        <Slider
          label="liquid"
          testId="radial-slider-liquid"
          value={tuning.liquid}
          range={TUNING_RANGES.liquid}
          unit="%"
          onChange={(v) => set('liquid', v)}
        />
        {/* The cap has a reason and it is not obvious from the slider, so it
            says so - see RING_MAX. */}
        <div className="font-mono text-[10px] leading-[1.4] text-text-dim">
          ring caps at {RING_MAX}: past that the disc outgrows the backdrop crop
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Toggle on={tuning.raw} label="Raw view" testId="radial-raw-toggle" onClick={() => set('raw', !tuning.raw)} />
        <Toggle on={holdOpen} label="Hold open" testId="radial-hold-toggle" onClick={onToggleHold} />
      </div>

      {/* Compact enough to read straight back into a chat log - which is the
          point, since the whole panel exists to be reported from in game. */}
      <div
        data-testid="radial-dev-values"
        className="mt-2 border-t border-border pt-1.5 font-mono text-[10px] leading-[1.4] text-text-dim"
      >
        {/* Two lines rather than one wrapped one: at this width the single line
            broke mid-number, which is the one thing a readout you retype into a
            chat log must not do. */}
        <div>
          blur {tuning.blur} · bri {tuning.brightness} · sat {tuning.saturate}
        </div>
        <div>
          tint {tuning.tint} · op {tuning.opacity} · edge {tuning.falloff}
          {tuning.raw ? ' · RAW' : ''}
        </div>
        <div>
          bubble {tuning.bubble} · ring {tuning.ring}
        </div>
        <div>
          goo {tuning.goo} · liquid {tuning.liquid}
        </div>
        {/* The misalignment / black-capture / starved-resolution readout. `img`
            is what actually decoded and how many of its px land on each CSS px
            of the disc - the crop is stretched onto the `css` rectangle, so
            anything under 1.0 there is detail the disc cannot show, and it was
            0.34 before the encode ceiling was raised. `css` is the rectangle
            main says it cut and where it put it, so an origin nowhere near the
            cursor is a misaligned crop rather than a bad grade. */}
        <div data-testid="radial-dev-capture">
          {backdrop
            ? `img ${naturalSize ? `${naturalSize.width}x${naturalSize.height}` : 'decoding'}${
                naturalSize && backdrop.width > 0 ? ` @ ${(naturalSize.width / backdrop.width).toFixed(2)} px/css` : ''
              }`
            : // Three states, not two. `failure` names the gate that closed;
              // its absence means main has not answered yet, which during the
              // focus-flicker bug was indistinguishable from a real refusal.
              `capture: ${failure ? `none (${failure})` : 'waiting'}`}
        </div>
        {backdrop && (
          <div>
            css {Math.round(backdrop.width)}x{Math.round(backdrop.height)} @ {Math.round(backdrop.origin.x)},
            {Math.round(backdrop.origin.y)}
          </div>
        )}
      </div>
    </div>
  )
}
