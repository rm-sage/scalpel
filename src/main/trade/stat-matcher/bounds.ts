/**
 * Compute the trade-query min/max bounds for a single rolled stat value, aware of
 * negative / beneficial-negative semantics. Shared by processExplicits and
 * buildTabletFilters so the two paths can't drift.
 *
 *  - value == null            -> no bounds (presence-only stat)
 *  - beneficial negative       -> MAX bound at the exact roll (more negative = better,
 *                                 e.g. "reduced Mana Cost" / "costs reduced Tribute")
 *  - fixed value               -> exact MIN (corruption-overrolled / single-value mods)
 *  - ordinary negative         -> widened MIN (ceil(value*(2-pct)); -30 at 90% -> -33)
 *  - positive                  -> percent MIN (floor(value*pct))
 */
export function computeValueBounds(args: {
  value: number | null
  pct: number
  isBeneficialNegative: boolean
  isFixedValue?: boolean
}): { min: number | null; max: number | null } {
  const { value, pct, isBeneficialNegative, isFixedValue = false } = args
  if (value == null) return { min: null, max: null }
  const isNegative = value < 0
  if (isNegative && isBeneficialNegative) return { min: null, max: value }
  if (isFixedValue) return { min: value, max: null }
  const min = isNegative ? Math.ceil(value * (2 - pct)) : Math.floor(value * pct)
  return { min, max: null }
}
