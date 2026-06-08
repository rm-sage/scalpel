//All external URLs that Scalpel connects to.

/** Path of Exile website (login, trade search pages) */
export const POE_WEBSITE = 'https://www.pathofexile.com'

/** Version-aware trade URLs. PoE2 uses the /trade2 path prefix for both API and
 *  browser, but only the browser URLs take a `poe2/` realm segment between
 *  search/exchange and the league -- API paths omit it. This matches Exiled
 *  Exchange 2's wiring, cross-checked against live requests from the PoE2 trade
 *  site. /fetch, /data/stats, and /data/leagues differ only in the prefix. */
export function getTradeUrls(version: 1 | 2): {
  search: (league: string) => string
  exchange: (league: string) => string
  fetch: (ids: string, queryId: string) => string
  stats: string
  leagues: string
  webSearch: (league: string, queryId: string) => string
  webExchange: (league: string, queryId: string) => string
} {
  const prefix = version === 2 ? 'trade2' : 'trade'
  const webRealm = version === 2 ? 'poe2/' : ''
  const apiBase = `${POE_WEBSITE}/api/${prefix}`
  const webBase = `${POE_WEBSITE}/${prefix}`
  const enc = encodeURIComponent
  return {
    search: (l) => `${apiBase}/search/${enc(l)}`,
    exchange: (l) => `${apiBase}/exchange/${enc(l)}`,
    fetch: (ids, qid) => `${apiBase}/fetch/${ids}?query=${qid}`,
    stats: `${apiBase}/data/stats`,
    leagues: `${apiBase}/data/leagues`,
    webSearch: (l, id) => `${webBase}/search/${webRealm}${enc(l)}/${id}`,
    webExchange: (l, id) => `${webBase}/exchange/${webRealm}${enc(l)}/${id}`,
  }
}

/** Path of Exile CDN for item artwork */
export const POE_CDN = 'https://web.poecdn.com'

/** poe.ninja economy API for PoE1 item prices (dense overview, all types in one call) */
export const POE_NINJA_API = 'https://poe.ninja/poe1/api/economy/current/dense/overviews'

/** poe.ninja economy API for PoE2 currency prices. Different shape from PoE1:
 *  no dense/overviews endpoint exists, so we hit the currency exchange overview and
 *  convert primary-currency values (divine-denominated) into chaos-equivalents via
 *  the returned rates. Non-currency categories aren't covered here. */
export const POE_NINJA_POE2_EXCHANGE = 'https://poe.ninja/poe2/api/economy/exchange/current/overview'

/** Exiled Exchange 2's CDN-cached aggregator for PoE2 ninja data. Returns all
 *  13 economy categories in one response (vs 13 parallel calls direct to ninja).
 *  League slug is one of: league | leaguehc | standard | standardhc. Generously
 *  hosted by Keith Van (@kvan7), creator of Exiled Exchange 2 -- treat as a
 *  best-effort path with the direct-ninja path retained as fallback. */
export const POE2_NINJA_PROXY = 'https://api.exiledexchange2.dev/proxy'

/** Scalpel's GitHub repo home. Base for the issue URL and the Support
 *  Development link in Settings. Kept on UPSTREAM so bug reports and the
 *  support link land on the original project, not this personal fork. */
export const GITHUB_REPO_URL = 'https://github.com/scalpelpoe/scalpel'

// --- Fork update feed -------------------------------------------------------
// This is a personal fork (rm-sage/scalpel) carrying an iCUE focus-restore fix.
// It self-updates from its OWN GitHub releases, so ONLY the auto-update feed and
// its manual-download fallback are repointed to the fork. Every other endpoint —
// the issue/support links above and all live game-data/CDN URLs below — stays on
// upstream so the fork keeps consuming upstream data unchanged.

/** GitHub repo (owner/name) that hosts this fork's release builds. */
export const FORK_RELEASES_REPO = 'rm-sage/scalpel'

/** GitHub releases page (user-facing, for manual download links in banners).
 *  Repointed to the fork so the manual-download fallback also carries the fix. */
export const GITHUB_RELEASES_PAGE = `https://github.com/${FORK_RELEASES_REPO}/releases/latest`

/** GitHub new-issue page, opened (with a prefilled body) by the bug reporter.
 *  Intentionally left on UPSTREAM. */
export const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`

/** GitHub API for update checks — THE auto-update feed, repointed to the fork. */
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${FORK_RELEASES_REPO}/releases/latest`

/** GitHub for Electron binary downloads (only during full version upgrades) */
export const ELECTRON_RELEASES = 'https://github.com/electron/electron/releases/download'

/** Discord invite, opened alongside a generated bug report */
export const DISCORD_INVITE_URL = 'https://discord.com/invite/nUNcrmEAP5'

/** Ko-fi tip jar, linked from the Support Development section in Settings */
export const KOFI_URL = 'https://ko-fi.com/scalpelpoe'

/** Raw GitHub URL prefix for the cheat-sheet starter packs hosted in this
 *  repo's /cheat-sheet-prefabs/ folder. Images are not bundled into the
 *  installer; they're fetched on demand when the user clicks "+ <Pack>" in
 *  Settings -> Sheets. */
export const CHEAT_SHEET_PREFAB_BASE_URL =
  'https://raw.githubusercontent.com/scalpelpoe/scalpel/main/cheat-sheet-prefabs/'

/** Runtime-fetched manifest of values that may change between releases (e.g.
 *  ninja league slugs). Fetched on app start; bundled copy in the repo root
 *  acts as the offline fallback. New leagues only need a push to main. */
export const MANIFEST_URL = 'https://raw.githubusercontent.com/scalpelpoe/scalpel/main/manifest.json'

/** Runtime-fetched tier-data manifest (hash + schemaVersion). Polled on a timer;
 *  when its hash changes the client downloads the active game's tier JSON below.
 *  Bundled copies under src/shared/data/tiers are the offline fallback. */
export const TIER_DATA_MANIFEST_URL =
  'https://raw.githubusercontent.com/scalpelpoe/scalpel/main/src/shared/data/tiers/tier-manifest.json'

/** Base URL for the per-game tier datasets. Append `tiers-poe1.json` / `tiers-poe2.json`. */
export const TIER_DATA_BASE_URL = 'https://raw.githubusercontent.com/scalpelpoe/scalpel/main/src/shared/data/tiers/'

/** "Powered by..." attribution links shown under the regex output bar. The
 *  underlying mod / regex data ships from these projects; we point users at the
 *  source so they can compare against the upstream tools and contribute upstream. */
export const POE_RE_URL = 'https://poe.re'
export const POE2_RE_URL = 'https://poe2.re'

/** URL of the curated plugin registry JSON (raw GitHub). Can be overridden
 *  via the pluginRegistryUrl setting for self-hosted registries. */
export const PLUGIN_REGISTRY_URL =
  'https://raw.githubusercontent.com/scalpelpoe/scalpel-plugins-registry/main/registry.json'

/** Construct the download URL for a plugin release asset on GitHub. */
export function pluginReleaseAssetUrl(repo: string, version: string, file: string): string {
  return `https://github.com/${repo}/releases/download/v${version}/${file}`
}
