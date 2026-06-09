/** Condition types that emit a comparison operator when serialized. The filter
 *  format accepts a bare `=` default for boolean / list conditions (`Class "Foo"`)
 *  but numeric conditions always need the operator written out (`ItemLevel >= 84`).
 *  Parser preserves the authored operator on `FilterCondition.explicitOperator` so
 *  this set only matters when the editor fabricates a condition from scratch and
 *  there's no authored form to preserve.
 *
 *  Single source of truth shared by both serializers (`writer.ts` for full rewrites,
 *  `merge.ts` for in-place edits). Keep the two call sites importing from here --
 *  forking the list silently causes editor-authored numeric conditions to round-trip
 *  without an operator. */
export const NUMERIC_CONDITION_TYPES = new Set<string>([
  'ItemLevel',
  'AreaLevel',
  'DropLevel',
  'Quality',
  'Sockets',
  'LinkedSockets',
  'GemLevel',
  'StackSize',
  'WaystoneTier',
  'UnidentifiedItemTier',
  'MemoryStrands',
  'BaseArmour',
  'BaseEvasion',
  'BaseEnergyShield',
  'BaseWard',
])

/** Multi-value "list" conditions that require at least one value to be valid. An
 *  empty value list on one of these (e.g. a dangling `BaseType ==`) is genuine
 *  corruption - the only kind the old buggy writers could leave behind. Used to
 *  scope damage detection / validation so a legitimately value-less line (a bare
 *  boolean like `Corrupted`, or an unknown future keyword the parser models as a
 *  condition) is never mistaken for damage and stripped. */
export const VALUE_LIST_CONDITION_TYPES = new Set<string>([
  'BaseType',
  'Class',
  'Rarity',
  'HasExplicitMod',
  'HasImplicitMod',
  'HasInfluence',
  'HasEnchantment',
  'EnchantmentPassiveNode',
  'ArchnemesisMod',
  'Prophecy',
])

/** True when a condition is a value-list type whose value list is empty - i.e.
 *  genuine "dangling condition" corruption. */
export function isEmptyValueListCondition(type: string, valueCount: number): boolean {
  return valueCount === 0 && VALUE_LIST_CONDITION_TYPES.has(type)
}
