# rm-sage/scalpel — personal fork

This is a personal fork of [scalpelpoe/scalpel](https://github.com/scalpelpoe/scalpel)
carrying one change: **secondary overlays hand OS foreground focus back to Path of
Exile when dismissed**, so foreground-watching tools (notably Corsair **iCUE**'s
per-game profile switching) keep detecting PoE and the user's custom binds keep
working after using a Scalpel overlay.

## What differs from upstream

| Area | Change |
|------|--------|
| `src/main/windowing/index.ts`, `src/main/windowing/focus.ts` | On every user-driven secondary-overlay dismiss (`hideState`, the OS close button, and the Esc dispatcher), call `OverlayController.focusTarget()` (Win32 `SetForegroundWindow` on the PoE window). PoE-exit / alt-tab-out / content-driven hides are intentionally left alone. |
| `src/shared/endpoints.ts` | **Only** the auto-update feed (`GITHUB_RELEASES_API`) and its manual-download fallback (`GITHUB_RELEASES_PAGE`) point at this fork. All game-data, issue, and support endpoints stay on upstream. |

Everything else — trade data, leagues, tier data, cheat-sheet prefabs, the plugin
registry — is fetched from upstream unchanged.

## How updates work

Scalpel's updater is a custom ASAR hot-swap: it polls `GITHUB_RELEASES_API` (now this
fork), downloads `app.asar` + `manifest.json` from the latest release, verifies the
SHA-512, and swaps `app.asar` in place. So this fork self-updates from **its own**
GitHub releases.

- Install the fork's `Scalpel-Setup.exe` once (from this repo's Releases).
- After that it auto-updates from this fork.

`package.json` version stays semver-clean and identical to the upstream base (e.g.
`0.9.12-rc3`); the fork identity lives in the **git tag** with a `-focusfix` suffix
(e.g. `v0.9.12-rc3-focusfix`). A `+metadata` suffix is deliberately avoided —
Electron's `app.getVersion()` strips it, which would break the updater's
string-equality version check, and `+` breaks the `dist/v${version}/` path glob.

## Staying current with upstream

A scheduled GitHub Action (`.github/workflows/auto-rebase.yml`, added after the fix is
verified) polls upstream for new release tags, cherry-picks this fork's patch commits
onto each, re-tags `<version>-focusfix`, and pushes — which triggers `release.yml` to
build and publish, so the app auto-updates to the patched build. On a cherry-pick
conflict it opens an issue instead of shipping a broken build.

> One-time setup for the auto-build: GitHub disables a fork's Actions until the owner
> enables them (Actions tab → "I understand my workflows, go ahead and enable them",
> or via the API). The tag-triggered release build also needs a PAT secret
> (`RELEASE_PAT`) when tags are pushed by automation, because pushes made with the
> default `GITHUB_TOKEN` do not trigger further workflows.
