# rm-sage/scalpel — personal fork

A personal fork of [scalpelpoe/scalpel](https://github.com/scalpelpoe/scalpel) that
tracks upstream automatically and carries **one** real feature on top:

- **Open Craft of Exile** — a bindable hotkey that copies the hovered item (advanced
  `Ctrl+Alt+C` format) and opens it pre-imported in the [Craft of Exile](https://www.craftofexile.com)
  crafting simulator, mirroring Exiled Exchange 2 / Awakened PoE Trade's action.

> An earlier iCUE focus-restore change was dropped (superseded by an external
> workaround). Keeping the fork's divergence minimal is what makes the automatic
> upstream sync below reliable.

## What differs from upstream

The fork is intentionally a *thin* layer — `git diff upstream/main...main` should stay
small. Three things diverge:

| Area | Change |
|------|--------|
| **The macro** | `src/shared/external-link.ts` (`craftOfExileUrl`), `src/main/evaluation.ts` (`createOpenCraftOfExileHandler`), `src/main/index.ts` (wiring + the `openCraftOfExile` action), `src/renderer/src/components/settings/utils.ts` (the macro list entry), plus tests. |
| **Update feed** | `src/shared/endpoints.ts`: **only** the auto-update feed (`GITHUB_RELEASES_API`) and its manual-download fallback (`GITHUB_RELEASES_PAGE`) point at this fork. All game-data, issue, and support endpoints stay on upstream. |
| **Version** | `package.json` carries a `-rmsage.N` suffix (see below). |

Everything else — trade data, leagues, tier data, cheat-sheet prefabs, the plugin
registry — is fetched from upstream unchanged.

The fork's two non-version changes are protected by `src/shared/fork-invariants.test.ts`,
which fails the test suite if a merge ever reverts the repoint or drops the macro. Since
the sync only ships on a green suite, a bad merge can't auto-publish.

## How updates reach you

Scalpel's updater is a custom ASAR hot-swap: it polls `GITHUB_RELEASES_API` (this fork),
downloads `app.asar` + `manifest.json` from the latest release, verifies the SHA-512, and
swaps `app.asar` in place. So the fork self-updates from **its own** GitHub releases.

- Install the fork's `Scalpel-Setup.exe` once (from this repo's Releases).
- After that it auto-updates from this fork.

### Version scheme

Fork version = **`<major.minor.patch>-rmsage.<N>`**, e.g. upstream `0.9.13-rc5`
becomes `0.9.13-rmsage.1`. The script `scripts/set-fork-version.js` derives it.

- The upstream prerelease tag (`-rcN`/`-beta`) is **stripped**. This is deliberate:
  `release.yml` flags a GitHub *prerelease* only when the tag contains `rc`/`beta`,
  and the updater's stable channel + in-app Download button resolve via
  `/releases/latest`, which **ignores prereleases**. Stripping keeps every fork build
  a full (non-prerelease) release, so the stable channel always picks it up — even
  when the fork is built from an upstream RC.
- `N` increments per fork build of the **same** `X.Y.Z` (multiple RCs of 0.9.13 all
  map to `0.9.13-rmsage.1`, `.2`, …) and resets to `1` when `X.Y.Z` changes; it's
  derived from existing `v<base>-rmsage.*` tags.
- No `+build` metadata: `app.getVersion()` strips it (breaking the updater's
  string-equality check) and `+` breaks the `dist/v${version}/` path glob.

## Staying current with upstream (automatic)

`.github/workflows/auto-sync.yml` runs daily (and on manual dispatch). Each run:

1. Skips if `upstream/main` is already merged (nothing new).
2. Merges `upstream/main` into `main`. A version-line clash on `package.json` is
   resolved deterministically (the version is re-derived, never merged); any **other**
   conflict aborts the merge and opens an issue.
3. Re-derives the fork version via `set-fork-version.js`.
4. Verifies with the **same gate as CI** — `typecheck`, `lint`, `format:check`, `test`
   (incl. the fork invariants), `build`.
5. **Only if green**, pushes `main` and a `v<version>` tag, which triggers `release.yml`
   to build and publish — so the app auto-updates.

If the merge conflicts or verification fails, it opens an issue and ships nothing.

### Doing a sync manually

The first big jump after a long gap (or any sync the bot punted to an issue) is just a
normal merge on **Node 22** (Node 26 breaks `npm install` here):

```bash
git fetch upstream
git checkout main && git merge upstream/main      # resolve any conflicts
node scripts/set-fork-version.js "$(git show upstream/main:package.json | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).version")"
npm ci && npm test                                # confirm the invariant test is green
git add -A && git commit
git push origin main
git tag vX.Y.Z-rmsage.N && git push origin vX.Y.Z-rmsage.N   # triggers release.yml
```

## One-time setup for the automation

- **Enable Actions on the fork.** GitHub disables a fork's workflows by default
  (Actions tab → "I understand my workflows, go ahead and enable them"). Scheduled
  workflows also auto-disable after 60 days of repo inactivity — a manual dispatch or
  any push re-arms them.
- **Add a `RELEASE_PAT` secret.** A fine-grained PAT with `contents: write` on this
  repo. The sync pushes the release tag with it because a tag pushed by the default
  `GITHUB_TOKEN` does **not** trigger `release.yml`.
