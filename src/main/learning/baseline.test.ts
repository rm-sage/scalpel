import { describe, expect, it } from 'vitest'
import { needsBaselineReset } from './baseline'

describe('needsBaselineReset', () => {
  it('wipes when the stored stamp is missing and the baseline is past 0', () => {
    expect(needsBaselineReset(undefined, 1)).toBe(true)
  })

  it('wipes when the stored stamp predates the baseline', () => {
    expect(needsBaselineReset(1, 2)).toBe(true)
  })

  it('does not wipe when the stored stamp matches the baseline', () => {
    expect(needsBaselineReset(2, 2)).toBe(false)
  })

  it('does not wipe when the stored stamp is ahead of the baseline (downgrade)', () => {
    expect(needsBaselineReset(3, 2)).toBe(false)
  })

  it('never wipes at baseline 0, even with no stored stamp', () => {
    expect(needsBaselineReset(undefined, 0)).toBe(false)
  })
})
