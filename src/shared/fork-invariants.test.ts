// Fork guardrails.
//
// This file exists ONLY on the rm-sage fork, never upstream, so an upstream merge
// can't conflict on it -- but it FAILS LOUDLY (red CI) the moment a merge silently
// reverts something that makes this a fork. The upstream-sync workflow only ships a
// build when the test suite is green, so a merge that drops the update-feed repoint
// or the Craft of Exile macro can never auto-publish a build that would point users
// back at upstream or lose the feature. If one of these assertions ever fails after
// a sync, the fix is to re-apply the reverted change, not to relax the assertion.
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import { FORK_RELEASES_REPO, GITHUB_RELEASES_API, GITHUB_RELEASES_PAGE } from './endpoints'
import { craftOfExileUrl } from './external-link'

describe('fork invariant: the auto-update feed points at this fork', () => {
  it('names the fork repo', () => {
    expect(FORK_RELEASES_REPO).toBe('rm-sage/scalpel')
  })

  it('polls the fork for updates, not upstream', () => {
    expect(GITHUB_RELEASES_API).toContain('rm-sage/scalpel')
    expect(GITHUB_RELEASES_API).not.toContain('scalpelpoe/scalpel')
  })

  it('sends the manual-download fallback to the fork', () => {
    expect(GITHUB_RELEASES_PAGE).toContain('rm-sage/scalpel')
  })

  // Both URLs are written out as plain literals so `scripts/update-smoke.mjs` can
  // find them in the built bundle (rollup won't fold a template literal that reads
  // an imported binding -- see the comment on GITHUB_RELEASES_API). That hand-copied
  // repo string is exactly the kind of thing that drifts, so pin it here.
  it('keeps the hand-written release URLs in step with FORK_RELEASES_REPO', () => {
    expect(GITHUB_RELEASES_API).toBe(`https://api.github.com/repos/${FORK_RELEASES_REPO}/releases/latest`)
    expect(GITHUB_RELEASES_PAGE).toBe(`https://github.com/${FORK_RELEASES_REPO}/releases/latest`)
  })
})

describe('fork invariant: the Craft of Exile macro is present', () => {
  it('builds a pre-imported Craft of Exile URL for the active game', () => {
    expect(craftOfExileUrl('Item Class: Rings', 1)).toBe(
      'https://www.craftofexile.com/?game=poe1&eimport=Item%20Class%3A%20Rings',
    )
    expect(craftOfExileUrl('anything', 2)).toContain('game=poe2')
  })
})

describe('fork invariant: the build carries the fork version suffix', () => {
  it('package.json version is tagged -rmsage.N', () => {
    expect(pkg.version).toMatch(/-rmsage\.\d+$/)
  })
})
