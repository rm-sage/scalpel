import { describe, expect, it } from 'vitest'
import { shouldRelaunchAfterOnboarding } from './onboarding-relaunch'

describe('shouldRelaunchAfterOnboarding', () => {
  it('returns none when versions match (1,1) packaged', () => {
    expect(shouldRelaunchAfterOnboarding(1, 1, true)).toBe('none')
  })

  it('returns none when versions match (2,2) packaged', () => {
    expect(shouldRelaunchAfterOnboarding(2, 2, true)).toBe('none')
  })

  it('returns none when versions match (1,1) unpacked', () => {
    expect(shouldRelaunchAfterOnboarding(1, 1, false)).toBe('none')
  })

  it('returns none when versions match (2,2) unpacked', () => {
    expect(shouldRelaunchAfterOnboarding(2, 2, false)).toBe('none')
  })

  it('returns relaunch when mismatch: overlay=1, active=2, packaged', () => {
    expect(shouldRelaunchAfterOnboarding(2, 1, true)).toBe('relaunch')
  })

  it('returns relaunch when mismatch: overlay=2, active=1, packaged', () => {
    expect(shouldRelaunchAfterOnboarding(1, 2, true)).toBe('relaunch')
  })

  it('returns dev-warn when mismatch: overlay=1, active=2, unpacked', () => {
    expect(shouldRelaunchAfterOnboarding(2, 1, false)).toBe('dev-warn')
  })
})
