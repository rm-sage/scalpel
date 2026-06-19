export { getItemIcon } from '../../../plugin-sdk/src/runtime-helpers/get-item-icon'

export function formatPrice(value: number): string {
  if (value >= 1000) return `${parseFloat((value / 1000).toFixed(1))}k`
  if (value >= 10) return String(Math.round(value))
  if (value >= 1) return String(parseFloat(value.toFixed(1)))
  return String(parseFloat(value.toFixed(2)))
}

/** Promote a chaos-denominated price to divine when it clears one divine,
 *  returning the formatted display text and the currency trade-API key. Single
 *  source of truth for PriceChip, the sparkline mini-chips, and the sparkline
 *  current-price footer so they all format identically. `divineValue` (when the
 *  caller already knows the exact divine price) takes precedence over deriving
 *  it from `chaosPerDivine`; `version` selects the low-tier currency (PoE1
 *  chaos, PoE2 exalted). `noPromote` pins the result to the baseline currency,
 *  used by the pair-currency display (Divine Orb priced in ex/chaos). */
export function promoteChaos(
  chaosValue: number,
  chaosPerDivine: number | undefined,
  version: number,
  divineValue?: number | null,
  noPromote?: boolean,
): { text: string; currencyKey: string } {
  const useDivine =
    !noPromote &&
    (divineValue != null
      ? divineValue >= 1
      : chaosPerDivine != null && chaosPerDivine > 0 && chaosValue >= chaosPerDivine)
  return {
    text: useDivine
      ? formatPrice(divineValue != null && divineValue >= 1 ? divineValue : chaosValue / chaosPerDivine!)
      : formatPrice(chaosValue),
    currencyKey: useDivine ? 'divine' : version === 2 ? 'exalted' : 'chaos',
  }
}

export function formatDust(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

/** Alternating ("zebra") row background: even rows get a faint tint, odd rows
 *  are transparent. Default even tint is the common rgba(255,255,255,0.02); pass
 *  evenBg for rows that use a different tint (e.g. 0.03). */
export function zebraRowBg(index: number, evenBg = 'rgba(255,255,255,0.02)'): string {
  return index % 2 === 0 ? evenBg : 'transparent'
}

/** Strip Electron's IPC rejection wrapper ("Error invoking remote method
 *  'foo': Error: <our message>") so users see just the message we threw in
 *  the main process, not the plumbing. */
export function stripIpcErrorWrapper(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
