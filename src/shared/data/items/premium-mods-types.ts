/** Bump whenever the PremiumModsData shape changes, so older clients
 *  refuse remote data shaped for a newer build. Must equal the value the
 *  build script writes into premium-mods-manifest.json. */
export const PREMIUM_MODS_SCHEMA_VERSION = 1

/** Per-game, per-unique list of canonical stat texts that default ON in the
 *  price check, regardless of tier/low-priority rules. Key = unique item name;
 *  value = array of canonical stat texts in `#`-placeholder form. */
export interface PremiumModsData {
  schemaVersion: number
  poe1: Record<string, string[]>
  poe2: Record<string, string[]>
}
