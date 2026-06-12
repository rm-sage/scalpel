/** Bump whenever the PremiumModsData shape changes, so older clients
 *  refuse remote data shaped for a newer build. Must equal the value the
 *  build script writes into premium-mods-manifest.json. */
export const PREMIUM_MODS_SCHEMA_VERSION = 2

export type OverrideMode = 'stat_list' | 'all_explicits' | 'none'

export interface OverrideModSpec {
  /** Resolved trade stat id (base id, no |option suffix). Text-only entries are not valid in v2. */
  id: string
  /** Display text, documentation only - matching is by id. */
  text?: string
  /** 'lower' = prefill a MAX bound (lower roll is better); default 'higher'. */
  direction?: 'higher' | 'lower'
  /** 'secondary' = row shown but off by default; default 'primary' (on, premium). */
  tier?: 'primary' | 'secondary'
  /** Fraction of the actual roll used for the bound; defaults to the session percent (0.9). */
  prefill?: number
  note?: string
}

export interface UniqueOverride {
  mode: OverrideMode
  /** Key is a name prefix matching a family ("Time-Lost", "Circle of"). */
  familyMatch?: boolean
  /** Only meaningful for mode 'stat_list'. */
  mods?: OverrideModSpec[]
  nonStatFilters?: string[]
  defaultFilters?: { corrupted?: boolean }
  confidence: 'verified' | 'carry_over' | 'speculative'
  note?: string
}

/** Legacy v1 shorthand (array of stat texts/ids = default-ON premium list) stays valid. */
export type UniqueOverrideEntry = string[] | UniqueOverride

export interface ItemClassRule {
  game: 'poe1' | 'poe2'
  itemClass: string
  rarity?: string
  mode: 'all_explicits'
  /** Stat ids whose rolls are drawbacks: prefill MAX instead of MIN (sign-aware). */
  lowerIsBetter?: string[]
  nonStatFilters?: string[]
  note?: string
}

export interface FactionRule {
  game: 'poe1' | 'poe2'
  tag: string
  /** Exact unique names the tag applies to (authoritative list lives here). */
  uniques: string[]
  defaultFilters: { corrupted?: boolean }
  note?: string
}

/** Per-game, per-unique override entries keyed by unique item name.
 *  v1 entries (string[]) remain valid alongside v2 UniqueOverride objects. */
export interface PremiumModsData {
  schemaVersion: number
  poe1: Record<string, UniqueOverrideEntry>
  poe2: Record<string, UniqueOverrideEntry>
  itemClassRules?: ItemClassRule[]
  factionRules?: FactionRule[]
}
