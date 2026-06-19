// Single source for the "host-fetched list, else bundled fallback" rule -
// shared by the settings UI and the plugin getLeagues accessor.
import { getGameFeatures } from '@shared/game-features'

export function resolveLeagueOptions(
  settings: { leaguesPoe1?: string[]; leaguesPoe2?: string[] } | null | undefined,
  version: 1 | 2,
): readonly string[] {
  const cached = version === 2 ? settings?.leaguesPoe2 : settings?.leaguesPoe1
  return cached && cached.length > 0 ? cached : getGameFeatures(version).leagues
}
