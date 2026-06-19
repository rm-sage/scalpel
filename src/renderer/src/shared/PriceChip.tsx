import { useState } from 'react'
import { CurrencyIcon } from './CurrencyIcon'
import { usePoeVersion } from './poe-version-context'
import ninjaIcon from '../assets/other/poe-ninja.png'
import { promoteChaos } from './utils'
import { PriceTrend } from './PriceTrend'
import { SparklineOverlay } from './SparklineOverlay'
import { InfoChip } from './InfoChip'
import { formatPriceTooltip } from './currency-short-labels'
import { HoverTooltip } from './HoverTooltip'

interface PriceChipProps {
  chaosValue: number
  divineValue?: number | null
  chaosPerDivine?: number
  label?: string
  showNinja?: boolean
  size?: 'sm' | 'md'
  /** 7-day percent-change graph entries from poe.ninja. When present, renders a
   *  trend arrow and sparkline overlay on hover. */
  graph?: (number | null)[]
  /** When true, suppress the trend arrow and sparkline overlay. */
  hideTrend?: boolean
  /** Pin the chip (and its sparkline overlay) to the baseline currency - no
   *  divine promotion. Pair-currency display: Divine Orb priced in ex/chaos. */
  noPromote?: boolean
  /** Replace the formatted price text + currency icon outright (e.g. the
   *  "1/141" divine fraction for Exalted/Chaos Orb). The sparkline overlay
   *  still uses chaosValue/noPromote for its own chips and footer. */
  displayOverride?: { text: string; currencyKey: string }
}

export function PriceChip({
  chaosValue,
  divineValue,
  chaosPerDivine,
  label,
  showNinja,
  size = 'md',
  graph,
  hideTrend,
  noPromote,
  displayOverride,
}: PriceChipProps): JSX.Element {
  const version = usePoeVersion()
  // PoE1 baseline = chaos, PoE2 baseline = exa(lted). Both use "divine" for the
  // high tier. Shared with the sparkline footer so the two always agree.
  const promoted = promoteChaos(chaosValue, chaosPerDivine, version, divineValue, noPromote)
  const displayValue = displayOverride?.text ?? promoted.text
  const currencyKey = displayOverride?.currencyKey ?? promoted.currencyKey

  const showTrend = !hideTrend && graph != null && graph.length > 0
  const [hovered, setHovered] = useState(false)
  // Viewport-space cursor position + scale, used by the portaled overlay so it can
  // sit above content without being clipped by the chip's transformed ancestor.
  const [cursor, setCursor] = useState({ viewportX: 0, viewportY: 0, scale: 1 })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const unscaledWidth = el.offsetWidth
    const scale = unscaledWidth > 0 ? rect.width / unscaledWidth : 1
    setCursor({ viewportX: e.clientX, viewportY: e.clientY, scale })
  }

  const chip = (
    <InfoChip icon={showNinja ? ninjaIcon : undefined} label={label} size={size}>
      <span className="font-semibold">{displayValue}</span>
      <CurrencyIcon name={currencyKey} className="w-3 h-3" />
      {showTrend && <PriceTrend graph={graph} />}
    </InfoChip>
  )

  // When the ninja trend graph is present, the hover surface is the sparkline
  // overlay, so we skip the price tooltip. Otherwise the chip gets the snappy
  // price tooltip like every other price display.
  if (!showTrend) {
    return <HoverTooltip text={formatPriceTooltip(displayValue, currencyKey)}>{chip}</HoverTooltip>
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {chip}
      <SparklineOverlay
        graph={graph}
        visible={hovered}
        cursor={cursor}
        currentPrice={{ chaosValue, divineValue, chaosPerDivine }}
        noPromote={noPromote}
      />
    </div>
  )
}
