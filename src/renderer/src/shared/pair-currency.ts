/** The two "measuring stick" currencies per game: players price everything in
 *  Divine + Exalted (PoE2) or Divine + Chaos (PoE1), so pricing one of them in
 *  itself ("1 div", "1 ex") is a tautology. The price-check header gives them
 *  cross-denomination treatment instead:
 *    'rate'    - Divine Orb: price shown in the baseline currency, never promoted
 *    'inverse' - the baseline orb: price shown as a 1/N divine fraction
 *    null      - everything else (normal auto-promoting chip) */
export type PairCurrencyRole = 'rate' | 'inverse'

export function pairCurrencyRole(baseType: string, version: number): PairCurrencyRole | null {
  if (baseType === 'Divine Orb') return 'rate'
  if (baseType === (version === 2 ? 'Exalted Orb' : 'Chaos Orb')) return 'inverse'
  return null
}
