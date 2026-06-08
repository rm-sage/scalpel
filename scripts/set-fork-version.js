#!/usr/bin/env node
// Derive this fork's release version from the upstream baseline and write it into
// package.json. The upstream-sync workflow runs this AFTER it merges upstream/main,
// so the fork version always tracks the exact upstream version it was built from
// while staying unique per fork build.
//
// Scheme: `<full upstream version>-rmsage.<N>`
//   - The upstream version is kept VERBATIM, including any `-rcN` / `-beta`
//     prerelease tag. This is deliberate: release.yml marks a release as a
//     GitHub prerelease when the tag contains `rc`/`beta`, and the updater's
//     stable channel only sees non-prereleases. Keeping the suffix makes the
//     fork's stable/beta channels mirror upstream's automatically -- an upstream
//     RC produces a fork prerelease, an upstream stable produces a fork release.
//   - N increments per fork build of the SAME upstream baseline and resets to 1
//     when the baseline changes. It is derived from existing `v<base>-rmsage.*`
//     git tags so a rerun never collides with an already-published build.
//   - No `+build` metadata: Electron's app.getVersion() strips it (which would
//     break the updater's string-equality check) and `+` breaks the
//     dist/v${version}/ path glob release.yml depends on.
//
// Usage:
//   node scripts/set-fork-version.js <upstreamVersion>
//   UPSTREAM_VERSION=0.9.13-rc5 node scripts/set-fork-version.js
// With no argument it reads the version from `git show upstream/main:package.json`.

const { execFileSync } = require('node:child_process')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const FORK_TAG = 'rmsage'

/** Escape a string for safe interpolation into a RegExp. */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Highest N already published as a `v<base>-rmsage.<N>` tag, or 0 if none. */
function highestExistingN(base, tagList) {
  const re = new RegExp(`^v${escapeRe(base)}-${FORK_TAG}\\.(\\d+)$`)
  let max = 0
  for (const tag of tagList) {
    const m = tag.trim().match(re)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

/** Pure: the next fork version for an upstream baseline given the existing max N. */
function computeForkVersion(upstreamVersion, existingMaxN) {
  const base = String(upstreamVersion).trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+/.test(base)) {
    throw new Error(`Refusing to derive a fork version from a non-semver upstream value: "${upstreamVersion}"`)
  }
  return `${base}-${FORK_TAG}.${existingMaxN + 1}`
}

/** Replace only the first (top-level) `"version": "..."` in a JSON file's text,
 *  preserving all formatting. Used instead of JSON.parse/stringify so package.json
 *  isn't reflowed on every sync. */
function setTopLevelVersion(relPath, version) {
  const p = join(ROOT, relPath)
  const text = readFileSync(p, 'utf8')
  if (!/"version":\s*"[^"]*"/.test(text)) throw new Error(`No "version" field found in ${relPath}`)
  writeFileSync(p, text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`))
}

function git(args) {
  // Fixed-arg git invocations via execFileSync (no shell) -- nothing here is
  // interpolated from untrusted input, and the array form keeps it that way.
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
}

function gitTags() {
  try {
    return git(['tag', '-l']).split('\n')
  } catch {
    return []
  }
}

function readUpstreamVersion() {
  const fromArg = process.argv[2] || process.env.UPSTREAM_VERSION
  if (fromArg) return fromArg
  return JSON.parse(git(['show', 'upstream/main:package.json'])).version
}

function main() {
  const upstream = readUpstreamVersion()
  const base = String(upstream).trim().replace(/^v/, '')
  const next = computeForkVersion(upstream, highestExistingN(base, gitTags()))
  setTopLevelVersion('package.json', next)
  // Keep the lockfile's root version aligned when present; harmless if it drifts
  // (npm doesn't gate the build on it), so a failure here is non-fatal.
  try {
    setTopLevelVersion('package-lock.json', next)
  } catch {
    /* lockfile version is cosmetic */
  }
  process.stdout.write(`${next}\n`)
}

if (require.main === module) main()

module.exports = { computeForkVersion, highestExistingN, escapeRe }
