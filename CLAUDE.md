# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Scalpel is an Electron overlay for Path of Exile 1 & 2 — a transparent window drawn on top of the game that does filter editing, price checking, regex generation, economy auditing, online filter sync, macros, cheat sheets, and an art-mode whiteboard. It uses native modules to hook global input (`uiohook-napi`), track the focused window (`active-win`), and clamp the overlay to the game window (`electron-overlay-window`).

This is the **rmsage fork** of `scalpelpoe/scalpel`. Versioning is `<upstream major.minor.patch>-rmsage.N` (currently `1.0.4-rmsage.2`). **Do not hand-edit the version** — `scripts/set-fork-version.js` derives it on every sync: it takes the base from `upstream/main:package.json`, strips upstream's `-rcN`/`-beta` (so the build lands on the updater's stable channel), and picks `N` from existing `v<base>-rmsage.*` tags, resetting to 1 when the base changes. Releases ship by pushing a `v<version>` git tag (CI builds the installer).

See **`FORK-SETUP.md`** for the full fork story. The fork-specific files are `.github/workflows/auto-sync.yml` (daily upstream merge → verify → auto-tag), `scripts/set-fork-version.js`, and `src/shared/fork-invariants.test.ts` — a tripwire that reds CI if a merge ever reverts the update-feed repoint, drops the Craft of Exile macro, or leaves a non-`-rmsage` version. If it fails after a sync, re-apply the reverted change; don't relax the assertion.

## Commands

```bash
npm install            # postinstall runs patch-package + electron-rebuild (native modules)
npm run dev            # build internal assets, sync regex data, launch electron-vite dev
npm run build          # build internal assets + electron-vite build → out/

npm run typecheck      # tsc across tsconfig.json, tsconfig.node.json, tsconfig.e2e.json
npm run lint           # biome lint src
npm run format         # biome format --write src

npm test               # vitest run (all *.test.ts / *.test.tsx)
npx vitest run src/main/trade/prices.test.ts   # single test file
npm run test:watch     # vitest watch mode
npm run test:e2e       # build + playwright against the packaged electron app

npm run dist:win       # build + electron-builder NSIS installer (→ dist/)
npm run dist:linux     # build + AppImage
npm run storybook      # component dev at :6006
```

**Node ^22 is required** (`.nvmrc` = 22). Node 26 breaks the `electron` install (`extract-zip` fails) — stay on 22.

The pre-commit hook (`.husky/pre-commit`) runs four steps: `npm run build:i18n` (regenerates the gitignored Paraglide runtime so tsc/vitest see bindings matching the current `messages/*.json`), then `lint-staged` (biome check --write), then `tsc --noEmit`, then the full test suite. All four must pass to commit.

Biome (not ESLint/Prettier): 2-space indent, 120 col, LF, `recommended: false` with a hand-picked rule set in `biome.json`. Vendored data under `src/shared/data/regex/vendor` is excluded.

## Architecture

Standard Electron three-process split (`electron.vite.config.ts` builds each separately):

- **`src/main/`** — Node/Electron main process. Owns all OS integration, networking, storage, and window lifecycle. No DOM.
- **`src/preload/index.ts`** — the **single IPC contract**. Exposes a typed `window.api` object via `contextBridge`; every renderer↔main call goes through here. When you add a feature that crosses the boundary, you edit: the main-side `ipcMain.handle`, the preload `api` method, and the renderer call site. Keep all three in sync.
- **`src/renderer/`** — React 18 + Tailwind. Multiple independent HTML entry points (see below), not a single SPA.
- **`src/shared/`** — types and pure logic imported by both sides (`types.ts`, `game-features.ts`, theme derivation, geometry, panel state). Anything here must stay DOM-free and Electron-free so both processes can import it.

### Multiple renderer windows

The overlay is not one window. `electron.vite.config.ts` declares a separate rollup input + HTML file per surface: `overlay` (the main in-game overlay), `app` (the standalone settings/app window), `cheatSheetsGrid`, `cheatSheetPreview`, `secondaryOverlayCanvas`, `whiteboard`, `regexRemote`, `pinnedZone`, `pluginOverlay`, `pluginAnnotationOverlay`. Each has its own React root under `src/renderer/src/`. The main process creates and positions these BrowserWindows; `src/main/windowing/` and `src/main/overlay.ts` handle focus, snapping, and clamping to the game.

### IPC handler registration

Handlers live in `src/main/handlers/*.ts`, each exporting a registration function — either `register(store)` or a named `registerXxxHandlers()` when it needs no store. They are **not** wired up in `index.ts`: they are all called from `registerAllIpc()` in **`src/main/app/register-ipc.ts`**, which `src/main/index.ts` invokes once at startup (one call, `index.ts:280`). Anything a handler needs beyond the store is threaded through the `IpcRegistrationDeps` object (`isElevated`, `getAppWindow`, `showAppWindow`, `hideOverlay`).

To add an IPC channel: add the `ipcMain.handle` in the appropriate handler module (or a new module), call its registration function from `register-ipc.ts`, then expose it in `preload/index.ts`.

### Persistence

`electron-store` (a single `Store<AppSettings>` instance created in `index.ts` and passed into handler `register()` calls). Settings are layered: global `AppSettings` plus per-game **profiles** (`src/main/profiles/`, `src/shared/types.ts`), since PoE1 and PoE2 each have their own filter, league, and tier config.

### Cross-game support (PoE1 vs PoE2)

The same binary supports both games and switches at runtime via hotkey (`src/main/game-switch.ts`, `game-detector.ts`, `game-state.ts`). **Do not branch on `poeVersion === 2` in the renderer** — add a flag to `src/shared/game-features.ts` (`GameFeatures`) and read `features.foo`. That file is the single source of truth for what each game supports; data the main process can simply omit doesn't need a flag.

### Trade / price checking

`src/main/trade/` is the most fragile subsystem (per README, ~50% of bugs live here). It parses clipboard item text, matches affixes against trade stats (`stat-matcher/`), queries the official trade API with a `rate-limiter.ts`, and has separate PoE1/PoE2 price paths (`prices.ts`, `prices.poe2.ts`). Heavily unit-tested — run the trade tests after any change here.

### Generated / synced data

Several scripts produce data committed or built into the app — do not hand-edit their outputs:
- `scripts/sync-regex-data.js` (`npm run sync-regex`) — pulls regex tokens from poe.re.
- `scripts/build-internal-assets.mjs` — runs as part of `dev`/`build`.
- `scripts/build-tier-data.js`, `build-poe{1,2}-item-classes.js`, `build-tablet-*.js`, `update-league-data.js`.

### Plugins

Third-party plugin system. `src/main/plugins/` handles install (from registry or unpacked), validation, sandboxed protocol, and lifecycle; plugins render into the `pluginOverlay` window. `src/plugin-sdk/` is the separately-built public SDK package consumed by plugin authors (`public-surface.test.ts` guards its API surface). See `PLUGINS.md` for the authoring guide. Keep the SDK's public surface stable.

### Native modules

`uiohook-napi` (global keyboard/mouse hook) and `electron-overlay-window` are rebuilt against Electron's ABI on install and `asarUnpack`'d in the packaged build (`package.json` build config). `scripts/postinstall.js` applies `patches/` before `electron-rebuild`. Native overlay-thread crashes don't surface as JS exceptions — `index.ts` wraps native listeners in `guardNativeListener` and starts `crashReporter` for minidumps. Be careful throwing inside uiohook/overlay event listeners.

## Testing notes

- Vitest picks the environment by path: `src/renderer/**/*.test.tsx` → jsdom, everything else → node (`vitest.config.ts`). Renderer tests use `src/renderer/test-setup.ts`.
- E2E (`tests/e2e/`, Playwright) launches the real packaged app with `SCALPEL_E2E=1`, which boots a **gutted** app — no overlay, hotkeys, tray, or network. Code gated on `IS_E2E` in `index.ts` reflects this.
- Tests sit next to the code they cover (`foo.ts` + `foo.test.ts`).
